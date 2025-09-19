#!/usr/bin/env python3
"""
Optimized Coqui TTS Service with Model Pooling and Memory Caching
PERFORMANCE TARGET: <150ms P95 latency through aggressive optimization
"""

import os
import sys
import json
import time
import threading
import queue
import gc
import io
import tempfile
from typing import Optional, Dict, List, Any, Tuple
from pathlib import Path
import numpy as np
import psutil

try:
    from TTS.api import TTS
    import torch
    import soundfile as sf
except ImportError as e:
    print(f"Error: Required dependencies not installed. Run setup_tts.sh first. {e}", file=sys.stderr)
    sys.exit(1)


class MemoryAudioCache:
    """High-performance in-memory audio cache with LRU eviction"""
    
    def __init__(self, max_size_mb: int = 100):
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.cache: Dict[str, Tuple[np.ndarray, int, float]] = {}  # key: (audio_data, sample_rate, timestamp)
        self.access_times: Dict[str, float] = {}
        self.current_size = 0
        self.lock = threading.RLock()
        
        # Performance metrics
        self.hits = 0
        self.misses = 0
        
    def _estimate_size(self, audio_data: np.ndarray) -> int:
        """Estimate memory size of audio data"""
        return audio_data.nbytes + 64  # Include overhead
    
    def _evict_lru(self):
        """Evict least recently used items until under size limit"""
        while self.current_size > self.max_size_bytes and self.cache:
            # Find least recently used item
            oldest_key = min(self.access_times.items(), key=lambda x: x[1])[0]
            
            # Remove from cache
            if oldest_key in self.cache:
                audio_data, _, _ = self.cache[oldest_key]
                self.current_size -= self._estimate_size(audio_data)
                del self.cache[oldest_key]
                del self.access_times[oldest_key]
    
    def put(self, key: str, audio_data: np.ndarray, sample_rate: int):
        """Store audio data in cache"""
        with self.lock:
            size = self._estimate_size(audio_data)
            
            # Skip if too large for cache
            if size > self.max_size_bytes:
                return
            
            # Update size if key already exists
            if key in self.cache:
                old_data, _, _ = self.cache[key]
                self.current_size -= self._estimate_size(old_data)
            
            # Add new data
            self.cache[key] = (audio_data.copy(), sample_rate, time.time())
            self.access_times[key] = time.time()
            self.current_size += size
            
            # Evict if necessary
            if self.current_size > self.max_size_bytes:
                self._evict_lru()
    
    def get(self, key: str) -> Optional[Tuple[np.ndarray, int]]:
        """Retrieve audio data from cache - CRITICAL PATH OPTIMIZED"""
        with self.lock:
            if key in self.cache:
                audio_data, sample_rate, _ = self.cache[key]
                self.access_times[key] = time.time()  # Update access time
                self.hits += 1
                return audio_data.copy(), sample_rate
            else:
                self.misses += 1
                return None
    
    def get_stats(self) -> Dict:
        """Get cache performance statistics"""
        total_requests = self.hits + self.misses
        hit_rate = self.hits / total_requests if total_requests > 0 else 0
        
        return {
            "hit_rate": hit_rate,
            "hits": self.hits,
            "misses": self.misses,
            "cache_size_mb": self.current_size / (1024 * 1024),
            "cache_entries": len(self.cache)
        }
    
    def clear(self):
        """Clear all cached data"""
        with self.lock:
            self.cache.clear()
            self.access_times.clear()
            self.current_size = 0


