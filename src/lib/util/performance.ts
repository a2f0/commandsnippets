/**
 * Performance monitoring utilities for the application
 */

import React from 'react';

export interface PerformanceMetrics {
  componentRenderTime: number;
  dataLoadTime: number;
  userInteractionTime: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  /**
   * Measure the time it takes to execute a function
   */
  measureTime<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();

    this.recordMetric(name, {
      componentRenderTime: end - start,
      dataLoadTime: 0,
      userInteractionTime: 0,
    });

    return result;
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, metric: PerformanceMetrics): void {
    this.metrics.set(name, metric);

    // Log to console in development
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`Performance Metric [${name}]:`, metric);
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get average render time for a component
   */
  getAverageRenderTime(): number {
    const metrics = Array.from(this.metrics.values());
    const componentMetrics = metrics.filter(m => m.componentRenderTime > 0);

    if (componentMetrics.length === 0) return 0;

    const totalTime = componentMetrics.reduce((sum, m) => sum + m.componentRenderTime, 0);
    return totalTime / componentMetrics.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for measuring component render time
 */
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = React.useRef<number>(0);

  React.useEffect(() => {
    startTime.current = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime.current;

      performanceMonitor.recordMetric(componentName, {
        componentRenderTime: renderTime,
        dataLoadTime: 0,
        userInteractionTime: 0,
      });
    };
  });
};
