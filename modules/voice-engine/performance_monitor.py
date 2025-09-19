#!/usr/bin/env python3
"""
Performance Monitoring for TTS System
Real-time performance tracking and metrics collection
"""

import time
import threading
import queue
import statistics
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from collections import deque
import logging

# Configure performance logger
perf_logger = logging.getLogger('tts.performance')
perf_logger.setLevel(logging.INFO)

@dataclass
class SynthesisMetrics:
    """Metrics for a single synthesis operation"""
    request_id: str
    text_length: int
    model_name: str
    
    # Timing metrics (in milliseconds)
    total_latency_ms: float
    model_load_time_ms: float
    cache_lookup_time_ms: float
    synthesis_time_ms: float
    first_audio_time_ms: float  # Time to first audio chunk
    
    # Memory metrics
    memory_usage_mb: float
    gpu_memory_mb: float
    
    # Audio metrics
    audio_duration_seconds: float
    sample_rate: int
    
    # Performance indicators
    was_cached: bool
    was_streamed: bool
    used_gpu: bool
    model_preloaded: bool
    
    # Quality metrics
    realtime_factor: float = field(default=0.0)  # synthesis_time / audio_duration
    
    def __post_init__(self):
        """Calculate derived metrics"""
        if self.audio_duration_seconds > 0:
            self.realtime_factor = (self.synthesis_time_ms / 1000) / self.audio_duration_seconds