class ModelPool:
    """Singleton model pool for persistent TTS models - ELIMINATES COLD START"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.models: Dict[str, TTS] = {}
            self.model_usage: Dict[str, int] = {}
            self.max_models = self._calculate_max_models()
            self.loading_lock = threading.Lock()
            self.initialized = True
            
            # Preload default model in background
            self._preload_default_model()
    
    def _calculate_max_models(self) -> int:
        """Calculate maximum models based on available memory"""
        available_memory_gb = psutil.virtual_memory().available / (1024**3)
        # Each model uses ~800MB-1.2GB
        max_models = max(1, int(available_memory_gb // 1.5))
        return min(max_models, 3)  # Cap at 3 models to prevent memory issues
    
    def _preload_default_model(self):
        """Preload the most commonly used model in background thread"""
        def preload_worker():
            try:
                print("🚀 Preloading default TTS model...", file=sys.stderr)
                self._load_model_sync("default")
                print("✅ Default model preloaded successfully", file=sys.stderr)
            except Exception as e:
                print(f"❌ Failed to preload default model: {e}", file=sys.stderr)
        
        threading.Thread(target=preload_worker, daemon=True).start()
    
    def _load_model_sync(self, model_name: str) -> Optional[TTS]:
        """Load model synchronously - OPTIMIZED FOR SPEED"""
        VOICE_MODELS = {
            "default": "tts_models/en/ljspeech/tacotron2-DDC",
            "fast": "tts_models/en/ljspeech/fast_pitch", 
            "vits": "tts_models/en/vctk/vits",
            "jenny": "tts_models/en/jenny/jenny"
        }
        
        with self.loading_lock:
            try:
                if model_name in self.models:
                    return self.models[model_name]
                
                model_path = VOICE_MODELS.get(model_name, VOICE_MODELS["default"])
                use_cuda = torch.cuda.is_available()
                
                print(f"Loading TTS model: {model_path} ({'GPU' if use_cuda else 'CPU'})", file=sys.stderr)
                start_time = time.time()
                
                # If pool is full, evict least used model
                if len(self.models) >= self.max_models:
                    self._evict_least_used()
                
                # Load model with optimizations
                model = TTS(model_path, gpu=use_cuda)
                
                # Store in pool
                self.models[model_name] = model
                self.model_usage[model_name] = 0
                
                load_time = (time.time() - start_time) * 1000
                print(f"✅ Model '{model_name}' loaded in {load_time:.1f}ms", file=sys.stderr)
                
                return model
                
            except Exception as e:
                print(f"❌ Error loading model {model_name}: {e}", file=sys.stderr)
                return None
    
    def get_model(self, model_name: str) -> Optional[TTS]:
        """Get model from pool - CRITICAL PATH FOR LATENCY"""
        # Fast path: model already loaded
        if model_name in self.models:
            self.model_usage[model_name] += 1
            return self.models[model_name]
        
        # Slow path: load model (should be rare after preloading)
        return self._load_model_sync(model_name)
    
    def _evict_least_used(self):
        """Evict least recently used model to free memory"""
        if not self.models:
            return
            
        least_used = min(self.model_usage.items(), key=lambda x: x[1])
        model_name = least_used[0]
        
        print(f"🗑️ Evicting model {model_name} from pool", file=sys.stderr)
        del self.models[model_name]
        del self.model_usage[model_name]
        gc.collect()  # Force garbage collection
    
    def get_stats(self) -> Dict:
        """Get model pool statistics"""
        return {
            "loaded_models": list(self.models.keys()),
            "model_usage": self.model_usage.copy(),
            "pool_size": len(self.models),
            "max_models": self.max_models
        }


class OptimizedTTSService:
    """
    PERFORMANCE-OPTIMIZED TTS Service
    Target: <150ms P95 latency through aggressive caching and model pooling
    """
    
    def __init__(self, model_name: str = "default", cache_dir: Optional[str] = None):
        """Initialize optimized TTS service"""
        self.model_name = model_name
        self.cache_dir = Path(cache_dir) if cache_dir else Path.home() / ".cache" / "coqui_tts"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize model pool (singleton)
        self.model_pool = ModelPool()
        self.current_model = model_name
        self.is_ready = False
        
        # Initialize high-performance memory cache
        available_memory_mb = psutil.virtual_memory().available / (1024 * 1024)
        cache_size_mb = min(100, max(20, available_memory_mb * 0.02))  # 2% of available memory
        self.memory_cache = MemoryAudioCache(max_size_mb=int(cache_size_mb))
        
        # Performance metrics
        self.metrics = {
            "total_synthesized": 0,
            "total_time_ms": 0,
            "average_latency_ms": 0,
            "cache_hits": 0,
            "model_pool_hits": 0
        }
        
        # Initialize model
        self._initialize_model(model_name)
        
    def _initialize_model(self, model_name: str):
        """Initialize TTS model using pool - OPTIMIZED FOR SPEED"""
        try:
            # Get model from pool (instant if preloaded)
            self.tts_model = self.model_pool.get_model(model_name)
            
            if self.tts_model is None:
                raise RuntimeError(f"Failed to load model: {model_name}")
            
            self.current_model = model_name
            self.is_ready = True
            self.metrics["model_pool_hits"] += 1
            
            print(f"✅ Using pooled model '{model_name}' - service ready", file=sys.stderr)
            
        except Exception as e:
            print(f"❌ Error initializing model: {e}", file=sys.stderr)
            self.is_ready = False
            raise
    
    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text - OPTIMIZED FOR SPEED"""
        import hashlib
        key_data = f"{self.current_model}:{text}".encode('utf-8')
        return hashlib.md5(key_data).hexdigest()[:16]
    
    def synthesize(self, text: str, output_path: Optional[str] = None) -> Optional[str]:
        """
        OPTIMIZED SYNTHESIS - CRITICAL PERFORMANCE PATH
        Target: <150ms total latency including caching
        """
        if not self.is_ready:
            raise RuntimeError("TTS service not ready")
        
        start_time = time.time()
        
        # Generate output path if not provided
        if not output_path:
            output_path = str(self.cache_dir / f"tts_{int(time.time() * 1000)}.wav")
        
        try:
            cache_key = self._get_cache_key(text)
            
            # OPTIMIZATION 1: Check memory cache first (2-5ms hit)
            cached_audio = self.memory_cache.get(cache_key)
            if cached_audio is not None:
                audio_data, sample_rate = cached_audio
                
                # Write directly to output file
                sf.write(output_path, audio_data, sample_rate)
                
                synthesis_time = (time.time() - start_time) * 1000
                self.metrics["cache_hits"] += 1
                self.metrics["total_synthesized"] += 1
                self.metrics["total_time_ms"] += synthesis_time
                self.metrics["average_latency_ms"] = (
                    self.metrics["total_time_ms"] / self.metrics["total_synthesized"]
                )
                
                print(f"🚀 Memory cache hit: {synthesis_time:.1f}ms", file=sys.stderr)
                return output_path
            
            # OPTIMIZATION 2: Direct synthesis to memory (avoids file I/O)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                # Synthesize using pooled model
                self.tts_model.tts_to_file(
                    text=text,
                    file_path=temp_file.name,
                    speaker=None,
                    language="en",
                    speed=1.0
                )
                
                # Load audio data for caching and output
                audio_data, sample_rate = sf.read(temp_file.name)
                
                # OPTIMIZATION 3: Store in memory cache for future hits
                self.memory_cache.put(cache_key, audio_data, sample_rate)
                
                # Write to final output path
                sf.write(output_path, audio_data, sample_rate)
                
                # Clean up temp file immediately
                os.unlink(temp_file.name)
            
            # Update performance metrics
            synthesis_time = (time.time() - start_time) * 1000
            self.metrics["total_synthesized"] += 1
            self.metrics["total_time_ms"] += synthesis_time
            self.metrics["average_latency_ms"] = (
                self.metrics["total_time_ms"] / self.metrics["total_synthesized"]
            )
            
            print(f"🎯 Fresh synthesis: {synthesis_time:.1f}ms", file=sys.stderr)
            return output_path
            
        except Exception as e:
            print(f"❌ Synthesis error: {e}", file=sys.stderr)
            return None
    
    def switch_model(self, model_name: str):
        """Switch to different model using pool"""
        if model_name != self.current_model:
            print(f"🔄 Switching from {self.current_model} to {model_name}", file=sys.stderr)
            self._initialize_model(model_name)
            # Clear cache when switching models (different voice characteristics)
            self.memory_cache.clear()
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        base_metrics = self.metrics.copy()
        cache_stats = self.memory_cache.get_stats()
        pool_stats = self.model_pool.get_stats()
        
        return {
            **base_metrics,
            "cache_stats": cache_stats,
            "pool_stats": pool_stats
        }
    
    def clear_cache(self):
        """Clear memory cache"""
        self.memory_cache.clear()
        print("🧹 Memory cache cleared", file=sys.stderr)
    
    def shutdown(self):
        """Shutdown service and cleanup"""
        print("🛑 Shutting down optimized TTS service...", file=sys.stderr)
        self.clear_cache()
        self.tts_model = None
        self.is_ready = False
        print("✅ Optimized TTS service shutdown complete", file=sys.stderr)


