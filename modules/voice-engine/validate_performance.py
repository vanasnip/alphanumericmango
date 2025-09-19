#!/usr/bin/env python3
"""
Performance Validation Script
Quick validation of TTS performance optimizations and <150ms latency target
"""

import time
import statistics
import sys
from pathlib import Path

def validate_performance():
    """Validate TTS performance meets requirements"""
    print("🚀 TTS Performance Validation")
    print("="*50)
    
    try:
        # Test 1: Import and initialization time
        print("1. Testing system initialization...")
        init_start = time.time()
        
        from tts_service import TTSService
        service = TTSService(model_name="fast")
        
        init_time = (time.time() - init_start) * 1000
        print(f"   ✓ Initialization: {init_time:.1f}ms")
        
        # Test 2: Basic synthesis latency
        print("\n2. Testing synthesis latency...")
        test_texts = [
            "Hello world",
            "This is a test",
            "Good morning everyone",
            "Testing TTS performance",
            "Voice synthesis validation"
        ]
        
        latencies = []
        cache_hits = []
        
        # First round (cache misses)
        for i, text in enumerate(test_texts):
            start_time = time.time()
            try:
                # Use a temporary path
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    output_path = service.synthesize(text, temp_file.name)
                    if output_path and Path(output_path).exists():
                        latency = (time.time() - start_time) * 1000
                        latencies.append(latency)
                        print(f"   Text {i+1}: {latency:.1f}ms")
                        
                        # Clean up
                        Path(output_path).unlink(missing_ok=True)
            except Exception as e:
                print(f"   ✗ Text {i+1} failed: {e}")
        
        # Second round (cache hits)
        print("\n3. Testing cache performance...")
        for i, text in enumerate(test_texts[:3]):  # Test first 3 for cache hits
            start_time = time.time()
            try:
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    output_path = service.synthesize(text, temp_file.name)
                    if output_path and Path(output_path).exists():
                        cache_latency = (time.time() - start_time) * 1000
                        cache_hits.append(cache_latency)
                        print(f"   Cache hit {i+1}: {cache_latency:.1f}ms")
                        
                        # Clean up
                        Path(output_path).unlink(missing_ok=True)
            except Exception as e:
                print(f"   ✗ Cache test {i+1} failed: {e}")
        
        # Test 3: Streaming performance
        print("\n4. Testing streaming performance...")
        streaming_times = []
        
        for i, text in enumerate(["Testing streaming synthesis performance with real-time audio generation."]):
            start_time = time.time()
            first_audio_time = None
            chunk_count = 0
            
            try:
                for chunk in service.synthesize_streaming(text):
                    if chunk.get("type") == "audio" and first_audio_time is None:
                        first_audio_time = (time.time() - start_time) * 1000
                    if chunk.get("type") == "audio":
                        chunk_count += 1
                
                total_time = (time.time() - start_time) * 1000
                streaming_times.append({
                    "first_audio_ms": first_audio_time or total_time,
                    "total_time_ms": total_time,
                    "chunks": chunk_count
                })
                print(f"   Streaming: first audio in {first_audio_time or total_time:.1f}ms, {chunk_count} chunks")
                
            except Exception as e:
                print(f"   ✗ Streaming test failed: {e}")
        
        # Test 4: Get performance metrics
        print("\n5. System performance metrics...")
        try:
            metrics = service.get_metrics()
            perf_data = metrics.get("performance_monitoring", {})
            
            if perf_data:
                print(f"   Average latency: {perf_data.get('average_latency_ms', 0):.1f}ms")
                print(f"   Cache hit rate: {perf_data.get('cache_hit_rate', 0):.1f}%")
                print(f"   Total requests: {perf_data.get('total_requests', 0)}")
            
            # Model pool metrics
            model_metrics = metrics.get("model_pool", {})
            if model_metrics:
                print(f"   Model pool hit rate: {model_metrics.get('hit_rate_percent', 0):.1f}%")
                print(f"   Models loaded: {model_metrics.get('models_in_pool', 0)}")
            
            # Cache metrics
            cache_metrics = metrics.get("memory_cache", {})
            if cache_metrics:
                print(f"   Memory cache entries: {cache_metrics.get('current_entries', 0)}")
                print(f"   Memory usage: {cache_metrics.get('memory_usage_mb', 0):.1f}MB")
                print(f"   Cache hit rate: {cache_metrics.get('hit_rate', 0):.1f}%")
            
        except Exception as e:
            print(f"   ⚠ Could not retrieve metrics: {e}")
        
        # Analysis
        print("\n" + "="*50)
        print("📊 PERFORMANCE ANALYSIS")
        print("="*50)
        
        if latencies:
            avg_latency = statistics.mean(latencies)
            max_latency = max(latencies)
            min_latency = min(latencies)
            
            print(f"Synthesis Performance:")
            print(f"  Average latency: {avg_latency:.1f}ms")
            print(f"  Range: {min_latency:.1f}ms - {max_latency:.1f}ms")
            
            # Target validation
            target_150ms = avg_latency <= 150
            print(f"  150ms target: {'✓ PASS' if target_150ms else '✗ FAIL'}")
            
            if not target_150ms:
                print(f"  ⚠ Exceeds target by {avg_latency - 150:.1f}ms")
        
        if cache_hits:
            cache_avg = statistics.mean(cache_hits)
            if latencies:
                speedup = statistics.mean(latencies) / cache_avg
                print(f"\nCache Performance:")
                print(f"  Cache hit latency: {cache_avg:.1f}ms")
                print(f"  Cache speedup: {speedup:.1f}x")
                print(f"  Cache effective: {'✓ YES' if speedup > 2 else '✗ NO'}")
        
        if streaming_times:
            first_audio_times = [s["first_audio_ms"] for s in streaming_times]
            avg_first_audio = statistics.mean(first_audio_times)
            print(f"\nStreaming Performance:")
            print(f"  First audio: {avg_first_audio:.1f}ms")
            print(f"  Streaming target (50ms): {'✓ PASS' if avg_first_audio <= 50 else '✗ FAIL'}")
        
        # Overall assessment
        print(f"\n{'='*50}")
        print("🎯 OVERALL ASSESSMENT")
        print(f"{'='*50}")
        
        success_criteria = []
        
        if latencies:
            avg_latency = statistics.mean(latencies)
            success_criteria.append(("150ms latency target", avg_latency <= 150))
        
        if cache_hits and latencies:
            cache_speedup = statistics.mean(latencies) / statistics.mean(cache_hits)
            success_criteria.append(("Cache providing speedup", cache_speedup > 2))
        
        if streaming_times:
            avg_first_audio = statistics.mean([s["first_audio_ms"] for s in streaming_times])
            success_criteria.append(("Streaming first audio <50ms", avg_first_audio <= 50))
        
        success_criteria.append(("System initialization", init_time < 5000))  # 5 second limit
        
        passed = sum(1 for _, result in success_criteria if result)
        total = len(success_criteria)
        
        for criterion, result in success_criteria:
            print(f"  {criterion}: {'✓ PASS' if result else '✗ FAIL'}")
        
        overall_success = passed == total
        print(f"\n🏆 RESULT: {'SUCCESS' if overall_success else 'NEEDS OPTIMIZATION'} ({passed}/{total} criteria passed)")
        
        if overall_success:
            print("   All performance targets met! 🎉")
        else:
            print("   Some optimizations may be needed.")
            
        # Clean up
        service.shutdown()
        
        return overall_success
        
    except ImportError as e:
        print(f"✗ Import error: {e}")
        print("Make sure all TTS dependencies are installed")
        return False
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False

if __name__ == "__main__":
    success = validate_performance()
    sys.exit(0 if success else 1)