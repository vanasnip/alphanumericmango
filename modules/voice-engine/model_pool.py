#!/usr/bin/env python3
"""
Model Pool Manager
High-performance model loading and caching for Coqui TTS
"""

import os
import sys
import time
import threading
import queue
from typing import Dict, Optional, List, Any
from pathlib import Path
import logging

try:
    from TTS.api import TTS
    import torch
    import gc
except ImportError as e:
    print(f"Error: Required dependencies not installed. {e}", file=sys.stderr)
    sys.exit(1)

from security_validators import validate_model, get_validator

class ModelPool:
    """
    High-performance model pool with preloading and memory management
    """
    
    # Available models with performance characteristics
    MODEL_CONFIGS = {
        "default": {
            "path": "tts_models/en/ljspeech/tacotron2-DDC",
            "priority": 1,  # Load first
            "memory_mb": 400,
            "latency_ms": 120
        },
        "fast": {
            "path": "tts_models/en/ljspeech/fast_pitch", 
            "priority": 2,
            "memory_mb": 300,
            "latency_ms": 80
        },
        "vits": {
            "path": "tts_models/en/vctk/vits",
            "priority": 3,
            "memory_mb": 600,
            "latency_ms": 150
        },
        "jenny": {
            "path": "tts_models/en/jenny/jenny",
            "priority": 4,
            "memory_mb": 500,
            "latency_ms": 130
        }
    }
    
    def __init__(self, max_memory_mb: int = 1500, preload_models: List[str] = None):
        """
        Initialize model pool
        
        Args:
            max_memory_mb: Maximum memory to use for models
            preload_models: Models to preload (default: highest priority)
        """
        self.max_memory_mb = max_memory_mb
        self.current_memory_mb = 0
        
        # Model storage
        self.models: Dict[str, TTS] = {}
        self.model_metadata: Dict[str, Dict] = {}
        self.load_times: Dict[str, float] = {}
        self.access_count: Dict[str, int] = {}
        self.last_access: Dict[str, float] = {}
        
        # Threading for async loading
        self.loading_lock = threading.Lock()
        self.loading_queue = queue.Queue()
        self.loading_thread: Optional[threading.Thread] = None
        self.stop_loading = False
        
        # Performance metrics
        self.metrics = {
            "models_loaded": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "evictions": 0,
            "total_memory_mb": 0,
            "average_load_time_ms": 0
        }
        
        # Determine models to preload
        if preload_models is None:
            # Preload highest priority models that fit in memory
            sorted_models = sorted(
                self.MODEL_CONFIGS.items(),
                key=lambda x: x[1]["priority"]
            )
            
            total_memory = 0
            self.preload_models = []
            for model_name, config in sorted_models:
                if total_memory + config["memory_mb"] <= self.max_memory_mb:
                    self.preload_models.append(model_name)
                    total_memory += config["memory_mb"]
                else:
                    break
        else:
            self.preload_models = preload_models
        
        print(f"Model pool initialized. Will preload: {self.preload_models}", file=sys.stderr)
        print(f"Memory budget: {self.max_memory_mb}MB", file=sys.stderr)
        
        # Start background loading
        self._start_loading_thread()
    
    def _start_loading_thread(self):
        """Start background model loading thread"""
        self.loading_thread = threading.Thread(target=self._loading_worker, daemon=True)
        self.loading_thread.start()
    
    def _loading_worker(self):
        """Background worker for loading models"""
        while not self.stop_loading:
            try:
                # Get next model to load (with timeout to check stop flag)
                model_name = self.loading_queue.get(timeout=1.0)
                if model_name is None:
                    break
                
                self._load_model_internal(model_name)
                
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error in model loading worker: {e}", file=sys.stderr)
    
    def _load_model_internal(self, model_name: str) -> bool:
        """
        Internal model loading with memory management
        
        Args:
            model_name: Name of model to load
            
        Returns:
            Success status
        """
        with self.loading_lock:
            # Skip if already loaded
            if model_name in self.models:
                return True
            
            # Validate model name
            try:
                validated_model = validate_model(model_name)
            except Exception as e:
                print(f"Model validation failed: {e}", file=sys.stderr)
                return False
            
            if validated_model not in self.MODEL_CONFIGS:
                print(f"Unknown model: {validated_model}", file=sys.stderr)
                return False
            
            config = self.MODEL_CONFIGS[validated_model]
            
            # Check memory constraints
            if self.current_memory_mb + config["memory_mb"] > self.max_memory_mb:
                # Evict least recently used models
                self._evict_lru_models(config["memory_mb"])
            
            # Load model
            start_time = time.time()
            try:
                print(f"Loading model: {validated_model} ({config['memory_mb']}MB)", file=sys.stderr)
                
                # Use GPU if available
                use_cuda = torch.cuda.is_available()
                if use_cuda:
                    print(f"Using CUDA for {validated_model}", file=sys.stderr)
                
                model = TTS(config["path"], gpu=use_cuda)
                
                # Optimize model for inference
                if use_cuda and hasattr(model, 'synthesizer'):
                    # Enable mixed precision for faster inference
                    try:
                        model.synthesizer = model.synthesizer.half()
                        print(f"Enabled FP16 for {validated_model}", file=sys.stderr)
                    except Exception:
                        pass  # Fallback to FP32
                
                load_time = (time.time() - start_time) * 1000
                
                # Store model and metadata
                self.models[validated_model] = model
                self.model_metadata[validated_model] = config.copy()
                self.load_times[validated_model] = load_time
                self.access_count[validated_model] = 0
                self.last_access[validated_model] = time.time()
                
                # Update memory tracking
                self.current_memory_mb += config["memory_mb"]
                
                # Update metrics
                self.metrics["models_loaded"] += 1
                self.metrics["total_memory_mb"] = self.current_memory_mb
                
                total_load_time = sum(self.load_times.values())
                self.metrics["average_load_time_ms"] = total_load_time / len(self.load_times)
                
                print(f"Model {validated_model} loaded in {load_time:.1f}ms", file=sys.stderr)
                print(f"Memory usage: {self.current_memory_mb}/{self.max_memory_mb}MB", file=sys.stderr)
                
                return True
                
            except Exception as e:
                print(f"Failed to load model {validated_model}: {e}", file=sys.stderr)
                return False
    
    def _evict_lru_models(self, needed_memory_mb: int):
        """
        Evict least recently used models to free memory
        
        Args:
            needed_memory_mb: Amount of memory needed
        """
        print(f"Evicting models to free {needed_memory_mb}MB", file=sys.stderr)
        
        # Sort models by last access time (oldest first)
        models_by_access = sorted(
            self.models.keys(),
            key=lambda x: self.last_access[x]
        )
        
        freed_memory = 0
        for model_name in models_by_access:
            if freed_memory >= needed_memory_mb:
                break
            
            # Don't evict if it's in preload list
            if model_name in self.preload_models:
                continue
            
            print(f"Evicting model: {model_name}", file=sys.stderr)
            
            # Free model memory
            del self.models[model_name]
            freed_memory += self.model_metadata[model_name]["memory_mb"]
            self.current_memory_mb -= self.model_metadata[model_name]["memory_mb"]
            
            # Clean up metadata
            del self.model_metadata[model_name]
            del self.load_times[model_name]
            del self.access_count[model_name]
            del self.last_access[model_name]
            
            self.metrics["evictions"] += 1
            
            # Force garbage collection
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        print(f"Freed {freed_memory}MB, current usage: {self.current_memory_mb}MB", file=sys.stderr)
    
    def preload_models(self):
        """
        Preload priority models for faster access
        """
        print("Starting model preloading...", file=sys.stderr)
        
        for model_name in self.preload_models:
            self.loading_queue.put(model_name)
        
        print(f"Queued {len(self.preload_models)} models for preloading", file=sys.stderr)
    
    def get_model(self, model_name: str) -> Optional[TTS]:
        """
        Get model from pool (load if not available)
        
        Args:
            model_name: Name of model to retrieve
            
        Returns:
            TTS model or None if failed
        """
        # Validate model name
        try:
            validated_model = validate_model(model_name)
        except Exception as e:
            print(f"Model validation failed: {e}", file=sys.stderr)
            return None
        
        # Check if model is loaded
        if validated_model in self.models:
            # Update access tracking
            self.access_count[validated_model] += 1
            self.last_access[validated_model] = time.time()
            self.metrics["cache_hits"] += 1
            
            return self.models[validated_model]
        
        # Model not loaded - load synchronously
        self.metrics["cache_misses"] += 1
        
        print(f"Model {validated_model} not in pool, loading...", file=sys.stderr)
        if self._load_model_internal(validated_model):
            self.access_count[validated_model] += 1
            self.last_access[validated_model] = time.time()
            return self.models[validated_model]
        else:
            return None
    
    def async_load_model(self, model_name: str):
        """
        Queue model for background loading
        
        Args:
            model_name: Name of model to load
        """
        if model_name not in self.models:
            self.loading_queue.put(model_name)
    
    def get_loaded_models(self) -> List[str]:
        """Get list of currently loaded models"""
        return list(self.models.keys())
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage statistics"""
        return {
            "current_mb": self.current_memory_mb,
            "max_mb": self.max_memory_mb,
            "utilization_percent": (self.current_memory_mb / self.max_memory_mb) * 100,
            "loaded_models": len(self.models),
            "model_breakdown": {
                name: self.model_metadata[name]["memory_mb"]
                for name in self.models.keys()
            }
        }
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        metrics = self.metrics.copy()
        
        # Add current statistics
        metrics.update({
            "hit_rate_percent": (
                (self.metrics["cache_hits"] / 
                 max(1, self.metrics["cache_hits"] + self.metrics["cache_misses"])) * 100
            ),
            "models_in_pool": len(self.models),
            "memory_usage": self.get_memory_usage()
        })
        
        return metrics
    
    def is_model_loaded(self, model_name: str) -> bool:
        """Check if model is currently loaded"""
        try:
            validated_model = validate_model(model_name)
            return validated_model in self.models
        except Exception:
            return False
    
    def unload_model(self, model_name: str):
        """
        Manually unload a model
        
        Args:
            model_name: Name of model to unload
        """
        try:
            validated_model = validate_model(model_name)
        except Exception as e:
            print(f"Model validation failed: {e}", file=sys.stderr)
            return
        
        with self.loading_lock:
            if validated_model in self.models:
                print(f"Unloading model: {validated_model}", file=sys.stderr)
                
                # Free memory
                self.current_memory_mb -= self.model_metadata[validated_model]["memory_mb"]
                
                # Remove from pool
                del self.models[validated_model]
                del self.model_metadata[validated_model]
                del self.load_times[validated_model]
                del self.access_count[validated_model]
                del self.last_access[validated_model]
                
                # Force garbage collection
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
    
    def shutdown(self):
        """
        Shutdown model pool and cleanup resources
        """
        print("Shutting down model pool...", file=sys.stderr)
        
        # Stop loading thread
        self.stop_loading = True
        if self.loading_thread:
            self.loading_queue.put(None)  # Signal to stop
            self.loading_thread.join(timeout=5.0)
        
        # Unload all models
        with self.loading_lock:
            for model_name in list(self.models.keys()):
                print(f"Unloading {model_name}", file=sys.stderr)
                del self.models[model_name]
            
            self.current_memory_mb = 0
            
            # Force cleanup
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        
        print("Model pool shutdown complete", file=sys.stderr)

# Global model pool instance
_model_pool: Optional[ModelPool] = None

def get_model_pool() -> ModelPool:
    """Get global model pool instance"""
    if _model_pool is None:
        raise RuntimeError("Model pool not initialized")
    return _model_pool

def init_model_pool(max_memory_mb: int = 1500, preload_models: List[str] = None):
    """Initialize global model pool"""
    global _model_pool
    _model_pool = ModelPool(max_memory_mb, preload_models)

def preload_models():
    """Preload priority models"""
    get_model_pool().preload_models()

def get_model(model_name: str) -> Optional[TTS]:
    """Get model from global pool"""
    return get_model_pool().get_model(model_name)

def shutdown_model_pool():
    """Shutdown global model pool"""
    global _model_pool
    if _model_pool:
        _model_pool.shutdown()
        _model_pool = None