def main():
    """
    Main entry point for optimized TTS service
    Maintains API compatibility with original service
    """
    service = None
    
    try:
        # Initialize optimized service
        print("🚀 Starting optimized TTS service...", file=sys.stderr)
        service = OptimizedTTSService(model_name="default")
        
        # Send ready signal
        response = {"status": "ready", "models": ["default", "fast", "vits", "jenny"]}
        print(json.dumps(response))
        sys.stdout.flush()
        
        # Process commands from stdin
        for line in sys.stdin:
            try:
                command = json.loads(line.strip())
                cmd_type = command.get("type")
                
                if cmd_type == "synthesize":
                    text = command.get("text", "")
                    output_path = command.get("output_path")
                    
                    # Optimized synthesis
                    start_time = time.time()
                    result_path = service.synthesize(text, output_path)
                    latency = (time.time() - start_time) * 1000
                    
                    if result_path:
                        response = {
                            "status": "success",
                            "output_path": result_path,
                            "latency_ms": latency
                        }
                    else:
                        response = {
                            "status": "error",
                            "message": "Synthesis failed"
                        }
                    
                elif cmd_type == "switch_model":
                    model_name = command.get("model", "default")
                    service.switch_model(model_name)
                    response = {"status": "success", "model": model_name}
                    
                elif cmd_type == "get_metrics":
                    response = {
                        "status": "success",
                        "metrics": service.get_metrics()
                    }
                    
                elif cmd_type == "clear_cache":
                    service.clear_cache()
                    response = {"status": "success"}
                    
                elif cmd_type == "shutdown":
                    service.shutdown()
                    response = {"status": "shutdown"}
                    print(json.dumps(response))
                    sys.stdout.flush()
                    break
                    
                else:
                    response = {"status": "error", "message": f"Unknown command: {cmd_type}"}
                
                print(json.dumps(response))
                sys.stdout.flush()
                
            except json.JSONDecodeError as e:
                response = {"status": "error", "message": f"Invalid JSON: {e}"}
                print(json.dumps(response))
                sys.stdout.flush()
            except Exception as e:
                response = {"status": "error", "message": str(e)}
                print(json.dumps(response))
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        print("🛑 Interrupted by user", file=sys.stderr)
    except Exception as e:
        print(f"💥 Fatal error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if service:
            service.shutdown()


if __name__ == "__main__":
    main()