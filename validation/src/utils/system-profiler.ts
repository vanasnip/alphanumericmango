/**
 * System Resource Profiler for Performance Monitoring
 * Tracks CPU, memory, and other system metrics during benchmarks
 */

import * as os from 'os';

export interface HardwareInfo {
  cpu: string;
  ram: number; // in GB
  platform: string;
  cores: number;
  arch: string;
}

export interface ResourceUsage {
  cpuUsage: number; // percentage
  memoryUsage: number; // in MB
  timestamp: Date;
}

export interface ResourceStatistics {
  avgCpu: number;
  peakCpu: number;
  avgMemory: number;
  peakMemory: number;
}

export class SystemProfiler {
  private measurements: ResourceUsage[] = [];
  private interval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private baselineMemory: number = 0;
  private previousCpuInfo: { idle: number; total: number } | null = null;
  
  /**
   * Start profiling system resources
   */
  start(intervalMs: number = 100): void {
    this.measurements = [];
    this.startTime = Date.now();
    this.baselineMemory = this.getMemoryUsage();
    this.previousCpuInfo = null; // Reset CPU info for accurate measurement
    
    // Start periodic measurements
    this.interval = setInterval(() => {
      this.takeMeasurement();
    }, intervalMs);
    
    console.log('System profiling started');
  }
  
  /**
   * Stop profiling
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.previousCpuInfo = null; // Reset CPU tracking
    console.log(`System profiling stopped. ${this.measurements.length} measurements taken`);
  }
  
  /**
   * Take a single measurement
   */
  private takeMeasurement(): void {
    const usage: ResourceUsage = {
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage() - this.baselineMemory,
      timestamp: new Date()
    };
    
    this.measurements.push(usage);
  }
  
  /**
   * Get current CPU usage percentage using time-averaged measurement
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const currentCpuInfo = {
      idle: totalIdle,
      total: totalTick
    };
    
    // If this is the first measurement, initialize and return 0
    if (!this.previousCpuInfo) {
      this.previousCpuInfo = currentCpuInfo;
      return 0;
    }
    
    // Calculate difference between current and previous measurements
    const idleDiff = currentCpuInfo.idle - this.previousCpuInfo.idle;
    const totalDiff = currentCpuInfo.total - this.previousCpuInfo.total;
    
    // Calculate CPU usage percentage
    const usage = totalDiff === 0 ? 0 : 100 - (100 * idleDiff / totalDiff);
    
    // Update previous CPU info for next measurement
    this.previousCpuInfo = currentCpuInfo;
    
    return Math.max(0, Math.min(100, usage));
  }
  
  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return Math.round(used.heapUsed / 1024 / 1024);
  }
  
  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceUsage {
    return {
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage() - this.baselineMemory,
      timestamp: new Date()
    };
  }
  
  /**
   * Get hardware information
   */
  getHardwareInfo(): HardwareInfo {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    
    return {
      cpu: cpus[0]?.model || 'Unknown',
      ram: Math.round(totalMem / 1024 / 1024 / 1024), // Convert to GB
      platform: os.platform(),
      cores: cpus.length,
      arch: os.arch()
    };
  }
  
  /**
   * Calculate statistics from measurements
   */
  getStatistics(): ResourceStatistics {
    if (this.measurements.length === 0) {
      return {
        avgCpu: 0,
        peakCpu: 0,
        avgMemory: 0,
        peakMemory: 0
      };
    }
    
    const cpuValues = this.measurements.map(m => m.cpuUsage);
    const memValues = this.measurements.map(m => m.memoryUsage);
    
    return {
      avgCpu: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
      peakCpu: Math.max(...cpuValues),
      avgMemory: memValues.reduce((a, b) => a + b, 0) / memValues.length,
      peakMemory: Math.max(...memValues)
    };
  }
  
  /**
   * Get measurements for a specific time range
   */
  getMeasurementsInRange(startTime: Date, endTime: Date): ResourceUsage[] {
    return this.measurements.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }
  
  /**
   * Export measurements to CSV
   */
  exportToCSV(): string {
    const headers = ['timestamp', 'cpu_usage', 'memory_mb'];
    const rows = this.measurements.map(m => [
      m.timestamp.toISOString(),
      m.cpuUsage.toFixed(2),
      m.memoryUsage.toFixed(0)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  /**
   * Reset measurements
   */
  reset(): void {
    this.measurements = [];
    this.baselineMemory = this.getMemoryUsage();
    this.previousCpuInfo = null; // Reset CPU tracking
  }
}