#!/usr/bin/env python3
"""
Streaming TTS Synthesis
Real-time text-to-speech with streaming audio output
"""

import time
import threading
import queue
import io
import numpy as np
from typing import Generator, Optional, Dict, Any, Callable
from pathlib import Path
import logging

try:
    from TTS.api import TTS
    import torch
    import soundfile as sf
except ImportError as e:
    print(f"Error: Required dependencies not installed. {e}")
    raise

from security_validators import validate_text, InputValidationError, SecurityError
from model_pool import get_model_pool

# Configure streaming logger
stream_logger = logging.getLogger('tts.streaming')
stream_logger.setLevel(logging.INFO)

class TextChunker:
    """
    Intelligent text chunking for streaming synthesis
    Breaks text into semantic chunks for better streaming experience
    """
    
    def __init__(self, max_chunk_length: int = 50, min_chunk_length: int = 10):
        """
        Initialize text chunker
        
        Args:
            max_chunk_length: Maximum characters per chunk
            min_chunk_length: Minimum characters per chunk
        """
        self.max_chunk_length = max_chunk_length
        self.min_chunk_length = min_chunk_length
        
        # Sentence boundary markers
        self.sentence_endings = '.!?'
        # Phrase boundary markers  
        self.phrase_boundaries = ',:;'
        # Word boundaries
        self.word_boundaries = ' \t\n'
    
    def chunk_text(self, text: str) -> Generator[str, None, None]:
        """
        Break text into semantic chunks for streaming
        
        Args:
            text: Input text to chunk
            
        Yields:
            Text chunks suitable for streaming synthesis
        """
        if not text.strip():
            return
        
        # Clean and validate text
        try:
            clean_text = validate_text(text.strip())
        except (InputValidationError, SecurityError) as e:
            stream_logger.error(f"Text validation failed: {e}")
            return
        
        current_chunk = ""
        words = clean_text.split()
        
        for word in words:
            # Check if adding this word would exceed max length
            potential_chunk = f"{current_chunk} {word}".strip()
            
            if len(potential_chunk) <= self.max_chunk_length:
                current_chunk = potential_chunk
            else:
                # Emit current chunk if it's long enough
                if len(current_chunk) >= self.min_chunk_length:
                    yield current_chunk
                    current_chunk = word
                else:
                    # Current chunk too short, add word anyway
                    current_chunk = potential_chunk
            
            # Check for natural breaking points
            if word and word[-1] in self.sentence_endings:
                # End of sentence - good breaking point
                if len(current_chunk) >= self.min_chunk_length:
                    yield current_chunk
                    current_chunk = ""
            elif word and word[-1] in self.phrase_boundaries:
                # End of phrase - break if chunk is getting long
                if len(current_chunk) >= self.max_chunk_length * 0.8:
                    yield current_chunk
                    current_chunk = ""
        
        # Emit final chunk
        if current_chunk.strip():
            yield current_chunk.strip()

