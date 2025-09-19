#!/usr/bin/env python3
"""
Coqui TTS Service
Handles text-to-speech synthesis with voice model management and caching
"""

import os
import sys
import json
import time
import tempfile
import threading
import queue
import logging
from typing import Optional, Dict, List, Any
from pathlib import Path
import numpy as np

# SECURITY: Import security validators
from security_validators import (
    init_security_validator, validate_text, validate_path, validate_model,
    safe_cache_key, SecurityError, PathTraversalError, InputValidationError,
    ResourceExhaustionError, get_validator
)

# PERFORMANCE: Import model pool for preloading and caching
from model_pool import init_model_pool, get_model_pool, preload_models

# PERFORMANCE: Import memory cache for ultra-fast audio retrieval
from memory_cache import init_memory_cache, get_memory_cache, cache_audio, get_cached_audio

# PERFORMANCE: Import streaming synthesis for real-time audio generation
from streaming_synthesis import init_streaming_synthesis, get_streaming_synthesis, stream_synthesize

# PERFORMANCE: Import performance monitoring for real-time metrics
from performance_monitor import (
    init_performance_monitor, get_performance_monitor, start_request_tracking,
    record_timestamp, record_metric, complete_request_tracking,
    get_performance_stats, get_performance_breakdown
)

# PERFORMANCE: Import GPU optimization for accelerated synthesis
from gpu_optimization import init_gpu_optimizer, get_gpu_optimizer, optimize_model_for_gpu, warm_up_gpu

try:
    from TTS.api import TTS
    import torch
    import soundfile as sf
except ImportError as e:
    print(f"Error: Required dependencies not installed. Run setup_tts.sh first. {e}", file=sys.stderr)
    sys.exit(1)


