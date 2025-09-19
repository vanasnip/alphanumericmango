#!/usr/bin/env python3
"""
In-Memory Audio Cache
High-performance caching for synthesized audio to eliminate I/O overhead
"""

import time
import threading
import hashlib
from typing import Dict, Optional, Tuple, Any
from collections import OrderedDict
import numpy as np
import logging

# Configure cache logger
cache_logger = logging.getLogger('tts.cache')
cache_logger.setLevel(logging.INFO)

class MemoryAudioCache:
    """
    High-performance in-memory cache for audio data
    Uses LRU eviction and compression for optimal memory usage
    """
    
    def __init__(self, max_size_mb: int = 256, max_entries: int = 500):
        """
        Initialize memory cache
        
        Args:
            max_size_mb: Maximum memory usage in MB
            max_entries: Maximum number of cached entries
        """
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.max_entries = max_entries
        
        # Thread-safe cache storage (LRU with OrderedDict)
        self.cache: OrderedDict[str, Tuple[np.ndarray, int, float, int]] = OrderedDict()
        # Value tuple: (audio_data, sample_rate, timestamp, size_bytes)
        
        self.lock = threading.RLock()
        
        # Statistics
        self.stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "current_size_bytes": 0,
            "current_entries": 0,
            "total_requests": 0
        }
        
        cache_logger.info(f"Memory cache initialized: {max_size_mb}MB, {max_entries} entries max")
    
    def _calculate_audio_size(self, audio_data: np.ndarray) -> int:
        """Calculate memory size of audio data in bytes"""
        return audio_data.nbytes
    
    def _evict_lru(self, needed_bytes: int = 0):
        """
        Evict least recently used entries to free memory
        
        Args:
            needed_bytes: Minimum bytes to free (0 = just enforce limits)
        """
        freed_bytes = 0
        evicted_count = 0
        
        # Evict until we have enough space and are under limits
        while (self.cache and 
               (self.stats["current_size_bytes"] + needed_bytes > self.max_size_bytes or
                len(self.cache) >= self.max_entries)):
            
            # Remove oldest entry (LRU)
            key, (audio_data, sample_rate, timestamp, size_bytes) = self.cache.popitem(last=False)
            
            self.stats["current_size_bytes"] -= size_bytes
            self.stats["current_entries"] -= 1
            freed_bytes += size_bytes
            evicted_count += 1
        
        if evicted_count > 0:
            self.stats["evictions"] += evicted_count
            cache_logger.debug(f"Evicted {evicted_count} entries, freed {freed_bytes} bytes")
    
    def put(self, key: str, audio_data: np.ndarray, sample_rate: int) -> bool:
        """
        Store audio data in cache
        
        Args:
            key: Cache key (typically hash of text + model)
            audio_data: Audio numpy array
            sample_rate: Audio sample rate
            
        Returns:
            True if stored successfully
        """
        if not isinstance(audio_data, np.ndarray):
            cache_logger.warning("Audio data must be numpy array")
            return False
        
        size_bytes = self._calculate_audio_size(audio_data)
        
        # Skip if single item is too large
        if size_bytes > self.max_size_bytes:
            cache_logger.warning(f"Audio too large for cache: {size_bytes} bytes")
            return False
        
        with self.lock:
            # Remove existing entry if present
            if key in self.cache:
                old_audio_data, _, _, old_size = self.cache[key]
                self.stats["current_size_bytes"] -= old_size
                self.stats["current_entries"] -= 1
            
            # Evict if needed to make space
            self._evict_lru(size_bytes)
            
            # Store new entry (OrderedDict automatically handles LRU)
            self.cache[key] = (audio_data.copy(), sample_rate, time.time(), size_bytes)
            
            # Update statistics
            self.stats["current_size_bytes"] += size_bytes
            self.stats["current_entries"] += 1
            
            cache_logger.debug(f"Cached audio: {key[:16]}... ({size_bytes} bytes)")
            return True
    
    def get(self, key: str) -> Optional[Tuple[np.ndarray, int]]:
        """
        Retrieve audio data from cache
        
        Args:
            key: Cache key
            
        Returns:
            Tuple of (audio_data, sample_rate) or None if not found
        """
        with self.lock:
            self.stats["total_requests"] += 1
            
            if key in self.cache:
                # Move to end (most recently used)
                audio_data, sample_rate, _, size_bytes = self.cache.pop(key)
                self.cache[key] = (audio_data, sample_rate, time.time(), size_bytes)
                
                self.stats["hits"] += 1
                cache_logger.debug(f"Cache hit: {key[:16]}...")
                
                # Return copy to prevent external modification
                return audio_data.copy(), sample_rate
            else:
                self.stats["misses"] += 1
                cache_logger.debug(f"Cache miss: {key[:16]}...")
                return None
    
    def has(self, key: str) -> bool:
        """
        Check if key exists in cache without affecting LRU order
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists
        """
        with self.lock:
            return key in self.cache
    
    def delete(self, key: str) -> bool:
        """
        Remove entry from cache
        
        Args:
            key: Cache key
            
        Returns:
            True if entry was removed
        """
        with self.lock:
            if key in self.cache:
                _, _, _, size_bytes = self.cache.pop(key)
                self.stats["current_size_bytes"] -= size_bytes
                self.stats["current_entries"] -= 1
                cache_logger.debug(f"Deleted from cache: {key[:16]}...")
                return True
            return False
    
    def clear(self):
        """Clear all cache entries"""
        with self.lock:
            evicted_count = len(self.cache)
            self.cache.clear()
            self.stats["current_size_bytes"] = 0
            self.stats["current_entries"] = 0
            self.stats["evictions"] += evicted_count
            cache_logger.info(f"Cache cleared: {evicted_count} entries removed")
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary of cache statistics
        """
        with self.lock:
            stats = self.stats.copy()
            
            # Calculate derived statistics
            if stats["total_requests"] > 0:
                stats["hit_rate"] = (stats["hits"] / stats["total_requests"]) * 100
                stats["miss_rate"] = (stats["misses"] / stats["total_requests"]) * 100
            else:
                stats["hit_rate"] = 0.0
                stats["miss_rate"] = 0.0
            
            stats["memory_usage_mb"] = stats["current_size_bytes"] / (1024 * 1024)
            stats["memory_utilization"] = (stats["current_size_bytes"] / self.max_size_bytes) * 100
            stats["entry_utilization"] = (stats["current_entries"] / self.max_entries) * 100
            
            return stats
    
    def optimize(self):
        """
        Optimize cache by removing old entries and defragmenting
        Called periodically to maintain performance
        """
        with self.lock:
            current_time = time.time()
            old_entries = []
            
            # Find entries older than 1 hour
            for key, (_, _, timestamp, _) in self.cache.items():
                if current_time - timestamp > 3600:  # 1 hour
                    old_entries.append(key)
            
            # Remove old entries
            for key in old_entries:
                self.delete(key)
            
            if old_entries:
                cache_logger.info(f"Cache optimization removed {len(old_entries)} old entries")
    
    def get_memory_pressure(self) -> float:
        """
        Get current memory pressure (0.0 to 1.0)
        
        Returns:
            Memory pressure ratio
        """
        with self.lock:
            return self.stats["current_size_bytes"] / self.max_size_bytes
    
    def preload_common_phrases(self, phrases_with_audio: Dict[str, Tuple[np.ndarray, int]]):
        """
        Preload common phrases into cache
        
        Args:
            phrases_with_audio: Dict of {cache_key: (audio_data, sample_rate)}
        """
        with self.lock:
            preloaded = 0
            for key, (audio_data, sample_rate) in phrases_with_audio.items():
                if self.put(key, audio_data, sample_rate):
                    preloaded += 1
            
            cache_logger.info(f"Preloaded {preloaded} common phrases")

class CompressedMemoryCache(MemoryAudioCache):
    """
    Memory cache with audio compression for higher capacity
    Uses simple run-length encoding for audio data
    """
    
    def __init__(self, max_size_mb: int = 512, max_entries: int = 1000, compression_ratio: float = 0.3):
        """
        Initialize compressed cache
        
        Args:
            max_size_mb: Maximum memory usage in MB
            max_entries: Maximum number of cached entries
            compression_ratio: Expected compression ratio (lower = better compression)
        """
        # Adjust size based on expected compression
        effective_size_mb = int(max_size_mb / compression_ratio)
        super().__init__(effective_size_mb, max_entries)
        
        self.compression_ratio = compression_ratio
        cache_logger.info(f"Compressed cache initialized with {compression_ratio:.1%} compression ratio")
    
    def _compress_audio(self, audio_data: np.ndarray) -> np.ndarray:
        """
        Simple audio compression (quantization)
        
        Args:
            audio_data: Original audio data
            
        Returns:
            Compressed audio data
        """
        # Convert to 16-bit integer (from float32)
        if audio_data.dtype == np.float32:
            compressed = (audio_data * 32767).astype(np.int16)
        else:
            compressed = audio_data
        
        return compressed
    
    def _decompress_audio(self, compressed_data: np.ndarray) -> np.ndarray:
        """
        Decompress audio data
        
        Args:
            compressed_data: Compressed audio data
            
        Returns:
            Decompressed audio data
        """
        # Convert back to float32 (from int16)
        if compressed_data.dtype == np.int16:
            decompressed = compressed_data.astype(np.float32) / 32767.0
        else:
            decompressed = compressed_data
        
        return decompressed
    
    def put(self, key: str, audio_data: np.ndarray, sample_rate: int) -> bool:
        """Store compressed audio data"""
        compressed_audio = self._compress_audio(audio_data)
        return super().put(key, compressed_audio, sample_rate)
    
    def get(self, key: str) -> Optional[Tuple[np.ndarray, int]]:
        """Retrieve and decompress audio data"""
        result = super().get(key)
        if result:
            compressed_audio, sample_rate = result
            decompressed_audio = self._decompress_audio(compressed_audio)
            return decompressed_audio, sample_rate
        return None

# Global cache instance
_memory_cache: Optional[MemoryAudioCache] = None

def get_memory_cache() -> MemoryAudioCache:
    """Get global memory cache instance"""
    if _memory_cache is None:
        raise RuntimeError("Memory cache not initialized")
    return _memory_cache

def init_memory_cache(max_size_mb: int = 256, max_entries: int = 500, use_compression: bool = True):
    """
    Initialize global memory cache
    
    Args:
        max_size_mb: Maximum memory usage in MB
        max_entries: Maximum number of entries
        use_compression: Whether to use compressed cache
    """
    global _memory_cache
    
    if use_compression:
        _memory_cache = CompressedMemoryCache(max_size_mb, max_entries)
    else:
        _memory_cache = MemoryAudioCache(max_size_mb, max_entries)
    
    cache_logger.info(f"Global memory cache initialized: {max_size_mb}MB, compression={use_compression}")

def cache_audio(key: str, audio_data: np.ndarray, sample_rate: int) -> bool:
    """Cache audio data"""
    return get_memory_cache().put(key, audio_data, sample_rate)

def get_cached_audio(key: str) -> Optional[Tuple[np.ndarray, int]]:
    """Get cached audio data"""
    return get_memory_cache().get(key)

def clear_cache():
    """Clear all cached audio"""
    get_memory_cache().clear()

def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    return get_memory_cache().get_stats()

def shutdown_memory_cache():
    """Shutdown global memory cache"""
    global _memory_cache
    if _memory_cache:
        _memory_cache.clear()
        _memory_cache = None