class StreamingSynthesis:
    """
    Real-time streaming text-to-speech synthesis
    Generates audio chunks as text is processed
    """
    
    def __init__(self, model_name: str = "fast", chunk_size: int = 1024):
        """
        Initialize streaming synthesis
        
        Args:
            model_name: TTS model to use (prefer 'fast' for streaming)
            chunk_size: Audio chunk size in samples
        """
        self.model_name = model_name
        self.chunk_size = chunk_size
        
        # Chunking and processing
        self.text_chunker = TextChunker(max_chunk_length=50, min_chunk_length=10)
        
        # Threading for real-time processing
        self.synthesis_queue = queue.Queue()
        self.audio_queue = queue.Queue()
        self.stop_event = threading.Event()
        
        # Worker threads
        self.synthesis_thread: Optional[threading.Thread] = None
        self.chunking_thread: Optional[threading.Thread] = None
        
        # Performance tracking
        self.stats = {
            "chunks_processed": 0,
            "total_latency_ms": 0,
            "first_chunk_latency_ms": 0,
            "streaming_started": False
        }
        
        stream_logger.info(f"Streaming synthesis initialized with model: {model_name}")
    
    def _synthesis_worker(self):
        """
        Background worker for chunk synthesis
        """
        model_pool = get_model_pool()
        
        while not self.stop_event.is_set():
            try:
                # Get next text chunk (with timeout to check stop event)
                chunk_data = self.synthesis_queue.get(timeout=0.1)
                if chunk_data is None:
                    break
                
                chunk_text, chunk_id, start_time = chunk_data
                
                # Get TTS model
                tts_model = model_pool.get_model(self.model_name)
                if tts_model is None:
                    stream_logger.error(f"Model not available: {self.model_name}")
                    continue
                
                # Synthesize chunk to memory
                try:
                    # Create temporary buffer for audio
                    temp_buffer = io.BytesIO()
                    
                    # Use a temporary file for TTS synthesis
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                        temp_path = temp_file.name
                    
                    # Synthesize
                    tts_model.tts_to_file(
                        text=chunk_text,
                        file_path=temp_path,
                        speaker=None,
                        language="en",
                        speed=1.1  # Slightly faster for streaming
                    )
                    
                    # Read synthesized audio
                    audio_data, sample_rate = sf.read(temp_path)
                    
                    # Clean up temp file
                    Path(temp_path).unlink(missing_ok=True)
                    
                    # Calculate latency
                    chunk_latency = (time.time() - start_time) * 1000
                    
                    # Track first chunk latency
                    if not self.stats["streaming_started"]:
                        self.stats["first_chunk_latency_ms"] = chunk_latency
                        self.stats["streaming_started"] = True
                    
                    # Update stats
                    self.stats["chunks_processed"] += 1
                    self.stats["total_latency_ms"] += chunk_latency
                    
                    # Queue audio for streaming
                    self.audio_queue.put({
                        "chunk_id": chunk_id,
                        "audio_data": audio_data,
                        "sample_rate": sample_rate,
                        "latency_ms": chunk_latency,
                        "text": chunk_text
                    })
                    
                    stream_logger.debug(f"Synthesized chunk {chunk_id}: '{chunk_text}' ({chunk_latency:.1f}ms)")
                    
                except Exception as e:
                    stream_logger.error(f"Synthesis failed for chunk {chunk_id}: {e}")
                    # Queue error marker
                    self.audio_queue.put({
                        "chunk_id": chunk_id,
                        "error": str(e),
                        "text": chunk_text
                    })
                
            except queue.Empty:
                continue
            except Exception as e:
                stream_logger.error(f"Synthesis worker error: {e}")
    
    def synthesize_streaming(self, text: str, progress_callback: Optional[Callable] = None) -> Generator[Dict[str, Any], None, None]:
        """
        Stream synthesis of text with real-time audio chunks
        
        Args:
            text: Text to synthesize
            progress_callback: Optional callback for progress updates
            
        Yields:
            Dictionary with audio chunk data
        """
        if not text.strip():
            return
        
        stream_logger.info(f"Starting streaming synthesis: '{text[:50]}...'")
        
        # Reset stats
        self.stats = {
            "chunks_processed": 0,
            "total_latency_ms": 0,
            "first_chunk_latency_ms": 0,
            "streaming_started": False
        }
        
        # Start synthesis worker if not running
        if not self.synthesis_thread or not self.synthesis_thread.is_alive():
            self.stop_event.clear()
            self.synthesis_thread = threading.Thread(target=self._synthesis_worker, daemon=True)
            self.synthesis_thread.start()
        
        # Clear queues
        while not self.synthesis_queue.empty():
            try:
                self.synthesis_queue.get_nowait()
            except queue.Empty:
                break
        
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break
        
        # Chunk text and queue for synthesis
        chunks = list(self.text_chunker.chunk_text(text))
        total_chunks = len(chunks)
        
        stream_logger.info(f"Split into {total_chunks} chunks for streaming")
        
        # Queue all chunks for synthesis
        for i, chunk in enumerate(chunks):
            self.synthesis_queue.put((chunk, i, time.time()))
        
        # Stream audio chunks as they become available
        chunks_received = 0
        expected_chunk_id = 0
        pending_chunks = {}  # Buffer for out-of-order chunks
        
        while chunks_received < total_chunks:
            try:
                # Get next audio chunk (with timeout)
                audio_chunk = self.audio_queue.get(timeout=5.0)
                
                chunk_id = audio_chunk["chunk_id"]
                
                # Handle errors
                if "error" in audio_chunk:
                    yield {
                        "type": "error",
                        "chunk_id": chunk_id,
                        "error": audio_chunk["error"],
                        "text": audio_chunk["text"]
                    }
                    chunks_received += 1
                    continue
                
                # Buffer chunk if it's out of order
                if chunk_id != expected_chunk_id:
                    pending_chunks[chunk_id] = audio_chunk
                    continue
                
                # Process chunk in order
                while expected_chunk_id in pending_chunks or expected_chunk_id == chunk_id:
                    if expected_chunk_id == chunk_id:
                        current_chunk = audio_chunk
                    else:
                        current_chunk = pending_chunks.pop(expected_chunk_id)
                    
                    # Yield audio chunk
                    yield {
                        "type": "audio",
                        "chunk_id": current_chunk["chunk_id"],
                        "audio_data": current_chunk["audio_data"],
                        "sample_rate": current_chunk["sample_rate"],
                        "latency_ms": current_chunk["latency_ms"],
                        "text": current_chunk["text"],
                        "progress": (chunks_received + 1) / total_chunks
                    }
                    
                    # Call progress callback
                    if progress_callback:
                        progress_callback(chunks_received + 1, total_chunks)
                    
                    chunks_received += 1
                    expected_chunk_id += 1
                    
                    # Break if we've processed the current chunk
                    if expected_chunk_id > chunk_id:
                        break
                
            except queue.Empty:
                stream_logger.warning(f"Timeout waiting for chunk {expected_chunk_id}")
                break
        
        # Final statistics
        if self.stats["chunks_processed"] > 0:
            avg_latency = self.stats["total_latency_ms"] / self.stats["chunks_processed"]
            yield {
                "type": "complete",
                "total_chunks": total_chunks,
                "first_chunk_latency_ms": self.stats["first_chunk_latency_ms"],
                "average_chunk_latency_ms": avg_latency,
                "total_processing_time_ms": self.stats["total_latency_ms"]
            }
        
        stream_logger.info(f"Streaming synthesis complete: {chunks_received}/{total_chunks} chunks")
    
    def synthesize_to_buffer(self, text: str) -> np.ndarray:
        """
        Synthesize text to a single audio buffer
        
        Args:
            text: Text to synthesize
            
        Returns:
            Combined audio data
        """
        audio_chunks = []
        sample_rate = None
        
        for chunk in self.synthesize_streaming(text):
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["audio_data"])
                if sample_rate is None:
                    sample_rate = chunk["sample_rate"]
        
        if not audio_chunks:
            return np.array([])
        
        # Concatenate all chunks
        combined_audio = np.concatenate(audio_chunks)
        return combined_audio
    
    def get_streaming_stats(self) -> Dict[str, Any]:
        """Get streaming performance statistics"""
        return self.stats.copy()
    
    def stop_streaming(self):
        """Stop streaming synthesis"""
        self.stop_event.set()
        
        # Signal threads to stop
        if self.synthesis_thread and self.synthesis_thread.is_alive():
            self.synthesis_queue.put(None)
            self.synthesis_thread.join(timeout=2.0)
        
        stream_logger.info("Streaming synthesis stopped")

# Global streaming instance
_streaming_synthesis: Optional[StreamingSynthesis] = None

def get_streaming_synthesis() -> StreamingSynthesis:
    """Get global streaming synthesis instance"""
    if _streaming_synthesis is None:
        raise RuntimeError("Streaming synthesis not initialized")
    return _streaming_synthesis

def init_streaming_synthesis(model_name: str = "fast", chunk_size: int = 1024):
    """Initialize global streaming synthesis"""
    global _streaming_synthesis
    _streaming_synthesis = StreamingSynthesis(model_name, chunk_size)

def stream_synthesize(text: str, progress_callback: Optional[Callable] = None) -> Generator[Dict[str, Any], None, None]:
    """Stream synthesize text using global instance"""
    return get_streaming_synthesis().synthesize_streaming(text, progress_callback)

def shutdown_streaming():
    """Shutdown global streaming synthesis"""
    global _streaming_synthesis
    if _streaming_synthesis:
        _streaming_synthesis.stop_streaming()
        _streaming_synthesis = None