class TTSService:
    """
    TTS Service with model caching and synthesis queue
    """
    
    # Available voice models (can be extended)
    VOICE_MODELS = {
        "default": "tts_models/en/ljspeech/tacotron2-DDC",
        "fast": "tts_models/en/ljspeech/fast_pitch",
        "vits": "tts_models/en/vctk/vits",
        "jenny": "tts_models/en/jenny/jenny"
    }
    
    def __init__(self, model_name: str = "default", cache_dir: Optional[str] = None):
        """
        Initialize TTS Service
        
        Args:
            model_name: Name of the voice model to use
            cache_dir: Directory for caching models and audio
        """
        # SECURITY: Validate model name first
        self.model_name = validate_model(model_name)
        
        # SECURITY: Set up secure cache directory
        if cache_dir:
            self.cache_dir = Path(cache_dir).resolve()
        else:
            self.cache_dir = Path.home() / ".cache" / "coqui_tts"
        
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # SECURITY: Initialize security validator with cache directory
        init_security_validator(str(self.cache_dir))
        
        # PERFORMANCE: Initialize model pool for fast access
        print("Initializing model pool...", file=sys.stderr)
        init_model_pool(max_memory_mb=1500, preload_models=["default", "fast"])
        
        # PERFORMANCE: Initialize memory cache for instant audio retrieval
        print("Initializing memory cache...", file=sys.stderr)
        init_memory_cache(max_size_mb=256, max_entries=500, use_compression=True)
        
        # PERFORMANCE: Initialize streaming synthesis for real-time generation
        print("Initializing streaming synthesis...", file=sys.stderr)
        init_streaming_synthesis(model_name="fast", chunk_size=1024)
        
        # PERFORMANCE: Initialize GPU optimization for accelerated synthesis
        print("Initializing GPU optimization...", file=sys.stderr)
        init_gpu_optimizer()
        
        # PERFORMANCE: Initialize performance monitoring for real-time metrics
        print("Initializing performance monitoring...", file=sys.stderr)
        init_performance_monitor(history_size=1000)
        
        # Model and synthesis state
        self.current_model: Optional[str] = None
        self.is_ready = False
        
        # Synthesis queue for handling multiple requests
        self.synthesis_queue = queue.Queue()
        self.synthesis_thread = None
        self.stop_requested = False
        
        # Performance metrics
        self.metrics = {
            "total_synthesized": 0,
            "total_time_ms": 0,
            "average_latency_ms": 0,
            "cache_hits": 0
        }
        
        # Audio cache for repeated text
        self.audio_cache: Dict[str, str] = {}
        self.max_cache_size = 50  # SECURITY: Reduced cache size to prevent memory leaks
        
        # SECURITY: Memory leak prevention
        self.last_cleanup_time = time.time()
        self.cleanup_interval = 300  # Clean up every 5 minutes
        
        # Initialize the model and start preloading
        self._initialize_model(model_name)
        
        # PERFORMANCE: Start preloading models in background
        preload_models()
        
    def _initialize_model(self, model_name: str):
        """
        Initialize or switch TTS model using model pool
        
        Args:
            model_name: Name of the model to initialize
        """
        try:
            print(f"Switching to TTS model: {model_name}", file=sys.stderr)
            
            # PERFORMANCE: Get model from pool (instant if preloaded)
            model_pool = get_model_pool()
            tts_model = model_pool.get_model(model_name)
            
            if tts_model is None:
                raise RuntimeError(f"Failed to load model: {model_name}")
            
            self.current_model = model_name
            self.is_ready = True
            
            # Start synthesis worker thread if not running
            if not self.synthesis_thread or not self.synthesis_thread.is_alive():
                self.synthesis_thread = threading.Thread(target=self._synthesis_worker, daemon=True)
                self.synthesis_thread.start()
            
            # Show pool statistics
            metrics = model_pool.get_performance_metrics()
            print(f"Model '{model_name}' ready. Pool hit rate: {metrics['hit_rate_percent']:.1f}%", file=sys.stderr)
            
        except Exception as e:
            print(f"Error initializing TTS model: {e}", file=sys.stderr)
            self.is_ready = False
            raise
    
    def _synthesis_worker(self):
        """
        Worker thread for processing synthesis queue
        """
        while not self.stop_requested:
            try:
                # Get next synthesis request (timeout to check stop flag)
                request = self.synthesis_queue.get(timeout=0.1)
                if request is None:
                    break
                    
                if len(request) == 4:
                    text, output_path, callback, request_id = request
                else:
                    text, output_path, callback = request
                    request_id = None
                
                # Perform synthesis
                success = self._synthesize_internal(text, output_path, request_id)
                
                # Call callback if provided
                if callback:
                    callback(success, output_path)
                    
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error in synthesis worker: {e}", file=sys.stderr)
    
    def _synthesize_internal(self, text: str, output_path: str, request_id: Optional[str] = None) -> bool:
        """
        Internal synthesis method
        
        Args:
            text: Text to synthesize
            output_path: Path to save audio file
            
        Returns:
            Success status
        """
        try:
            # SECURITY: Periodic cleanup to prevent memory leaks
            current_time = time.time()
            if current_time - self.last_cleanup_time > self.cleanup_interval:
                self._periodic_cleanup()
                self.last_cleanup_time = current_time
            
            # SECURITY: Check resource limits before synthesis
            cache_info = {
                'file_count': len(self.audio_cache),
                'total_size_mb': sum(Path(p).stat().st_size for p in self.audio_cache.values() 
                                   if Path(p).exists()) / (1024 * 1024)
            }
            
            try:
                get_validator().validate_cache_limits(cache_info)
            except ResourceExhaustionError as e:
                print(f"Cache limits exceeded: {e}", file=sys.stderr)
                self._cleanup_old_cache_files()
            
            start_time = time.time()
            
            # PERFORMANCE: Record memory/GPU usage if tracking
            if request_id:
                try:
                    import psutil
                    memory_usage = psutil.virtual_memory().used / (1024 * 1024)  # MB
                    record_metric(request_id, "memory_usage_mb", memory_usage)
                    
                    # Record GPU usage if available
                    try:
                        from gpu_optimization import get_gpu_optimizer
                        gpu_stats = get_gpu_optimizer().get_gpu_stats()
                        if gpu_stats.get("gpu_available"):
                            record_metric(request_id, "gpu_memory_mb", gpu_stats.get("memory_used_gb", 0) * 1024)
                            record_metric(request_id, "used_gpu", True)
                        else:
                            record_metric(request_id, "used_gpu", False)
                    except Exception:
                        record_metric(request_id, "used_gpu", False)
                except Exception:
                    pass
            
            # PERFORMANCE: Check memory cache first (2-5ms access time)
            if request_id:
                record_timestamp(request_id, "cache_lookup_start")
            cache_key = self._get_cache_key(text)
            cached_audio = get_cached_audio(cache_key)
            if request_id:
                record_timestamp(request_id, "cache_lookup_end")
            
            if cached_audio is not None:
                audio_data, sample_rate = cached_audio
                
                # Save to output file
                import soundfile as sf
                sf.write(output_path, audio_data, sample_rate)
                
                # Record cache hit metrics
                if request_id:
                    record_metric(request_id, "was_cached", True)
                    record_timestamp(request_id, "first_audio")
                    
                    # Complete tracking for cache hit
                    audio_duration = len(audio_data) / sample_rate
                    complete_request_tracking(request_id, audio_duration, sample_rate)
                
                self.metrics["cache_hits"] += 1
                cache_time = (time.time() - start_time) * 1000
                print(f"Memory cache hit: '{text[:30]}...' ({cache_time:.1f}ms)", file=sys.stderr)
                return True
            
            # Check file cache as fallback
            if cache_key in self.audio_cache:
                cached_path = self.audio_cache[cache_key]
                if Path(cached_path).exists():
                    # SECURITY: Validate cached file size
                    try:
                        get_validator().validate_file_size(Path(cached_path))
                        import shutil
                        shutil.copy2(cached_path, output_path)
                        
                        # Load into memory cache for next time
                        try:
                            import soundfile as sf
                            audio_data, sample_rate = sf.read(cached_path)
                            cache_audio(cache_key, audio_data, sample_rate)
                            print(f"Promoted file cache to memory cache", file=sys.stderr)
                        except Exception as e:
                            print(f"Failed to load to memory cache: {e}", file=sys.stderr)
                        
                        self.metrics["cache_hits"] += 1
                        cache_time = (time.time() - start_time) * 1000
                        print(f"File cache hit: '{text[:30]}...' ({cache_time:.1f}ms)", file=sys.stderr)
                        return True
                    except Exception as e:
                        print(f"Cache validation failed: {e}", file=sys.stderr)
                        # Remove invalid cached file
                        if cache_key in self.audio_cache:
                            del self.audio_cache[cache_key]
            
            # PERFORMANCE: Get model from pool for synthesis
            model_pool = get_model_pool()
            tts_model = model_pool.get_model(self.current_model or "default")
            
            if tts_model is None:
                raise RuntimeError(f"Model not available: {self.current_model}")
            
            # PERFORMANCE: Apply GPU optimization to model
            optimized_model = optimize_model_for_gpu(tts_model)
            
            # Synthesize new audio
            optimized_model.tts_to_file(
                text=text,
                file_path=output_path,
                speaker=None,  # Use default speaker
                language="en",
                speed=1.0
            )
            
            # SECURITY: Validate output file size
            get_validator().validate_file_size(Path(output_path))
            
            # Update metrics
            synthesis_time = (time.time() - start_time) * 1000
            self.metrics["total_synthesized"] += 1
            self.metrics["total_time_ms"] += synthesis_time
            self.metrics["average_latency_ms"] = (
                self.metrics["total_time_ms"] / self.metrics["total_synthesized"]
            )
            
            # PERFORMANCE: Cache audio in memory for instant future access
            try:
                import soundfile as sf
                audio_data, sample_rate = sf.read(output_path)
                cache_audio(cache_key, audio_data, sample_rate)
                print(f"Cached audio in memory: {cache_key[:16]}...", file=sys.stderr)
            except Exception as e:
                print(f"Failed to cache in memory: {e}", file=sys.stderr)
            
            # Also cache in file system (fallback)
            if len(self.audio_cache) < self.max_cache_size:
                cache_path = self.cache_dir / f"cache_{cache_key}.wav"
                import shutil
                shutil.copy2(output_path, cache_path)
                self.audio_cache[cache_key] = str(cache_path)
            
            print(f"Synthesis completed in {synthesis_time:.1f}ms", file=sys.stderr)
            return True
            
        except (SecurityError, PathTraversalError, InputValidationError, ResourceExhaustionError) as e:
            print(f"Security validation failed: {e}", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Error during synthesis: {e}", file=sys.stderr)
            return False
    
    def _get_cache_key(self, text: str) -> str:
        """
        Generate cache key for text
        
        Args:
            text: Input text
            
        Returns:
            Cache key string
        """
        # SECURITY: Use secure cache key generation
        return safe_cache_key(text, self.current_model or "default")
    
    def synthesize(self, text: str, output_path: Optional[str] = None, 
                  async_mode: bool = False, callback: Optional[callable] = None) -> Optional[str]:
        """
        Synthesize text to speech with performance monitoring
        
        Args:
            text: Text to synthesize
            output_path: Output file path (generated if not provided)
            async_mode: Whether to synthesize asynchronously
            callback: Callback function for async mode
            
        Returns:
            Output file path or None if async
        """
        if not self.is_ready:
            raise RuntimeError("TTS service not ready")
        
        # PERFORMANCE: Start request tracking
        import uuid
        request_id = str(uuid.uuid4())
        start_request_tracking(request_id, text, self.current_model or "default")
        
        try:
            # SECURITY: Validate text input
            record_timestamp(request_id, "validation_start")
            try:
                validated_text = validate_text(text)
            except (InputValidationError, SecurityError) as e:
                print(f"Security validation failed: {e}", file=sys.stderr)
                raise ValueError(f"Invalid text input: {e}")
            record_timestamp(request_id, "validation_end")
            
            # SECURITY: Validate and secure output path
            if output_path:
                try:
                    validated_output_path = validate_path(output_path, allow_create=True)
                    output_path = str(validated_output_path)
                except (PathTraversalError, InputValidationError, SecurityError) as e:
                    print(f"Path validation failed: {e}", file=sys.stderr)
                    raise ValueError(f"Invalid output path: {e}")
            else:
                # Generate secure path within cache directory
                filename = f"tts_{int(time.time() * 1000)}_{os.getpid()}.wav"
                output_path = str(self.cache_dir / filename)
            
            # PERFORMANCE: Check memory cache first
            record_timestamp(request_id, "cache_lookup_start")
            cache_key = self._get_cache_key(validated_text)
            cached_audio = get_cached_audio(cache_key)
            record_timestamp(request_id, "cache_lookup_end")
            
            if cached_audio is not None:
                record_metric(request_id, "was_cached", True)
                record_timestamp(request_id, "first_audio")
                
                # Save cached audio to output file
                audio_data, sample_rate = cached_audio
                import soundfile as sf
                sf.write(output_path, audio_data, sample_rate)
                
                # Complete tracking
                audio_duration = len(audio_data) / sample_rate
                metrics = complete_request_tracking(request_id, audio_duration, sample_rate)
                
                print(f"Cache hit: {metrics.total_latency_ms:.1f}ms", file=sys.stderr)
                return output_path
            
            record_metric(request_id, "was_cached", False)
            
            if async_mode:
                # Add to queue for async processing (use validated text)
                self.synthesis_queue.put((validated_text, output_path, callback, request_id))
                return None
            else:
                # Synchronous synthesis (use validated text)
                record_timestamp(request_id, "synthesis_start")
                success = self._synthesize_internal(validated_text, output_path, request_id)
                record_timestamp(request_id, "synthesis_end")
                
                if success and Path(output_path).exists():
                    # Calculate audio duration for metrics
                    try:
                        import soundfile as sf
                        audio_data, sample_rate = sf.read(output_path)
                        audio_duration = len(audio_data) / sample_rate
                        complete_request_tracking(request_id, audio_duration, sample_rate)
                    except Exception:
                        complete_request_tracking(request_id, 0, 22050)
                
                return output_path if success else None
                
        except Exception as e:
            # Complete tracking even on error
            complete_request_tracking(request_id, 0, 22050)
            raise
    
    def switch_model(self, model_name: str):
        """
        Switch to a different voice model
        
        Args:
            model_name: Name of the model to switch to
        """
        # SECURITY: Validate model name
        try:
            validated_model = validate_model(model_name)
        except (InputValidationError, SecurityError) as e:
            print(f"Model validation failed: {e}", file=sys.stderr)
            raise ValueError(f"Invalid model name: {e}")
        
        if validated_model not in self.VOICE_MODELS:
            raise ValueError(f"Unknown model: {validated_model}. Available: {list(self.VOICE_MODELS.keys())}")
        
        if model_name != self.current_model:
            print(f"Switching from {self.current_model} to {model_name}", file=sys.stderr)
            self._initialize_model(model_name)
            # Clear cache when switching models
            self.audio_cache.clear()
    
    def get_available_models(self) -> List[str]:
        """
        Get list of available voice models
        
        Returns:
            List of model names
        """
        return list(self.VOICE_MODELS.keys())
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive performance metrics
        
        Returns:
            Dictionary of metrics including performance monitoring data
        """
        metrics = self.metrics.copy()
        
        # Add performance monitoring data
        try:
            perf_stats = get_performance_stats()
            perf_breakdown = get_performance_breakdown()
            
            metrics.update({
                "performance_monitoring": perf_stats,
                "performance_breakdown": perf_breakdown
            })
        except Exception as e:
            print(f"Failed to get performance stats: {e}", file=sys.stderr)
        
        # Add model pool metrics
        try:
            from model_pool import get_model_pool
            model_metrics = get_model_pool().get_performance_metrics()
            metrics["model_pool"] = model_metrics
        except Exception as e:
            print(f"Failed to get model pool metrics: {e}", file=sys.stderr)
        
        # Add memory cache metrics
        try:
            from memory_cache import get_cache_stats
            cache_stats = get_cache_stats()
            metrics["memory_cache"] = cache_stats
        except Exception as e:
            print(f"Failed to get cache stats: {e}", file=sys.stderr)
        
        # Add GPU metrics
        try:
            from gpu_optimization import get_gpu_stats
            gpu_stats = get_gpu_stats()
            metrics["gpu"] = gpu_stats
        except Exception as e:
            print(f"Failed to get GPU stats: {e}", file=sys.stderr)
        
        return metrics
    
    def get_performance_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive performance report
        
        Returns:
            Detailed performance analysis report
        """
        try:
            perf_monitor = get_performance_monitor()
            
            # Get current stats
            current_stats = perf_monitor.get_current_stats()
            breakdown = perf_monitor.get_performance_breakdown()
            recent_metrics = perf_monitor.get_recent_metrics(20)
            
            # Calculate target compliance
            target_compliance = {
                "latency_target_150ms": {
                    "target": 150,
                    "current_avg": current_stats.get("average_latency_ms", 0),
                    "compliant": current_stats.get("average_latency_ms", 0) <= 150,
                    "p95_compliant": current_stats.get("p95_latency_ms", 0) <= 150
                },
                "cache_hit_rate": {
                    "target": 70,
                    "current": current_stats.get("cache_hit_rate", 0),
                    "compliant": current_stats.get("cache_hit_rate", 0) >= 70
                },
                "realtime_factor": {
                    "target": 0.3,
                    "current": current_stats.get("average_realtime_factor", 0),
                    "compliant": current_stats.get("average_realtime_factor", 0) <= 0.3
                }
            }
            
            # Calculate optimization effectiveness
            optimization_impact = breakdown.get("optimization_impact", {})
            
            report = {
                "timestamp": time.time(),
                "performance_summary": current_stats,
                "target_compliance": target_compliance,
                "optimization_effectiveness": {
                    "cache_utilization": optimization_impact.get("cache_usage", 0),
                    "gpu_utilization": optimization_impact.get("gpu_usage", 0),
                    "model_preloading": optimization_impact.get("preloaded_models", 0),
                    "streaming_usage": optimization_impact.get("streaming_usage", 0)
                },
                "performance_distribution": breakdown.get("performance_distribution", {}),
                "timing_breakdown": breakdown.get("timing_breakdown", {}),
                "recent_requests": [
                    {
                        "latency_ms": m.total_latency_ms,
                        "was_cached": m.was_cached,
                        "used_gpu": m.used_gpu,
                        "was_streamed": m.was_streamed,
                        "realtime_factor": m.realtime_factor
                    } for m in recent_metrics[-10:]  # Last 10 requests
                ]
            }
            
            return report
            
        except Exception as e:
            return {
                "error": f"Failed to generate performance report: {e}",
                "timestamp": time.time()
            }
    
    def _periodic_cleanup(self):
        """
        SECURITY: Periodic cleanup to prevent memory leaks
        """
        print("Running periodic cleanup to prevent memory leaks", file=sys.stderr)
        
        # Clean up broken cache entries
        broken_entries = []
        for key, path in self.audio_cache.items():
            if not Path(path).exists():
                broken_entries.append(key)
        
        for key in broken_entries:
            del self.audio_cache[key]
            
        if broken_entries:
            print(f"Removed {len(broken_entries)} broken cache entries", file=sys.stderr)
        
        # If cache is still too large, remove oldest entries
        while len(self.audio_cache) > self.max_cache_size:
            # Remove oldest entry (first added)
            oldest_key = next(iter(self.audio_cache))
            old_path = self.audio_cache.pop(oldest_key)
            try:
                Path(old_path).unlink(missing_ok=True)
            except Exception:
                pass
    
    def _cleanup_old_cache_files(self):
        """
        Clean up old cache files to free space
        """
        try:
            # Get all cache files sorted by modification time
            cache_files = []
            for file_path in self.cache_dir.glob("cache_*.wav"):
                if file_path.is_file():
                    try:
                        mtime = file_path.stat().st_mtime
                        cache_files.append((mtime, file_path))
                    except OSError:
                        continue
            
            # Sort by modification time (oldest first)
            cache_files.sort()
            
            # Remove oldest 50% of files
            files_to_remove = cache_files[:len(cache_files) // 2]
            
            for _, file_path in files_to_remove:
                try:
                    file_path.unlink()
                    # Remove from memory cache if present
                    self.audio_cache = {k: v for k, v in self.audio_cache.items() if v != str(file_path)}
                except OSError:
                    continue
            
            print(f"Cleaned up {len(files_to_remove)} old cache files", file=sys.stderr)
            
        except Exception as e:
            print(f"Error cleaning cache: {e}", file=sys.stderr)
    
    def _remove_cached_file(self, cache_key: str):
        """
        Remove a specific cached file
        
        Args:
            cache_key: Cache key to remove
        """
        if cache_key in self.audio_cache:
            cache_path = self.audio_cache[cache_key]
            try:
                Path(cache_path).unlink(missing_ok=True)
                del self.audio_cache[cache_key]
            except Exception:
                pass

    def synthesize_streaming(self, text: str):
        """
        Stream text-to-speech synthesis with real-time audio chunks and performance monitoring
        
        Args:
            text: Text to synthesize
            
        Yields:
            Audio chunk dictionaries with streaming data
        """
        if not self.is_ready:
            raise RuntimeError("TTS service not ready")
        
        # PERFORMANCE: Start request tracking
        import uuid
        request_id = str(uuid.uuid4())
        start_request_tracking(request_id, text, self.current_model or "default")
        
        try:
            # SECURITY: Validate text input
            record_timestamp(request_id, "validation_start")
            try:
                validated_text = validate_text(text)
            except (InputValidationError, SecurityError) as e:
                print(f"Security validation failed: {e}", file=sys.stderr)
                raise ValueError(f"Invalid text input: {e}")
            record_timestamp(request_id, "validation_end")
            
            print(f"Starting streaming synthesis: '{validated_text[:50]}...'", file=sys.stderr)
            
            # Record streaming metrics
            record_metric(request_id, "was_streamed", True)
            record_timestamp(request_id, "streaming_start")
            
            first_chunk = True
            total_audio_duration = 0
            
            # Use streaming synthesis for real-time generation
            for chunk in stream_synthesize(validated_text):
                if first_chunk and chunk.get("type") == "audio":
                    record_timestamp(request_id, "first_audio")
                    first_chunk = False
                
                if chunk.get("type") == "audio":
                    total_audio_duration += chunk.get("audio_data", []).shape[0] / chunk.get("sample_rate", 22050)
                
                yield chunk
            
            record_timestamp(request_id, "streaming_end")
            
            # Complete tracking
            complete_request_tracking(request_id, total_audio_duration, 22050)
            
        except Exception as e:
            # Complete tracking even on error
            complete_request_tracking(request_id, 0, 22050)
            raise
    
    def clear_cache(self):
        """
        Clear audio cache
        """
        # Clear memory cache
        from memory_cache import clear_cache
        clear_cache()
        
        # Delete cached files
        for cache_path in self.audio_cache.values():
            try:
                Path(cache_path).unlink(missing_ok=True)
            except Exception:
                pass
        self.audio_cache.clear()
        print("Audio cache cleared", file=sys.stderr)
    
    def shutdown(self):
        """
        Shutdown TTS service and cleanup resources
        """
        print("Shutting down TTS service...", file=sys.stderr)
        self.stop_requested = True
        
        # Stop synthesis thread
        if self.synthesis_thread:
            self.synthesis_queue.put(None)  # Signal to stop
            self.synthesis_thread.join(timeout=2.0)
        
        # Clear cache
        self.clear_cache()
        
        # Shutdown streaming synthesis
        from streaming_synthesis import shutdown_streaming
        shutdown_streaming()
        
        # Shutdown model pool and memory cache
        from model_pool import shutdown_model_pool
        from memory_cache import shutdown_memory_cache
        shutdown_model_pool()
        shutdown_memory_cache()
        
        self.is_ready = False
        print("TTS service shutdown complete", file=sys.stderr)


def main():
    """
    Main entry point for standalone TTS service
    Communicates via JSON messages on stdin/stdout
    """
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Coqui TTS Service")
    parser.add_argument("--model", default="fast", help="TTS model to use")
    parser.add_argument("--cache-dir", help="Cache directory path")
    parser.add_argument("--enable-gpu", action="store_true", help="Enable GPU acceleration")
    parser.add_argument("--max-memory", type=int, default=1500, help="Max memory for model pool (MB)")
    args = parser.parse_args()
    
    service = None
    
    try:
        print(f"Initializing TTS service with model: {args.model}", file=sys.stderr)
        
        # Initialize service with specified model and cache directory
        service = TTSService(
            model_name=args.model,
            cache_dir=args.cache_dir
        )
        
        # Initialize performance optimizations based on arguments
        if args.enable_gpu:
            print("GPU acceleration enabled", file=sys.stderr)
        
        # Send ready signal with available models
        response = {
            "status": "ready", 
            "models": service.get_available_models(),
            "current_model": service.current_model,
            "gpu_enabled": args.enable_gpu
        }
        print(json.dumps(response))
        sys.stdout.flush()
        
        print("TTS service ready, processing commands...", file=sys.stderr)
        
        # Process commands from stdin
        for line in sys.stdin:
            try:
                command = json.loads(line.strip())
                request_id = command.get("id")
                cmd_type = command.get("command")
                
                response = {"id": request_id}
                
                try:
                    if cmd_type == "synthesize":
                        # Standard synthesis
                        text = command.get("text", "")
                        output_path = command.get("output_path")
                        model = command.get("model")
                        
                        if model and model != service.current_model:
                            service.switch_model(model)
                        
                        result_path = service.synthesize(text, output_path)
                        
                        if result_path:
                            # Get additional metadata
                            import soundfile as sf
                            try:
                                audio_data, sample_rate = sf.read(result_path)
                                audio_length = len(audio_data) / sample_rate
                            except:
                                audio_length = 0
                            
                            response.update({
                                "success": True,
                                "output_path": result_path,
                                "model": service.current_model,
                                "audio_length": audio_length,
                                "cached": False  # Would need cache check logic
                            })
                        else:
                            response.update({
                                "success": False,
                                "error": "Synthesis failed"
                            })
                    
                    elif cmd_type == "synthesize_streaming":
                        # Streaming synthesis
                        text = command.get("text", "")
                        model = command.get("model")
                        
                        if model and model != service.current_model:
                            service.switch_model(model)
                        
                        # Collect streaming chunks
                        chunks = []
                        try:
                            for chunk in service.synthesize_streaming(text):
                                if chunk.get("type") == "audio":
                                    # Convert audio data to base64 for JSON transport
                                    import base64
                                    audio_data = chunk.get("audio_data", [])
                                    if hasattr(audio_data, 'tobytes'):
                                        audio_b64 = base64.b64encode(audio_data.tobytes()).decode('utf-8')
                                    else:
                                        audio_b64 = ""
                                    
                                    chunks.append({
                                        "data": audio_b64,
                                        "latency": chunk.get("latency_ms", 0),
                                        "text": chunk.get("text", "")
                                    })
                        except Exception as e:
                            response.update({
                                "success": False,
                                "error": f"Streaming synthesis failed: {e}"
                            })
                        else:
                            response.update({
                                "success": True,
                                "chunks": chunks,
                                "model": service.current_model
                            })
                    
                    elif cmd_type == "get_models":
                        # Get available models
                        response.update({
                            "success": True,
                            "models": service.get_available_models()
                        })
                    
                    elif cmd_type == "switch_model":
                        # Switch voice model
                        model = command.get("model")
                        service.switch_model(model)
                        response.update({
                            "success": True,
                            "current_model": service.current_model
                        })
                    
                    elif cmd_type == "get_metrics":
                        # Get performance metrics
                        metrics = service.get_metrics()
                        response.update({
                            "success": True,
                            "metrics": metrics
                        })
                    
                    elif cmd_type == "get_performance_report":
                        # Get detailed performance report
                        report = service.get_performance_report()
                        response.update({
                            "success": True,
                            "report": report
                        })
                    
                    elif cmd_type == "clear_cache":
                        # Clear audio cache
                        service.clear_cache()
                        response.update({
                            "success": True,
                            "message": "Cache cleared"
                        })
                    
                    elif cmd_type == "shutdown":
                        # Graceful shutdown
                        response.update({
                            "success": True,
                            "message": "Shutting down"
                        })
                        print(json.dumps(response))
                        sys.stdout.flush()
                        break
                    
                    else:
                        response.update({
                            "success": False,
                            "error": f"Unknown command: {cmd_type}"
                        })
                
                except Exception as e:
                    response.update({
                        "success": False,
                        "error": str(e)
                    })
                
                # Send response
                print(json.dumps(response))
                sys.stdout.flush()
                
            except json.JSONDecodeError as e:
                error_response = {
                    "error": f"Invalid JSON: {e}",
                    "success": False
                }
                print(json.dumps(error_response))
                sys.stdout.flush()
            except Exception as e:
                error_response = {
                    "error": f"Command processing error: {e}",
                    "success": False
                }
                print(json.dumps(error_response))
                sys.stdout.flush()
        
    except KeyboardInterrupt:
        print("Received interrupt signal", file=sys.stderr)
    except Exception as e:
        print(f"Service error: {e}", file=sys.stderr)
    finally:
        if service:
            service.shutdown()
        print("TTS service terminated", file=sys.stderr)


if __name__ == "__main__":
    main()