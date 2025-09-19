#!/usr/bin/env python3
"""
CRITICAL: Emergency memory leak prevention tests
Must pass before any deployment
"""

import pytest
import psutil
import time
import threading
import tempfile
import gc
import os
from unittest.mock import patch, Mock
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from tts_service import TTSService


class TestMemoryLeakPrevention:
    """Critical memory leak prevention test suite"""
    
    @pytest.fixture
    def mock_tts_model(self):
        """Mock TTS model to avoid loading actual models"""
        with patch('tts_service.TTS') as mock_tts:
            mock_instance = Mock()
            mock_instance.tts_to_file = Mock()
            mock_tts.return_value = mock_instance
            yield mock_instance
    
    def get_memory_usage_mb(self):
        """Get current process memory usage in MB"""
        process = psutil.Process()
        return process.memory_info().rss / 1024 / 1024
    
    def test_bounded_memory_growth_under_sustained_load(self, mock_tts_model):
        """CRITICAL: Memory should not grow unbounded under sustained synthesis"""
        service = TTSService(model_name="default")
        
        try:
            initial_memory = self.get_memory_usage_mb()
            
            # Perform sustained synthesis operations
            for i in range(200):  # Increased load to detect leaks
                text = f"Memory leak test iteration {i} with some variable content"
                result = service.synthesize(text)
                assert result is not None
                
                # Force garbage collection every 50 iterations
                if i % 50 == 0:
                    gc.collect()
                    current_memory = self.get_memory_usage_mb()
                    memory_growth = current_memory - initial_memory
                    
                    # Memory growth should be bounded
                    assert memory_growth < 300, f"Memory leak detected at iteration {i}: {memory_growth:.1f}MB growth"
            
            # Final memory check
            final_memory = self.get_memory_usage_mb()
            total_growth = final_memory - initial_memory
            
            # Total growth should not exceed 400MB for 200 operations
            assert total_growth < 400, f"Excessive memory growth: {total_growth:.1f}MB"
            
        finally:
            service.shutdown()
    
    def test_cache_memory_management(self, mock_tts_model):
        """CRITICAL: Cache should respect memory limits"""
        # Create service with small cache limit for testing
        service = TTSService(model_name="default")
        service.max_cache_size = 10  # Very small for testing
        
        try:
            initial_memory = self.get_memory_usage_mb()
            
            # Fill cache beyond limit with unique texts
            for i in range(25):  # More than cache limit
                unique_text = f"Unique cache test {i} {time.time()}"
                service.synthesize(unique_text)
            
            # Cache should not exceed limit
            assert len(service.audio_cache) <= service.max_cache_size, \
                f"Cache size {len(service.audio_cache)} exceeds limit {service.max_cache_size}"
            
            # Memory should not grow excessively
            final_memory = self.get_memory_usage_mb()
            memory_growth = final_memory - initial_memory
            assert memory_growth < 200, f"Cache memory leak: {memory_growth:.1f}MB growth"
            
        finally:
            service.shutdown()
    
    def test_thread_memory_cleanup(self, mock_tts_model):
        """CRITICAL: Synthesis thread should not leak memory"""
        initial_thread_count = threading.active_count()
        initial_memory = self.get_memory_usage_mb()
        
        services = []
        
        try:
            # Create multiple services to test thread cleanup
            for i in range(5):
                service = TTSService(model_name="default")
                services.append(service)
                
                # Use each service
                service.synthesize(f"Thread test {i}")
            
            # Check thread count hasn't exploded
            current_thread_count = threading.active_count()
            thread_growth = current_thread_count - initial_thread_count
            assert thread_growth <= 5, f"Thread leak detected: {thread_growth} extra threads"
            
            # Shutdown all services
            for service in services:
                service.shutdown()
            
            # Wait for threads to clean up
            time.sleep(2)
            gc.collect()
            
            # Thread count should return to normal
            final_thread_count = threading.active_count()
            remaining_threads = final_thread_count - initial_thread_count
            assert remaining_threads <= 1, f"Thread cleanup failed: {remaining_threads} threads remain"
            
            # Memory should be released
            final_memory = self.get_memory_usage_mb()
            memory_growth = final_memory - initial_memory
            assert memory_growth < 100, f"Thread memory leak: {memory_growth:.1f}MB not released"
            
        finally:
            # Emergency cleanup
            for service in services:
                try:
                    service.shutdown()
                except:
                    pass
    
    def test_file_descriptor_cleanup(self, mock_tts_model):
        """CRITICAL: File descriptors should not leak"""
        import resource
        
        initial_fd_count = len(os.listdir('/proc/self/fd'))
        
        service = TTSService(model_name="default")
        
        try:
            # Perform many operations that might create file descriptors
            with tempfile.TemporaryDirectory() as temp_dir:
                for i in range(100):
                    output_path = os.path.join(temp_dir, f"test_{i}.wav")
                    service.synthesize(f"FD test {i}", output_path=output_path)
                
                # Check file descriptor count hasn't grown excessively
                current_fd_count = len(os.listdir('/proc/self/fd'))
                fd_growth = current_fd_count - initial_fd_count
                assert fd_growth < 50, f"File descriptor leak: {fd_growth} extra FDs"
        
        finally:
            service.shutdown()
            
            # Wait for cleanup
            time.sleep(1)
            
            # File descriptor count should return to normal
            final_fd_count = len(os.listdir('/proc/self/fd'))
            remaining_fds = final_fd_count - initial_fd_count
            assert remaining_fds <= 5, f"FD cleanup failed: {remaining_fds} FDs remain"
    
    def test_memory_usage_with_large_cache(self, mock_tts_model):
        """CRITICAL: Large cache should not cause memory explosion"""
        service = TTSService(model_name="default")
        service.max_cache_size = 100  # Larger cache
        
        try:
            initial_memory = self.get_memory_usage_mb()
            
            # Generate large amount of cached content
            large_texts = []
            for i in range(50):
                # Create moderately large texts
                large_text = f"Large cache test {i}: " + "A" * 1000  # 1KB each
                large_texts.append(large_text)
                service.synthesize(large_text)
            
            # Re-synthesize same texts (should hit cache)
            for text in large_texts:
                service.synthesize(text)
            
            # Memory growth should be reasonable
            peak_memory = self.get_memory_usage_mb()
            memory_growth = peak_memory - initial_memory
            
            # Should not use more than 500MB for this test
            assert memory_growth < 500, f"Cache memory explosion: {memory_growth:.1f}MB"
            
            # Clear cache
            service.clear_cache()
            gc.collect()
            
            # Memory should be released after cache clear
            time.sleep(1)
            final_memory = self.get_memory_usage_mb()
            remaining_growth = final_memory - initial_memory
            assert remaining_growth < 200, f"Cache memory not released: {remaining_growth:.1f}MB"
            
        finally:
            service.shutdown()
    
    def test_concurrent_synthesis_memory_safety(self, mock_tts_model):
        """CRITICAL: Concurrent synthesis should not leak memory"""
        service = TTSService(model_name="default")
        
        try:
            initial_memory = self.get_memory_usage_mb()
            
            # Submit many concurrent synthesis requests
            for i in range(100):
                service.synthesize(
                    f"Concurrent memory test {i}",
                    async_mode=True,
                    callback=lambda success, path: None
                )
            
            # Wait for all to complete
            time.sleep(5)
            gc.collect()
            
            # Memory should not have grown excessively
            final_memory = self.get_memory_usage_mb()
            memory_growth = final_memory - initial_memory
            assert memory_growth < 300, f"Concurrent synthesis memory leak: {memory_growth:.1f}MB"
            
        finally:
            service.shutdown()
    
    def test_periodic_cleanup_effectiveness(self, mock_tts_model):
        """CRITICAL: Periodic cleanup should prevent memory accumulation"""
        service = TTSService(model_name="default")
        
        # Mock the periodic cleanup to run immediately
        original_cleanup = service._periodic_cleanup
        cleanup_calls = []
        
        def mock_cleanup():
            cleanup_calls.append(time.time())
            return original_cleanup()
        
        service._periodic_cleanup = mock_cleanup
        
        try:
            # Trigger cleanup manually
            service._periodic_cleanup()
            
            # Generate some work
            for i in range(20):
                service.synthesize(f"Cleanup test {i}")
            
            # Trigger cleanup again
            service._periodic_cleanup()
            
            # Cleanup should have been called
            assert len(cleanup_calls) >= 2, "Periodic cleanup not functioning"
            
        finally:
            service.shutdown()
    
    def test_model_switching_memory_cleanup(self, mock_tts_model):
        """CRITICAL: Model switching should clean up previous model memory"""
        service = TTSService(model_name="default")
        
        try:
            initial_memory = self.get_memory_usage_mb()
            
            # Use default model
            for i in range(10):
                service.synthesize(f"Default model test {i}")
            
            # Switch to fast model (should clear cache)
            service.switch_model("fast")
            
            # Cache should be empty after switch
            assert len(service.audio_cache) == 0, "Cache not cleared on model switch"
            
            # Use fast model
            for i in range(10):
                service.synthesize(f"Fast model test {i}")
            
            # Switch back to default
            service.switch_model("default")
            
            # Memory should not have grown excessively
            final_memory = self.get_memory_usage_mb()
            memory_growth = final_memory - initial_memory
            assert memory_growth < 200, f"Model switching memory leak: {memory_growth:.1f}MB"
            
        finally:
            service.shutdown()


if __name__ == "__main__":
    # Run critical memory tests
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "-x"  # Stop on first failure
    ])