class PerformanceMonitor:
    """
    Real-time performance monitoring for TTS operations
    Tracks latency, throughput, and resource utilization
    """
    
    def __init__(self, history_size: int = 1000):
        """
        Initialize performance monitor
        
        Args:
            history_size: Number of recent metrics to keep in memory
        """
        self.history_size = history_size
        
        # Metrics storage
        self.metrics_history: deque[SynthesisMetrics] = deque(maxlen=history_size)
        self.lock = threading.RLock()
        
        # Real-time tracking
        self.active_requests: Dict[str, Dict[str, Any]] = {}
        
        # Aggregated statistics
        self.stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "average_latency_ms": 0.0,
            "p95_latency_ms": 0.0,
            "p99_latency_ms": 0.0,
            "throughput_requests_per_minute": 0.0,
            "average_realtime_factor": 0.0,
            "total_audio_seconds": 0.0,
            "total_synthesis_time_ms": 0.0
        }
        
        # Performance targets
        self.targets = {
            "max_latency_ms": 150,
            "max_realtime_factor": 0.3,  # 30% of real-time
            "min_cache_hit_rate": 70.0,  # 70%
            "max_memory_mb": 2048
        }
        
        # Alert thresholds
        self.alert_callbacks: List[Callable[[str, Dict], None]] = []
        
        perf_logger.info("Performance monitor initialized")
    
    def start_request(self, request_id: str, text: str, model_name: str) -> None:
        """
        Start tracking a synthesis request
        
        Args:
            request_id: Unique request identifier
            text: Text being synthesized
            model_name: TTS model being used
        """
        with self.lock:
            self.active_requests[request_id] = {
                "start_time": time.time(),
                "text": text,
                "text_length": len(text),
                "model_name": model_name,
                "timestamps": {
                    "request_start": time.time()
                },
                "metrics": {}
            }
        
        perf_logger.debug(f"Started tracking request {request_id}")
    
    def record_timestamp(self, request_id: str, event: str) -> None:
        """
        Record a timestamp for a specific event
        
        Args:
            request_id: Request identifier
            event: Event name (e.g., 'cache_lookup', 'model_loaded', 'synthesis_start')
        """
        with self.lock:
            if request_id in self.active_requests:
                self.active_requests[request_id]["timestamps"][event] = time.time()
    
    def record_metric(self, request_id: str, metric_name: str, value: Any) -> None:
        """
        Record a metric value for a request
        
        Args:
            request_id: Request identifier
            metric_name: Metric name
            value: Metric value
        """
        with self.lock:
            if request_id in self.active_requests:
                self.active_requests[request_id]["metrics"][metric_name] = value
    
    def complete_request(self, request_id: str, audio_duration: float, sample_rate: int) -> SynthesisMetrics:
        """
        Complete tracking for a synthesis request
        
        Args:
            request_id: Request identifier
            audio_duration: Duration of generated audio in seconds
            sample_rate: Audio sample rate
            
        Returns:
            Complete metrics for the request
        """
        with self.lock:
            if request_id not in self.active_requests:
                perf_logger.warning(f"Request {request_id} not found in active tracking")
                return None
            
            request_data = self.active_requests.pop(request_id)
            end_time = time.time()
            
            # Calculate timing metrics
            timestamps = request_data["timestamps"]
            start_time = timestamps["request_start"]
            
            total_latency_ms = (end_time - start_time) * 1000
            
            # Extract timing components
            cache_lookup_time_ms = 0
            if "cache_lookup_end" in timestamps and "cache_lookup_start" in timestamps:
                cache_lookup_time_ms = (timestamps["cache_lookup_end"] - timestamps["cache_lookup_start"]) * 1000
            
            model_load_time_ms = 0
            if "model_loaded" in timestamps and "model_load_start" in timestamps:
                model_load_time_ms = (timestamps["model_loaded"] - timestamps["model_load_start"]) * 1000
            
            synthesis_time_ms = 0
            if "synthesis_end" in timestamps and "synthesis_start" in timestamps:
                synthesis_time_ms = (timestamps["synthesis_end"] - timestamps["synthesis_start"]) * 1000
            
            first_audio_time_ms = 0
            if "first_audio" in timestamps:
                first_audio_time_ms = (timestamps["first_audio"] - start_time) * 1000
            
            # Extract metrics
            metrics = request_data["metrics"]
            
            # Create metrics object
            synthesis_metrics = SynthesisMetrics(
                request_id=request_id,
                text_length=request_data["text_length"],
                model_name=request_data["model_name"],
                total_latency_ms=total_latency_ms,
                model_load_time_ms=model_load_time_ms,
                cache_lookup_time_ms=cache_lookup_time_ms,
                synthesis_time_ms=synthesis_time_ms,
                first_audio_time_ms=first_audio_time_ms or total_latency_ms,
                memory_usage_mb=metrics.get("memory_usage_mb", 0),
                gpu_memory_mb=metrics.get("gpu_memory_mb", 0),
                audio_duration_seconds=audio_duration,
                sample_rate=sample_rate,
                was_cached=metrics.get("was_cached", False),
                was_streamed=metrics.get("was_streamed", False),
                used_gpu=metrics.get("used_gpu", False),
                model_preloaded=metrics.get("model_preloaded", False)
            )
            
            # Add to history
            self.metrics_history.append(synthesis_metrics)
            
            # Update aggregated statistics
            self._update_statistics()
            
            # Check for performance alerts
            self._check_alerts(synthesis_metrics)
            
            perf_logger.info(f"Request {request_id} completed: {total_latency_ms:.1f}ms")
            
            return synthesis_metrics
    
    def _update_statistics(self) -> None:
        """Update aggregated performance statistics"""
        if not self.metrics_history:
            return
        
        # Get recent metrics for calculations
        recent_metrics = list(self.metrics_history)
        
        # Basic counts
        self.stats["total_requests"] = len(recent_metrics)
        cache_hits = sum(1 for m in recent_metrics if m.was_cached)
        self.stats["cache_hits"] = cache_hits
        self.stats["cache_misses"] = len(recent_metrics) - cache_hits
        
        # Latency statistics
        latencies = [m.total_latency_ms for m in recent_metrics]
        self.stats["average_latency_ms"] = statistics.mean(latencies)
        
        if len(latencies) >= 20:  # Need sufficient data for percentiles
            sorted_latencies = sorted(latencies)
            self.stats["p95_latency_ms"] = sorted_latencies[int(0.95 * len(sorted_latencies))]
            self.stats["p99_latency_ms"] = sorted_latencies[int(0.99 * len(sorted_latencies))]
        
        # Throughput (requests per minute)
        if len(recent_metrics) >= 2:
            time_span_minutes = (time.time() - time.time()) / 60  # This needs actual time tracking
            # For now, estimate based on recent requests
            self.stats["throughput_requests_per_minute"] = len(recent_metrics)  # Placeholder
        
        # Performance factors
        realtime_factors = [m.realtime_factor for m in recent_metrics if m.realtime_factor > 0]
        if realtime_factors:
            self.stats["average_realtime_factor"] = statistics.mean(realtime_factors)
        
        # Audio metrics
        self.stats["total_audio_seconds"] = sum(m.audio_duration_seconds for m in recent_metrics)
        self.stats["total_synthesis_time_ms"] = sum(m.synthesis_time_ms for m in recent_metrics)
    
    def _check_alerts(self, metrics: SynthesisMetrics) -> None:
        """Check for performance alerts based on targets"""
        alerts = []
        
        # Latency alert
        if metrics.total_latency_ms > self.targets["max_latency_ms"]:
            alerts.append({
                "type": "high_latency",
                "value": metrics.total_latency_ms,
                "target": self.targets["max_latency_ms"],
                "request_id": metrics.request_id
            })
        
        # Realtime factor alert
        if metrics.realtime_factor > self.targets["max_realtime_factor"]:
            alerts.append({
                "type": "poor_realtime_factor",
                "value": metrics.realtime_factor,
                "target": self.targets["max_realtime_factor"],
                "request_id": metrics.request_id
            })
        
        # Memory usage alert
        total_memory = metrics.memory_usage_mb + metrics.gpu_memory_mb
        if total_memory > self.targets["max_memory_mb"]:
            alerts.append({
                "type": "high_memory_usage",
                "value": total_memory,
                "target": self.targets["max_memory_mb"],
                "request_id": metrics.request_id
            })
        
        # Cache hit rate alert (check overall rate)
        if self.stats["total_requests"] >= 10:  # Need enough data
            cache_hit_rate = (self.stats["cache_hits"] / self.stats["total_requests"]) * 100
            if cache_hit_rate < self.targets["min_cache_hit_rate"]:
                alerts.append({
                    "type": "low_cache_hit_rate",
                    "value": cache_hit_rate,
                    "target": self.targets["min_cache_hit_rate"]
                })
        
        # Send alerts
        for alert in alerts:
            perf_logger.warning(f"Performance alert: {alert['type']} = {alert['value']}")
            for callback in self.alert_callbacks:
                try:
                    callback(alert["type"], alert)
                except Exception as e:
                    perf_logger.error(f"Alert callback failed: {e}")
    
    def get_current_stats(self) -> Dict[str, Any]:
        """Get current performance statistics"""
        with self.lock:
            stats = self.stats.copy()
            
            # Add cache hit rate
            if stats["total_requests"] > 0:
                stats["cache_hit_rate"] = (stats["cache_hits"] / stats["total_requests"]) * 100
            else:
                stats["cache_hit_rate"] = 0.0
            
            # Add target compliance
            stats["targets"] = self.targets.copy()
            stats["target_compliance"] = {
                "latency_ok": stats["average_latency_ms"] <= self.targets["max_latency_ms"],
                "realtime_factor_ok": stats["average_realtime_factor"] <= self.targets["max_realtime_factor"],
                "cache_hit_rate_ok": stats["cache_hit_rate"] >= self.targets["min_cache_hit_rate"]
            }
            
            return stats
    
    def get_recent_metrics(self, count: int = 10) -> List[SynthesisMetrics]:
        """Get recent synthesis metrics"""
        with self.lock:
            return list(self.metrics_history)[-count:]
    
    def get_performance_breakdown(self) -> Dict[str, Any]:
        """Get detailed performance breakdown"""
        with self.lock:
            if not self.metrics_history:
                return {"error": "No metrics available"}
            
            recent = list(self.metrics_history)
            
            breakdown = {
                "timing_breakdown": {
                    "average_cache_lookup_ms": statistics.mean([m.cache_lookup_time_ms for m in recent]) if recent else 0,
                    "average_model_load_ms": statistics.mean([m.model_load_time_ms for m in recent if m.model_load_time_ms > 0]) if recent else 0,
                    "average_synthesis_ms": statistics.mean([m.synthesis_time_ms for m in recent]) if recent else 0,
                    "average_first_audio_ms": statistics.mean([m.first_audio_time_ms for m in recent]) if recent else 0
                },
                "optimization_impact": {
                    "cache_usage": sum(1 for m in recent if m.was_cached) / len(recent) * 100 if recent else 0,
                    "preloaded_models": sum(1 for m in recent if m.model_preloaded) / len(recent) * 100 if recent else 0,
                    "gpu_usage": sum(1 for m in recent if m.used_gpu) / len(recent) * 100 if recent else 0,
                    "streaming_usage": sum(1 for m in recent if m.was_streamed) / len(recent) * 100 if recent else 0
                },
                "performance_distribution": {
                    "under_50ms": sum(1 for m in recent if m.total_latency_ms < 50) / len(recent) * 100 if recent else 0,
                    "under_100ms": sum(1 for m in recent if m.total_latency_ms < 100) / len(recent) * 100 if recent else 0,
                    "under_150ms": sum(1 for m in recent if m.total_latency_ms < 150) / len(recent) * 100 if recent else 0,
                    "over_150ms": sum(1 for m in recent if m.total_latency_ms >= 150) / len(recent) * 100 if recent else 0
                }
            }
            
            return breakdown
    
    def add_alert_callback(self, callback: Callable[[str, Dict], None]) -> None:
        """Add callback for performance alerts"""
        self.alert_callbacks.append(callback)
    
    def export_metrics(self, format: str = "json") -> str:
        """Export metrics in specified format"""
        with self.lock:
            data = {
                "stats": self.get_current_stats(),
                "breakdown": self.get_performance_breakdown(),
                "recent_metrics": [
                    {
                        "request_id": m.request_id,
                        "total_latency_ms": m.total_latency_ms,
                        "was_cached": m.was_cached,
                        "realtime_factor": m.realtime_factor,
                        "model_name": m.model_name,
                        "text_length": m.text_length
                    }
                    for m in self.get_recent_metrics(50)
                ]
            }
            
            if format == "json":
                import json
                return json.dumps(data, indent=2)
            else:
                return str(data)
    
    def reset_stats(self) -> None:
        """Reset all statistics and history"""
        with self.lock:
            self.metrics_history.clear()
            self.active_requests.clear()
            self.stats = {
                "total_requests": 0,
                "cache_hits": 0,
                "cache_misses": 0,
                "average_latency_ms": 0.0,
                "p95_latency_ms": 0.0,
                "p99_latency_ms": 0.0,
                "throughput_requests_per_minute": 0.0,
                "average_realtime_factor": 0.0,
                "total_audio_seconds": 0.0,
                "total_synthesis_time_ms": 0.0
            }
        
        perf_logger.info("Performance statistics reset")

