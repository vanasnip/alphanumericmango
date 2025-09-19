#!/usr/bin/env python3
"""
GPU Optimization for TTS Performance
Advanced GPU utilization and performance tuning
"""

import os
import logging
from typing import Optional, Dict, Any, List

try:
    import torch
    import torch.backends.cudnn as cudnn
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    print("PyTorch not available - GPU optimization disabled")

# Configure GPU logger
gpu_logger = logging.getLogger('tts.gpu')
gpu_logger.setLevel(logging.INFO)

class GPUOptimizer:
    """
    GPU optimization manager for TTS models
    """
    
    def __init__(self):
        """Initialize GPU optimizer"""
        self.is_available = HAS_TORCH and torch.cuda.is_available()
        self.device_count = torch.cuda.device_count() if self.is_available else 0
        self.current_device = None
        self.memory_fraction = 0.8  # Reserve 80% of GPU memory
        
        # Performance settings
        self.optimization_enabled = False
        self.mixed_precision_enabled = False
        self.batch_processing_enabled = False
        
        if self.is_available:
            gpu_logger.info(f"GPU optimization available: {self.device_count} devices")
            self._initialize_gpu_settings()
        else:
            gpu_logger.info("GPU optimization not available - using CPU")
    
    def _initialize_gpu_settings(self):
        """Initialize optimal GPU settings"""
        if not self.is_available:
            return
        
        try:
            # Enable cuDNN benchmark mode for consistent input sizes
            cudnn.benchmark = True
            cudnn.deterministic = False  # Allow non-deterministic algorithms for speed
            
            # Set memory allocation strategy
            os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:128'
            
            # Get primary GPU info
            self.current_device = torch.cuda.current_device()
            gpu_name = torch.cuda.get_device_name(self.current_device)
            memory_total = torch.cuda.get_device_properties(self.current_device).total_memory
            memory_gb = memory_total / (1024 ** 3)
            
            gpu_logger.info(f"Primary GPU: {gpu_name} ({memory_gb:.1f}GB)")
            
            # Configure memory settings based on available memory
            if memory_gb >= 8:
                self.memory_fraction = 0.9  # Use more memory on high-end cards
                self.batch_processing_enabled = True
            elif memory_gb >= 4:
                self.memory_fraction = 0.8
                self.batch_processing_enabled = True
            else:
                self.memory_fraction = 0.7  # Conservative on low-memory cards
                self.batch_processing_enabled = False
            
            # Enable mixed precision on supported hardware
            if self._supports_mixed_precision():
                self.mixed_precision_enabled = True
                gpu_logger.info("Mixed precision (FP16) enabled")
            
            self.optimization_enabled = True
            gpu_logger.info("GPU optimization initialized successfully")
            
        except Exception as e:
            gpu_logger.error(f"Failed to initialize GPU settings: {e}")
            self.optimization_enabled = False
    
    def _supports_mixed_precision(self) -> bool:
        """Check if current GPU supports mixed precision training"""
        if not self.is_available:
            return False
        
        try:
            # Check for Tensor Core support (compute capability >= 7.0)
            major, minor = torch.cuda.get_device_capability(self.current_device)
            return major >= 7 or (major == 7 and minor >= 0)
        except Exception:
            return False
    
    def optimize_model(self, model) -> Any:
        """
        Apply GPU optimizations to TTS model
        
        Args:
            model: TTS model to optimize
            
        Returns:
            Optimized model
        """
        if not self.optimization_enabled or model is None:
            return model
        
        try:
            # Move model to GPU
            if hasattr(model, 'to'):
                model = model.to(f'cuda:{self.current_device}')
                gpu_logger.debug("Model moved to GPU")
            
            # Enable mixed precision if supported
            if self.mixed_precision_enabled and hasattr(model, 'half'):
                try:
                    model = model.half()
                    gpu_logger.debug("Model converted to FP16")
                except Exception as e:
                    gpu_logger.warning(f"Failed to enable FP16: {e}")
            
            # Set model to evaluation mode for inference
            if hasattr(model, 'eval'):
                model.eval()
            
            # Enable inference optimization
            if hasattr(torch, 'inference_mode'):
                # Modern PyTorch inference mode
                model = torch.jit.optimize_for_inference(model) if hasattr(torch.jit, 'optimize_for_inference') else model
            
            # Compile model for faster inference (PyTorch 2.0+)
            if hasattr(torch, 'compile') and hasattr(model, 'forward'):
                try:
                    model = torch.compile(model, mode='reduce-overhead')
                    gpu_logger.debug("Model compiled for faster inference")
                except Exception as e:
                    gpu_logger.debug(f"Model compilation failed: {e}")
            
            gpu_logger.info("Model GPU optimization complete")
            return model
            
        except Exception as e:
            gpu_logger.error(f"Model optimization failed: {e}")
            return model
    
    def get_optimal_batch_size(self, model_size_estimate: int = 500) -> int:
        """
        Calculate optimal batch size based on available GPU memory
        
        Args:
            model_size_estimate: Estimated model size in MB
            
        Returns:
            Optimal batch size
        """
        if not self.is_available:
            return 1
        
        try:
            # Get available memory
            memory_free, memory_total = torch.cuda.mem_get_info(self.current_device)
            memory_free_mb = memory_free / (1024 ** 2)
            
            # Reserve memory for model and overhead
            available_for_batch = memory_free_mb - model_size_estimate - 200  # 200MB overhead
            
            # Estimate memory per batch item (very rough estimate)
            memory_per_item = 50  # MB per synthesis
            
            batch_size = max(1, int(available_for_batch / memory_per_item))
            batch_size = min(batch_size, 8)  # Cap at 8 for stability
            
            gpu_logger.debug(f"Optimal batch size: {batch_size} (free memory: {memory_free_mb:.0f}MB)")
            return batch_size
            
        except Exception as e:
            gpu_logger.error(f"Failed to calculate batch size: {e}")
            return 1
    
    def optimize_memory_usage(self):
        """Optimize GPU memory usage"""
        if not self.is_available:
            return
        
        try:
            # Clear cache
            torch.cuda.empty_cache()
            
            # Set memory fraction
            if hasattr(torch.cuda, 'set_per_process_memory_fraction'):
                torch.cuda.set_per_process_memory_fraction(self.memory_fraction)
                gpu_logger.debug(f"Set memory fraction to {self.memory_fraction}")
            
        except Exception as e:
            gpu_logger.error(f"Memory optimization failed: {e}")
    
    def warm_up_gpu(self):
        """Warm up GPU for consistent performance"""
        if not self.is_available:
            return
        
        try:
            gpu_logger.info("Warming up GPU...")
            
            # Create dummy tensors to initialize GPU
            dummy_tensor = torch.randn(1000, 1000, device=f'cuda:{self.current_device}')
            
            # Perform some operations
            for _ in range(5):
                result = torch.matmul(dummy_tensor, dummy_tensor.T)
                torch.cuda.synchronize()
            
            # Clean up
            del dummy_tensor, result
            torch.cuda.empty_cache()
            
            gpu_logger.info("GPU warm-up complete")
            
        except Exception as e:
            gpu_logger.error(f"GPU warm-up failed: {e}")
    
    def get_gpu_stats(self) -> Dict[str, Any]:
        """
        Get current GPU statistics
        
        Returns:
            Dictionary of GPU stats
        """
        stats = {
            "gpu_available": self.is_available,
            "device_count": self.device_count,
            "optimization_enabled": self.optimization_enabled,
            "mixed_precision_enabled": self.mixed_precision_enabled,
            "batch_processing_enabled": self.batch_processing_enabled
        }
        
        if self.is_available:
            try:
                memory_free, memory_total = torch.cuda.mem_get_info(self.current_device)
                memory_used = memory_total - memory_free
                
                stats.update({
                    "current_device": self.current_device,
                    "device_name": torch.cuda.get_device_name(self.current_device),
                    "memory_total_gb": memory_total / (1024 ** 3),
                    "memory_used_gb": memory_used / (1024 ** 3),
                    "memory_free_gb": memory_free / (1024 ** 3),
                    "memory_utilization": (memory_used / memory_total) * 100,
                    "compute_capability": torch.cuda.get_device_capability(self.current_device)
                })
                
            except Exception as e:
                gpu_logger.error(f"Failed to get GPU stats: {e}")
        
        return stats
    
    def monitor_gpu_usage(self) -> Dict[str, float]:
        """
        Monitor GPU usage during synthesis
        
        Returns:
            Usage statistics
        """
        if not self.is_available:
            return {"gpu_utilization": 0.0, "memory_utilization": 0.0}
        
        try:
            # Get memory usage
            memory_free, memory_total = torch.cuda.mem_get_info(self.current_device)
            memory_used = memory_total - memory_free
            memory_util = (memory_used / memory_total) * 100
            
            # Note: GPU utilization requires additional monitoring tools
            # For now, we'll estimate based on memory usage
            gpu_util = min(memory_util * 1.2, 100.0)  # Rough estimate
            
            return {
                "gpu_utilization": gpu_util,
                "memory_utilization": memory_util,
                "memory_used_mb": memory_used / (1024 ** 2),
                "memory_free_mb": memory_free / (1024 ** 2)
            }
            
        except Exception as e:
            gpu_logger.error(f"GPU monitoring failed: {e}")
            return {"gpu_utilization": 0.0, "memory_utilization": 0.0}
    
    def cleanup_gpu_memory(self):
        """Clean up GPU memory"""
        if not self.is_available:
            return
        
        try:
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
            gpu_logger.debug("GPU memory cleaned up")
        except Exception as e:
            gpu_logger.error(f"GPU cleanup failed: {e}")

