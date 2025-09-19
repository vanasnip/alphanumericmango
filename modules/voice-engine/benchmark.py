#!/usr/bin/env python3
"""
TTS Performance Benchmark Suite
Comprehensive testing of TTS performance optimizations and latency targets
"""

import time
import statistics
import json
import sys
import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

# Configure benchmark logger
benchmark_logger = logging.getLogger('tts.benchmark')
benchmark_logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
benchmark_logger.addHandler(handler)

class PerformanceBenchmark:
    """
    Comprehensive performance benchmark for TTS system
    Tests all optimization layers and validates performance targets
    """
    
    def __init__(self):
        """Initialize benchmark suite"""
        self.results = {
            "timestamp": time.time(),
            "test_summary": {},
            "detailed_results": {},
            "target_compliance": {},
            "optimization_effectiveness": {}
        }
        
        # Performance targets
        self.targets = {
            "max_latency_ms": 150,
            "max_first_audio_ms": 50,  # Streaming target
            "min_cache_hit_rate": 70,
            "max_realtime_factor": 0.3,
            "min_gpu_utilization": 50  # When GPU available
        }
        
        # Test datasets
        self.test_texts = {
            "short": [
                "Hello world",
                "Good morning",
                "Thank you",
                "How are you?",
                "Welcome home"
            ],
            "medium": [
                "This is a medium length sentence for testing text-to-speech synthesis performance.",
                "We are evaluating the latency and quality of the TTS system under normal conditions.",
                "The quick brown fox jumps over the lazy dog in the beautiful meadow.",
                "Machine learning models require careful optimization for production deployment.",
                "Natural language processing has advanced significantly in recent years."
            ],
            "long": [
                "This is a longer paragraph of text designed to test the TTS system's performance with more substantial content. It contains multiple sentences and should provide a good test of streaming synthesis capabilities as well as overall latency characteristics.",
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
                "In the realm of artificial intelligence and machine learning, text-to-speech synthesis represents a fascinating intersection of linguistics, signal processing, and deep learning technologies that continue to evolve at a rapid pace."
            ]
        }
        
        benchmark_logger.info("Performance benchmark initialized")
    
    def run_complete_benchmark(self) -> Dict[str, Any]:
        """
        Run complete benchmark suite
        
        Returns:
            Comprehensive benchmark results
        """
        benchmark_logger.info("Starting complete TTS performance benchmark")
        
        try:
            # Test 1: Cold start performance
            self._test_cold_start_performance()
            
            # Test 2: Cache performance
            self._test_cache_performance()
            
            # Test 3: Model preloading effectiveness
            self._test_model_preloading()
            
            # Test 4: GPU optimization impact
            self._test_gpu_optimization()
            
            # Test 5: Streaming synthesis performance
            self._test_streaming_performance()
            
            # Test 6: Concurrent synthesis performance
            self._test_concurrent_performance()
            
            # Test 7: Memory usage and stability
            self._test_memory_stability()
            
            # Test 8: Latency target validation
            self._validate_latency_targets()
            
            # Generate final analysis
            self._generate_final_analysis()
            
            benchmark_logger.info("Benchmark suite completed successfully")
            
        except Exception as e:
            benchmark_logger.error(f"Benchmark failed: {e}")
            self.results["error"] = str(e)
        
        return self.results
    
    def _test_cold_start_performance(self):
        """Test cold start performance (no preloading)"""
        benchmark_logger.info("Testing cold start performance...")
        
        # Import here to avoid affecting cold start timing
        from tts_service import TTSService
        import tempfile
        
        results = []
        
        for i in range(3):  # Multiple cold starts
            start_time = time.time()
            
            # Create new service instance (cold start)
            service = TTSService(model_name="default")
            
            # Test synthesis
            test_text = "Hello, this is a cold start test."
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_file:
                output_path = service.synthesize(test_text, temp_file.name)
                
                if output_path and Path(output_path).exists():
                    total_time = (time.time() - start_time) * 1000
                    results.append(total_time)
                    benchmark_logger.debug(f"Cold start {i+1}: {total_time:.1f}ms")
            
            # Clean up
            service.shutdown()
        
        self.results["detailed_results"]["cold_start"] = {
            "times_ms": results,
            "average_ms": statistics.mean(results) if results else 0,
            "max_ms": max(results) if results else 0,
            "min_ms": min(results) if results else 0
        }
        
        benchmark_logger.info(f"Cold start average: {statistics.mean(results):.1f}ms")
    
    def _test_cache_performance(self):
        """Test memory cache effectiveness"""
        benchmark_logger.info("Testing cache performance...")
        
        from tts_service import TTSService
        import tempfile
        
        service = TTSService(model_name="fast")
        results = {
            "cache_misses": [],
            "cache_hits": []
        }
        
        # Test cache misses (first time synthesis)
        for text in self.test_texts["short"]:
            start_time = time.time()
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_file:
                output_path = service.synthesize(text, temp_file.name)
                if output_path:
                    latency = (time.time() - start_time) * 1000
                    results["cache_misses"].append(latency)
        
        # Test cache hits (repeat synthesis)
        for text in self.test_texts["short"]:
            start_time = time.time()
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_file:
                output_path = service.synthesize(text, temp_file.name)
                if output_path:
                    latency = (time.time() - start_time) * 1000
                    results["cache_hits"].append(latency)
        
        # Calculate cache effectiveness
        miss_avg = statistics.mean(results["cache_misses"]) if results["cache_misses"] else 0
        hit_avg = statistics.mean(results["cache_hits"]) if results["cache_hits"] else 0
        speedup = miss_avg / hit_avg if hit_avg > 0 else 0
        
        self.results["detailed_results"]["cache"] = {
            "cache_miss_avg_ms": miss_avg,
            "cache_hit_avg_ms": hit_avg,
            "speedup_factor": speedup,
            "cache_effectiveness": ((miss_avg - hit_avg) / miss_avg * 100) if miss_avg > 0 else 0
        }
        
        benchmark_logger.info(f"Cache speedup: {speedup:.1f}x (miss: {miss_avg:.1f}ms, hit: {hit_avg:.1f}ms)")
        service.shutdown()
    
    def _test_model_preloading(self):
        """Test model preloading effectiveness"""
        benchmark_logger.info("Testing model preloading effectiveness...")
        
        # Test with preloading
        from model_pool import init_model_pool, get_model_pool, shutdown_model_pool
        
        # Initialize with preloading
        init_model_pool(max_memory_mb=1500, preload_models=["default", "fast"])
        
        preload_times = []
        for i in range(5):
            start_time = time.time()
            model = get_model_pool().get_model("fast")
            if model:
                preload_times.append((time.time() - start_time) * 1000)
        
        shutdown_model_pool()
        
        # Test without preloading
        init_model_pool(max_memory_mb=1500, preload_models=[])
        
        no_preload_times = []
        for i in range(3):
            start_time = time.time()
            model = get_model_pool().get_model("fast")
            if model:
                no_preload_times.append((time.time() - start_time) * 1000)
        
        preload_avg = statistics.mean(preload_times) if preload_times else 0
        no_preload_avg = statistics.mean(no_preload_times) if no_preload_times else 0
        
        self.results["detailed_results"]["model_preloading"] = {
            "preloaded_avg_ms": preload_avg,
            "not_preloaded_avg_ms": no_preload_avg,
            "preload_speedup": no_preload_avg / preload_avg if preload_avg > 0 else 0
        }
        
        benchmark_logger.info(f"Preloading speedup: {no_preload_avg/preload_avg:.1f}x")
        shutdown_model_pool()
    
    def _test_gpu_optimization(self):
        """Test GPU optimization impact"""
        benchmark_logger.info("Testing GPU optimization...")
        
        try:
            from gpu_optimization import init_gpu_optimizer, get_gpu_optimizer, is_gpu_available
            
            if not is_gpu_available():
                benchmark_logger.info("GPU not available, skipping GPU tests")
                self.results["detailed_results"]["gpu"] = {"available": False}
                return
            
            init_gpu_optimizer()
            gpu_stats = get_gpu_optimizer().get_gpu_stats()
            
            self.results["detailed_results"]["gpu"] = {
                "available": True,
                "device_name": gpu_stats.get("device_name", "Unknown"),
                "memory_gb": gpu_stats.get("memory_total_gb", 0),
                "mixed_precision_enabled": gpu_stats.get("mixed_precision_enabled", False),
                "optimization_enabled": gpu_stats.get("optimization_enabled", False)
            }
            
            benchmark_logger.info(f"GPU: {gpu_stats.get('device_name', 'Unknown')} ({gpu_stats.get('memory_total_gb', 0):.1f}GB)")
            
        except Exception as e:
            benchmark_logger.warning(f"GPU test failed: {e}")
            self.results["detailed_results"]["gpu"] = {"available": False, "error": str(e)}
    
    def _test_streaming_performance(self):
        """Test streaming synthesis performance"""
        benchmark_logger.info("Testing streaming synthesis performance...")
        
        from tts_service import TTSService
        
        service = TTSService(model_name="fast")
        streaming_results = []
        
        for text in self.test_texts["medium"]:
            start_time = time.time()
            first_audio_time = None
            total_chunks = 0
            
            try:
                for chunk in service.synthesize_streaming(text):
                    if chunk.get("type") == "audio" and first_audio_time is None:
                        first_audio_time = (time.time() - start_time) * 1000
                    
                    if chunk.get("type") == "audio":
                        total_chunks += 1
                
                total_time = (time.time() - start_time) * 1000
                
                streaming_results.append({
                    "text_length": len(text),
                    "first_audio_ms": first_audio_time or total_time,
                    "total_time_ms": total_time,
                    "chunks": total_chunks
                })
                
            except Exception as e:
                benchmark_logger.error(f"Streaming test failed: {e}")
        
        if streaming_results:
            avg_first_audio = statistics.mean([r["first_audio_ms"] for r in streaming_results])
            avg_total_time = statistics.mean([r["total_time_ms"] for r in streaming_results])
            
            self.results["detailed_results"]["streaming"] = {
                "average_first_audio_ms": avg_first_audio,
                "average_total_time_ms": avg_total_time,
                "results": streaming_results
            }
            
            benchmark_logger.info(f"Streaming first audio: {avg_first_audio:.1f}ms")
        
        service.shutdown()
    
    def _test_concurrent_performance(self):
        """Test concurrent synthesis performance"""
        benchmark_logger.info("Testing concurrent performance...")
        
        from tts_service import TTSService
        import threading
        import tempfile
        
        service = TTSService(model_name="fast")
        results = []
        errors = []
        
        def synthesis_worker(text: str, worker_id: int):
            try:
                start_time = time.time()
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_file:
                    output_path = service.synthesize(text, temp_file.name)
                    if output_path:
                        latency = (time.time() - start_time) * 1000
                        results.append({"worker_id": worker_id, "latency_ms": latency})
            except Exception as e:
                errors.append({"worker_id": worker_id, "error": str(e)})
        
        # Test with 5 concurrent requests
        threads = []
        texts = self.test_texts["short"] * 2  # 10 texts total
        
        start_time = time.time()
        for i, text in enumerate(texts):
            thread = threading.Thread(target=synthesis_worker, args=(text, i))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join(timeout=30.0)  # 30 second timeout
        
        total_time = (time.time() - start_time) * 1000
        
        self.results["detailed_results"]["concurrent"] = {
            "total_requests": len(texts),
            "successful_requests": len(results),
            "failed_requests": len(errors),
            "total_time_ms": total_time,
            "average_latency_ms": statistics.mean([r["latency_ms"] for r in results]) if results else 0,
            "throughput_requests_per_second": len(results) / (total_time / 1000) if total_time > 0 else 0
        }
        
        benchmark_logger.info(f"Concurrent throughput: {len(results)} requests in {total_time:.1f}ms")
        service.shutdown()
    
    def _test_memory_stability(self):
        """Test memory usage and stability"""
        benchmark_logger.info("Testing memory stability...")
        
        try:
            import psutil
            from tts_service import TTSService
            import tempfile
            
            process = psutil.Process()
            initial_memory = process.memory_info().rss / 1024 / 1024  # MB
            
            service = TTSService(model_name="fast")
            memory_samples = [initial_memory]
            
            # Run 20 synthesis operations
            for i in range(20):
                text = self.test_texts["medium"][i % len(self.test_texts["medium"])]
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_file:
                    service.synthesize(text, temp_file.name)
                
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_samples.append(current_memory)
            
            final_memory = memory_samples[-1]
            memory_growth = final_memory - initial_memory
            max_memory = max(memory_samples)
            
            self.results["detailed_results"]["memory"] = {
                "initial_memory_mb": initial_memory,
                "final_memory_mb": final_memory,
                "max_memory_mb": max_memory,
                "memory_growth_mb": memory_growth,
                "memory_stable": memory_growth < 50  # Less than 50MB growth
            }
            
            benchmark_logger.info(f"Memory growth: {memory_growth:.1f}MB (max: {max_memory:.1f}MB)")
            service.shutdown()
            
        except ImportError:
            benchmark_logger.warning("psutil not available, skipping memory test")
            self.results["detailed_results"]["memory"] = {"error": "psutil not available"}
    
    def _validate_latency_targets(self):
        """Validate that performance targets are met"""
        benchmark_logger.info("Validating latency targets...")
        
        from tts_service import TTSService
        import tempfile
        
        service = TTSService(model_name="fast")
        
        # Test various text lengths
        latency_tests = []
        
        all_texts = (self.test_texts["short"] + 
                    self.test_texts["medium"] + 
                    self.test_texts["long"])
        
        for text in all_texts[:15]:  # Test 15 samples
            start_time = time.time()
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_file:
                output_path = service.synthesize(text, temp_file.name)
                if output_path:
                    latency = (time.time() - start_time) * 1000
                    latency_tests.append({
                        "text_length": len(text),
                        "latency_ms": latency,
                        "meets_target": latency <= self.targets["max_latency_ms"]
                    })
        
        # Calculate compliance
        compliant_requests = sum(1 for test in latency_tests if test["meets_target"])
        compliance_rate = (compliant_requests / len(latency_tests)) * 100 if latency_tests else 0
        avg_latency = statistics.mean([test["latency_ms"] for test in latency_tests]) if latency_tests else 0
        
        self.results["target_compliance"] = {
            "latency_target_ms": self.targets["max_latency_ms"],
            "average_latency_ms": avg_latency,
            "compliance_rate_percent": compliance_rate,
            "meets_target": avg_latency <= self.targets["max_latency_ms"],
            "test_results": latency_tests
        }
        
        benchmark_logger.info(f"Latency compliance: {compliance_rate:.1f}% (avg: {avg_latency:.1f}ms)")
        service.shutdown()
    
    def _generate_final_analysis(self):
        """Generate final benchmark analysis"""
        benchmark_logger.info("Generating final analysis...")
        
        # Analyze optimization effectiveness
        cache_results = self.results["detailed_results"].get("cache", {})
        if cache_results:
            cache_speedup = cache_results.get("speedup_factor", 0)
            cache_effective = cache_speedup > 5  # At least 5x speedup
        else:
            cache_effective = False
        
        preload_results = self.results["detailed_results"].get("model_preloading", {})
        if preload_results:
            preload_speedup = preload_results.get("preload_speedup", 0)
            preload_effective = preload_speedup > 10  # At least 10x speedup
        else:
            preload_effective = False
        
        gpu_results = self.results["detailed_results"].get("gpu", {})
        gpu_available = gpu_results.get("available", False)
        
        streaming_results = self.results["detailed_results"].get("streaming", {})
        if streaming_results:
            first_audio_time = streaming_results.get("average_first_audio_ms", 0)
            streaming_effective = first_audio_time <= self.targets["max_first_audio_ms"]
        else:
            streaming_effective = False
        
        memory_results = self.results["detailed_results"].get("memory", {})
        memory_stable = memory_results.get("memory_stable", False)
        
        # Overall assessment
        target_compliance = self.results.get("target_compliance", {})
        meets_latency_target = target_compliance.get("meets_target", False)
        compliance_rate = target_compliance.get("compliance_rate_percent", 0)
        
        self.results["test_summary"] = {
            "overall_success": meets_latency_target and compliance_rate >= 80,
            "meets_150ms_target": meets_latency_target,
            "compliance_rate": compliance_rate,
            "optimizations_effective": {
                "cache": cache_effective,
                "model_preloading": preload_effective,
                "gpu_acceleration": gpu_available,
                "streaming": streaming_effective,
                "memory_stable": memory_stable
            },
            "recommendation": self._generate_recommendations()
        }
        
        benchmark_logger.info(f"Benchmark complete - Target compliance: {compliance_rate:.1f}%")
    
    def _generate_recommendations(self) -> List[str]:
        """Generate performance improvement recommendations"""
        recommendations = []
        
        target_compliance = self.results.get("target_compliance", {})
        avg_latency = target_compliance.get("average_latency_ms", 0)
        
        if avg_latency > self.targets["max_latency_ms"]:
            recommendations.append(f"Average latency ({avg_latency:.1f}ms) exceeds target ({self.targets['max_latency_ms']}ms)")
        
        cache_results = self.results["detailed_results"].get("cache", {})
        if cache_results.get("speedup_factor", 0) < 5:
            recommendations.append("Memory cache not providing sufficient speedup - consider increasing cache size")
        
        gpu_results = self.results["detailed_results"].get("gpu", {})
        if not gpu_results.get("available", False):
            recommendations.append("GPU acceleration not available - consider adding GPU support for better performance")
        
        concurrent_results = self.results["detailed_results"].get("concurrent", {})
        if concurrent_results.get("failed_requests", 0) > 0:
            recommendations.append("Some concurrent requests failed - review thread safety and resource limits")
        
        memory_results = self.results["detailed_results"].get("memory", {})
        if not memory_results.get("memory_stable", True):
            recommendations.append("Memory usage growing - investigate potential memory leaks")
        
        if not recommendations:
            recommendations.append("All performance targets met - system performing optimally")
        
        return recommendations
    
    def export_results(self, output_path: str):
        """Export benchmark results to file"""
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2)
        benchmark_logger.info(f"Results exported to {output_path}")