# Global performance monitor instance
_performance_monitor: Optional[PerformanceMonitor] = None

def get_performance_monitor() -> PerformanceMonitor:
    """Get global performance monitor instance"""
    if _performance_monitor is None:
        raise RuntimeError("Performance monitor not initialized")
    return _performance_monitor

def init_performance_monitor(history_size: int = 1000):
    """Initialize global performance monitor"""
    global _performance_monitor
    _performance_monitor = PerformanceMonitor(history_size)

def start_request_tracking(request_id: str, text: str, model_name: str):
    """Start tracking a synthesis request"""
    get_performance_monitor().start_request(request_id, text, model_name)

def record_timestamp(request_id: str, event: str):
    """Record a timestamp for a request event"""
    get_performance_monitor().record_timestamp(request_id, event)

def record_metric(request_id: str, metric_name: str, value: Any):
    """Record a metric for a request"""
    get_performance_monitor().record_metric(request_id, metric_name, value)

def complete_request_tracking(request_id: str, audio_duration: float, sample_rate: int) -> SynthesisMetrics:
    """Complete tracking for a request"""
    return get_performance_monitor().complete_request(request_id, audio_duration, sample_rate)

def get_performance_stats() -> Dict[str, Any]:
    """Get current performance statistics"""
    return get_performance_monitor().get_current_stats()

def get_performance_breakdown() -> Dict[str, Any]:
    """Get detailed performance breakdown"""
    return get_performance_monitor().get_performance_breakdown()

def shutdown_performance_monitor():
    """Shutdown global performance monitor"""
    global _performance_monitor
    _performance_monitor = None