# Global GPU optimizer instance
_gpu_optimizer: Optional[GPUOptimizer] = None

def get_gpu_optimizer() -> GPUOptimizer:
    """Get global GPU optimizer instance"""
    if _gpu_optimizer is None:
        raise RuntimeError("GPU optimizer not initialized")
    return _gpu_optimizer

def init_gpu_optimizer():
    """Initialize global GPU optimizer"""
    global _gpu_optimizer
    _gpu_optimizer = GPUOptimizer()

def optimize_model_for_gpu(model) -> Any:
    """Optimize model for GPU using global optimizer"""
    return get_gpu_optimizer().optimize_model(model)

def warm_up_gpu():
    """Warm up GPU using global optimizer"""
    get_gpu_optimizer().warm_up_gpu()

def get_gpu_stats() -> Dict[str, Any]:
    """Get GPU statistics using global optimizer"""
    return get_gpu_optimizer().get_gpu_stats()

def monitor_gpu_usage() -> Dict[str, float]:
    """Monitor GPU usage using global optimizer"""
    return get_gpu_optimizer().monitor_gpu_usage()

def cleanup_gpu():
    """Clean up GPU memory using global optimizer"""
    get_gpu_optimizer().cleanup_gpu_memory()

def is_gpu_available() -> bool:
    """Check if GPU optimization is available"""
    try:
        return get_gpu_optimizer().is_available
    except RuntimeError:
        return HAS_TORCH and torch.cuda.is_available() if HAS_TORCH else False