def main():
    """Run TTS performance benchmark"""
    benchmark_logger.info("Starting TTS Performance Benchmark Suite")
    
    benchmark = PerformanceBenchmark()
    results = benchmark.run_complete_benchmark()
    
    # Print summary
    print("\n" + "="*60)
    print("TTS PERFORMANCE BENCHMARK RESULTS")
    print("="*60)
    
    test_summary = results.get("test_summary", {})
    print(f"Overall Success: {'✓' if test_summary.get('overall_success') else '✗'}")
    print(f"Meets 150ms Target: {'✓' if test_summary.get('meets_150ms_target') else '✗'}")
    print(f"Compliance Rate: {test_summary.get('compliance_rate', 0):.1f}%")
    
    target_compliance = results.get("target_compliance", {})
    print(f"Average Latency: {target_compliance.get('average_latency_ms', 0):.1f}ms")
    
    print("\nOptimization Effectiveness:")
    optimizations = test_summary.get("optimizations_effective", {})
    for opt, effective in optimizations.items():
        print(f"  {opt}: {'✓' if effective else '✗'}")
    
    print("\nRecommendations:")
    for rec in test_summary.get("recommendation", []):
        print(f"  • {rec}")
    
    # Export detailed results
    output_file = f"benchmark_results_{int(time.time())}.json"
    benchmark.export_results(output_file)
    print(f"\nDetailed results saved to: {output_file}")

if __name__ == "__main__":
    main()