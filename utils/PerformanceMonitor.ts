interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private memoryUsage: number[] = [];
  private isMonitoring = false;

  startTiming(name: string): void {
    const startTime = performance.now();
    this.metrics.set(name, {
      name,
      startTime,
    });
    
    if (__DEV__) {
      console.log(`🚀 Starting performance monitoring: ${name}`);
    }
  }

  endTiming(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    if (__DEV__) {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  getMetric(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  startMemoryMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    if (__DEV__) {
      console.log('📊 Starting memory monitoring');
    }

    // Monitor memory usage every 30 seconds
    const interval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(interval);
        return;
      }

      this.recordMemoryUsage();
    }, 30000);

    // Store interval ID for cleanup
    (this as any).memoryInterval = interval;
  }

  stopMemoryMonitoring(): void {
    this.isMonitoring = false;
    
    if ((this as any).memoryInterval) {
      clearInterval((this as any).memoryInterval);
      (this as any).memoryInterval = null;
    }

    if (__DEV__) {
      console.log('📊 Stopped memory monitoring');
    }
  }

  private recordMemoryUsage(): void {
    try {
      // Basic memory monitoring - in a real app you might use more sophisticated tools
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        const usedMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
        this.memoryUsage.push(usedMB);
        
        // Keep only last 100 measurements
        if (this.memoryUsage.length > 100) {
          this.memoryUsage.shift();
        }

        if (__DEV__) {
          console.log(`🧠 Memory usage: ${usedMB.toFixed(2)} MB`);
          
          // Alert if memory usage is high
          if (usedMB > 100) {
            console.warn(`⚠️ High memory usage detected: ${usedMB.toFixed(2)} MB`);
          }
        }
      }
    } catch (error) {
      // Memory monitoring not available
    }
  }

  getMemoryStats(): {
    current: number;
    average: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } | null {
    if (this.memoryUsage.length === 0) return null;

    const current = this.memoryUsage[this.memoryUsage.length - 1];
    const average = this.memoryUsage.reduce((sum, val) => sum + val, 0) / this.memoryUsage.length;
    const max = Math.max(...this.memoryUsage);

    // Calculate trend based on last 10 measurements
    const recent = this.memoryUsage.slice(-10);
    const trend = this.calculateTrend(recent);

    return {
      current,
      average,
      max,
      trend,
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;
    const threshold = firstAvg * 0.05; // 5% threshold

    if (difference > threshold) return 'increasing';
    if (difference < -threshold) return 'decreasing';
    return 'stable';
  }

  // Database performance monitoring
  async monitorDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    this.startTiming(`db_${operationName}`);
    
    try {
      const result = await operation();
      const duration = this.endTiming(`db_${operationName}`);
      
      if (__DEV__ && duration && duration > 1000) {
        console.warn(`⚠️ Slow database operation: ${operationName} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      this.endTiming(`db_${operationName}`);
      throw error;
    }
  }

  // Component render monitoring
  monitorComponentRender(componentName: string, renderFunction: () => void): void {
    this.startTiming(`render_${componentName}`);
    renderFunction();
    this.endTiming(`render_${componentName}`);
  }

  // Network request monitoring
  async monitorNetworkRequest<T>(
    request: () => Promise<T>,
    requestName: string
  ): Promise<T> {
    this.startTiming(`network_${requestName}`);
    
    try {
      const result = await request();
      const duration = this.endTiming(`network_${requestName}`);
      
      if (__DEV__ && duration && duration > 5000) {
        console.warn(`⚠️ Slow network request: ${requestName} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      this.endTiming(`network_${requestName}`);
      throw error;
    }
  }

  // Generate performance report
  generateReport(): string {
    const metrics = this.getAllMetrics();
    const memoryStats = this.getMemoryStats();

    let report = '📊 Performance Report\n';
    report += '='.repeat(30) + '\n\n';

    // Timing metrics
    report += '⏱️ Timing Metrics:\n';
    metrics.forEach(metric => {
      if (metric.duration) {
        report += `  ${metric.name}: ${metric.duration.toFixed(2)}ms\n`;
      }
    });

    // Memory stats
    if (memoryStats) {
      report += '\n🧠 Memory Stats:\n';
      report += `  Current: ${memoryStats.current.toFixed(2)} MB\n`;
      report += `  Average: ${memoryStats.average.toFixed(2)} MB\n`;
      report += `  Max: ${memoryStats.max.toFixed(2)} MB\n`;
      report += `  Trend: ${memoryStats.trend}\n`;
    }

    return report;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper functions for easy usage
export const startTiming = (name: string) => performanceMonitor.startTiming(name);
export const endTiming = (name: string) => performanceMonitor.endTiming(name);
export const monitorDatabase = <T>(operation: () => Promise<T>, name: string) => 
  performanceMonitor.monitorDatabaseOperation(operation, name);
export const monitorNetwork = <T>(request: () => Promise<T>, name: string) => 
  performanceMonitor.monitorNetworkRequest(request, name);
export const startMemoryMonitoring = () => performanceMonitor.startMemoryMonitoring();
export const stopMemoryMonitoring = () => performanceMonitor.stopMemoryMonitoring();
export const getPerformanceReport = () => performanceMonitor.generateReport();
