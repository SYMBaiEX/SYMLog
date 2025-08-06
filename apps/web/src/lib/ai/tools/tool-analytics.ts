import { z } from 'zod';
import { logError as logErrorToConsole } from '@/lib/logger';
import type {
  EnhancedToolResult,
  ToolExecutionContext,
} from './enhanced-tools';

// Create a logger wrapper
const loggingService = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: any) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: any) => logErrorToConsole(message, data),
  debug: (message: string, data?: any) =>
    console.debug(`[DEBUG] ${message}`, data),
};

import type { ToolProgressUpdate } from '../streaming/streaming-progress';

// Tool usage metrics
export interface ToolUsageMetrics {
  toolName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  medianExecutionTime: number;
  totalExecutionTime: number;
  errorTypes: Record<string, number>;
  lastUsed: number;
  firstUsed: number;
  userDistribution: Record<string, number>;
  peakUsageHours: number[];
}

// Tool performance data
export interface ToolPerformanceData {
  executionId: string;
  toolName: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
  endTime: number;
  executionTime: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  inputSize: number;
  outputSize: number;
  progressUpdates: number;
  retryCount: number;
  memoryUsage?: number;
  cpuUsage?: number;
  metadata: Record<string, any>;
}

// Analytics configuration
export interface AnalyticsConfig {
  enableMetrics: boolean;
  enablePerformanceTracking: boolean;
  enableErrorAnalysis: boolean;
  enableUserAnalytics: boolean;
  retentionDays: number;
  samplingRate: number; // 0-1, for performance
  alertThresholds: {
    errorRate: number;
    avgExecutionTime: number;
    failureStreak: number;
  };
}

// Alert types
export interface ToolAlert {
  id: string;
  type: 'error_rate' | 'performance' | 'failure_streak' | 'availability';
  toolName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  acknowledged: boolean;
  metadata: Record<string, any>;
}

// Analytics aggregation periods
export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month';

/**
 * Tool Analytics and Monitoring System
 * Tracks usage, performance, and errors for comprehensive tool monitoring
 */
export class ToolAnalyticsService {
  private static instance: ToolAnalyticsService;
  private performanceData: ToolPerformanceData[] = [];
  private metricsCache = new Map<string, ToolUsageMetrics>();
  private alerts: ToolAlert[] = [];
  private readonly MAX_PERFORMANCE_DATA_SIZE = 10_000; // Prevent unbounded growth
  private config: AnalyticsConfig = {
    enableMetrics: true,
    enablePerformanceTracking: true,
    enableErrorAnalysis: true,
    enableUserAnalytics: true,
    retentionDays: 30,
    samplingRate: 1.0,
    alertThresholds: {
      errorRate: 0.1, // 10% error rate
      avgExecutionTime: 10_000, // 10 seconds
      failureStreak: 5, // 5 consecutive failures
    },
  };

  private constructor() {
    this.startPeriodicCleanup();
    this.startMetricsRefresh();
  }

  static getInstance(): ToolAnalyticsService {
    if (!ToolAnalyticsService.instance) {
      ToolAnalyticsService.instance = new ToolAnalyticsService();
    }
    return ToolAnalyticsService.instance;
  }

  /**
   * Track tool execution
   */
  trackExecution(
    toolName: string,
    executionId: string,
    context: ToolExecutionContext = {},
    metadata: Record<string, any> = {}
  ): ToolExecutionTracker {
    const tracker = new ToolExecutionTracker(
      toolName,
      executionId,
      context,
      metadata,
      this
    );

    return tracker;
  }

  /**
   * Record tool execution data
   */
  recordExecution(executionData: ToolPerformanceData): void {
    // Apply sampling if configured
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    // Validate and sanitize input data
    const sanitizedData = this.sanitizeExecutionData(executionData);

    this.performanceData.push(sanitizedData);

    // Prevent unbounded growth by removing old data if needed
    if (this.performanceData.length > this.MAX_PERFORMANCE_DATA_SIZE) {
      // Remove oldest 20% when limit is reached
      const removeCount = Math.floor(this.MAX_PERFORMANCE_DATA_SIZE * 0.2);
      this.performanceData.splice(0, removeCount);
      loggingService.info('Trimmed old performance data', {
        removedCount: removeCount,
        remainingCount: this.performanceData.length,
      });
    }

    // Invalidate metrics cache for this tool
    this.metricsCache.delete(sanitizedData.toolName);

    // Check for alerts
    this.checkAlerts(sanitizedData);

    loggingService.debug('Tool execution recorded', {
      toolName: sanitizedData.toolName,
      executionTime: sanitizedData.executionTime,
      success: sanitizedData.success,
      executionId: sanitizedData.executionId,
    });
  }

  /**
   * Get tool usage metrics
   */
  getToolMetrics(toolName: string, forceRefresh = false): ToolUsageMetrics {
    if (!forceRefresh && this.metricsCache.has(toolName)) {
      return this.metricsCache.get(toolName)!;
    }

    const toolData = this.performanceData.filter(
      (performanceRecord) => performanceRecord.toolName === toolName
    );

    if (toolData.length === 0) {
      const emptyMetrics: ToolUsageMetrics = {
        toolName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        totalExecutionTime: 0,
        errorTypes: {},
        lastUsed: 0,
        firstUsed: 0,
        userDistribution: {},
        peakUsageHours: [],
      };

      this.metricsCache.set(toolName, emptyMetrics);
      return emptyMetrics;
    }

    const successfulExecutions = toolData.filter(
      (performanceRecord) => performanceRecord.success
    ).length;
    const failedExecutions = toolData.length - successfulExecutions;
    const executionTimes = toolData
      .map((performanceRecord) => performanceRecord.executionTime)
      .sort((a, b) => a - b);
    const totalExecutionTime = executionTimes.reduce(
      (sum, time) => sum + time,
      0
    );

    // Calculate error types
    const errorTypes: Record<string, number> = {};
    toolData
      .filter((performanceRecord) => !performanceRecord.success)
      .forEach((performanceRecord) => {
        const errorType = performanceRecord.errorType || 'unknown';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });

    // Calculate user distribution
    const userDistribution: Record<string, number> = {};
    toolData.forEach((performanceRecord) => {
      const userId = performanceRecord.userId || 'anonymous';
      userDistribution[userId] = (userDistribution[userId] || 0) + 1;
    });

    // Calculate peak usage hours
    const hourCounts = new Array(24).fill(0);
    toolData.forEach((performanceRecord) => {
      const hour = new Date(performanceRecord.startTime).getHours();
      hourCounts[hour]++;
    });
    const maxCount = Math.max(...hourCounts);
    const peakUsageHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count >= maxCount * 0.8) // Within 80% of peak
      .map(({ hour }) => hour);

    const metrics: ToolUsageMetrics = {
      toolName,
      totalExecutions: toolData.length,
      successfulExecutions,
      failedExecutions,
      successRate:
        toolData.length > 0 ? successfulExecutions / toolData.length : 0,
      averageExecutionTime:
        toolData.length > 0 ? totalExecutionTime / toolData.length : 0,
      medianExecutionTime:
        executionTimes.length > 0
          ? executionTimes[Math.floor(executionTimes.length / 2)]
          : 0,
      totalExecutionTime,
      errorTypes,
      lastUsed: Math.max(
        ...toolData.map((performanceRecord) => performanceRecord.endTime)
      ),
      firstUsed: Math.min(
        ...toolData.map((performanceRecord) => performanceRecord.startTime)
      ),
      userDistribution,
      peakUsageHours,
    };

    this.metricsCache.set(toolName, metrics);
    return metrics;
  }

  /**
   * Get aggregated metrics for all tools
   */
  getAllToolMetrics(): Record<string, ToolUsageMetrics> {
    const toolNames = [
      ...new Set(
        this.performanceData.map(
          (performanceRecord) => performanceRecord.toolName
        )
      ),
    ];
    const metrics: Record<string, ToolUsageMetrics> = {};

    for (const toolName of toolNames) {
      metrics[toolName] = this.getToolMetrics(toolName);
    }

    return metrics;
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(
    toolName: string,
    period: AggregationPeriod = 'day',
    days = 7
  ): Array<{
    timestamp: number;
    executionCount: number;
    successRate: number;
    avgExecutionTime: number;
    errorCount: number;
  }> {
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    const toolData = this.performanceData.filter(
      (d) =>
        d.toolName === toolName &&
        d.startTime >= startTime &&
        d.startTime <= endTime
    );

    const periodMs = this.getPeriodMilliseconds(period);
    const buckets = new Map<number, ToolPerformanceData[]>();

    // Group data into time buckets
    toolData.forEach((data) => {
      const bucketKey = Math.floor(data.startTime / periodMs) * periodMs;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(data);
    });

    // Calculate trends for each bucket
    const trends = Array.from(buckets.entries())
      .map(([timestamp, data]) => {
        const successfulCount = data.filter((d) => d.success).length;
        const totalTime = data.reduce((sum, d) => sum + d.executionTime, 0);

        return {
          timestamp,
          executionCount: data.length,
          successRate: data.length > 0 ? successfulCount / data.length : 0,
          avgExecutionTime: data.length > 0 ? totalTime / data.length : 0,
          errorCount: data.length - successfulCount,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    return trends;
  }

  /**
   * Get current alerts
   */
  getAlerts(toolName?: string): ToolAlert[] {
    if (toolName) {
      return this.alerts.filter((alert) => alert.toolName === toolName);
    }
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const initialCount = this.alerts.length;

    this.alerts = this.alerts.filter(
      (alert) => alert.timestamp > cutoff || !alert.acknowledged
    );

    return initialCount - this.alerts.length;
  }

  /**
   * Get system health overview
   */
  getHealthOverview(): {
    totalExecutions: number;
    overallSuccessRate: number;
    activeAlerts: number;
    criticalAlerts: number;
    avgResponseTime: number;
    toolsCount: number;
    topErrors: Array<{ error: string; count: number }>;
  } {
    const totalExecutions = this.performanceData.length;
    const successfulExecutions = this.performanceData.filter(
      (d) => d.success
    ).length;
    const overallSuccessRate =
      totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;

    const activeAlerts = this.alerts.filter((a) => !a.acknowledged).length;
    const criticalAlerts = this.alerts.filter(
      (a) => !a.acknowledged && a.severity === 'critical'
    ).length;

    const totalTime = this.performanceData.reduce(
      (sum, d) => sum + d.executionTime,
      0
    );
    const avgResponseTime =
      totalExecutions > 0 ? totalTime / totalExecutions : 0;

    const toolsCount = new Set(this.performanceData.map((d) => d.toolName))
      .size;

    // Top errors
    const errorCounts = new Map<string, number>();
    this.performanceData
      .filter((d) => !d.success)
      .forEach((d) => {
        const error = d.errorMessage || d.errorType || 'Unknown error';
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      });

    const topErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalExecutions,
      overallSuccessRate,
      activeAlerts,
      criticalAlerts,
      avgResponseTime,
      toolsCount,
      topErrors,
    };
  }

  /**
   * Update analytics configuration
   */
  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    loggingService.info('Analytics configuration updated', newConfig);
  }

  /**
   * Export analytics data
   */
  exportData(toolName?: string, format: 'json' | 'csv' = 'json'): string {
    const data = toolName
      ? this.performanceData.filter((d) => d.toolName === toolName)
      : this.performanceData;

    if (format === 'csv') {
      return this.toCsv(data);
    }

    return JSON.stringify(data, null, 2);
  }

  // Private helper methods

  private sanitizeExecutionData(
    executionData: ToolPerformanceData
  ): ToolPerformanceData {
    // Validate input to prevent null pointer exceptions
    if (!executionData || typeof executionData !== 'object') {
      throw new Error('Invalid execution data: must be a valid object');
    }

    // Validate required fields and sanitize data to prevent log injection
    const sanitized: ToolPerformanceData = {
      executionId: this.sanitizeString(executionData.executionId) || 'unknown',
      toolName: this.sanitizeString(executionData.toolName) || 'unknown',
      userId: executionData.userId
        ? this.sanitizeString(executionData.userId)
        : undefined,
      sessionId: executionData.sessionId
        ? this.sanitizeString(executionData.sessionId)
        : undefined,
      startTime: Math.max(0, executionData.startTime || 0), // Ensure positive
      endTime: Math.max(0, executionData.endTime || 0),
      executionTime: Math.max(0, executionData.executionTime || 0),
      success: Boolean(executionData.success),
      errorType: executionData.errorType
        ? this.sanitizeString(executionData.errorType)
        : undefined,
      errorMessage: executionData.errorMessage
        ? this.sanitizeString(executionData.errorMessage)
        : undefined,
      inputSize: Math.max(0, executionData.inputSize || 0),
      outputSize: Math.max(0, executionData.outputSize || 0),
      progressUpdates: Math.max(0, executionData.progressUpdates || 0),
      retryCount: Math.max(0, executionData.retryCount || 0),
      memoryUsage: executionData.memoryUsage
        ? Math.max(0, executionData.memoryUsage)
        : undefined,
      cpuUsage: executionData.cpuUsage
        ? Math.max(0, executionData.cpuUsage)
        : undefined,
      metadata: executionData.metadata || {},
    };

    return sanitized;
  }

  private sanitizeString(input: string): string {
    // Basic sanitization to prevent log injection
    if (typeof input !== 'string') return '';
    return input.replace(/[\r\n\t]/g, ' ').substring(0, 1000); // Limit length and remove newlines
  }

  private checkAlerts(performanceData: ToolPerformanceData): void {
    if (!this.config.enableErrorAnalysis) return;

    const metrics = this.getToolMetrics(performanceData.toolName, true);

    // Check error rate threshold
    if (metrics.successRate < 1 - this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error_rate',
        toolName: performanceData.toolName,
        severity: 'high',
        message: `High error rate detected: ${((1 - metrics.successRate) * 100).toFixed(1)}%`,
        threshold: this.config.alertThresholds.errorRate,
        currentValue: 1 - metrics.successRate,
        metadata: { errorTypes: metrics.errorTypes },
      });
    }

    // Check execution time threshold
    if (
      metrics.averageExecutionTime >
      this.config.alertThresholds.avgExecutionTime
    ) {
      this.createAlert({
        type: 'performance',
        toolName: performanceData.toolName,
        severity: 'medium',
        message: `Slow execution time: ${metrics.averageExecutionTime.toFixed(0)}ms`,
        threshold: this.config.alertThresholds.avgExecutionTime,
        currentValue: metrics.averageExecutionTime,
        metadata: { medianTime: metrics.medianExecutionTime },
      });
    }

    // Check failure streak
    const recentFailures = this.getRecentFailureStreak(
      performanceData.toolName
    );
    if (recentFailures >= this.config.alertThresholds.failureStreak) {
      this.createAlert({
        type: 'failure_streak',
        toolName: performanceData.toolName,
        severity: 'critical',
        message: `${recentFailures} consecutive failures detected`,
        threshold: this.config.alertThresholds.failureStreak,
        currentValue: recentFailures,
        metadata: { lastError: performanceData.errorMessage },
      });
    }
  }

  private createAlert(
    alertData: Omit<ToolAlert, 'id' | 'timestamp' | 'acknowledged'>
  ): void {
    // Check if similar alert already exists and is not acknowledged
    const existingAlert = this.alerts.find(
      (alert) =>
        alert.toolName === alertData.toolName &&
        alert.type === alertData.type &&
        !alert.acknowledged &&
        Date.now() - alert.timestamp < 60 * 60 * 1000 // Within last hour
    );

    if (existingAlert) {
      // Update existing alert
      existingAlert.currentValue = alertData.currentValue;
      existingAlert.timestamp = Date.now();
      existingAlert.metadata = {
        ...existingAlert.metadata,
        ...alertData.metadata,
      };
      return;
    }

    const alert: ToolAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      timestamp: Date.now(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.push(alert);

    loggingService.warn('Tool alert created', {
      alertId: alert.id,
      type: alert.type,
      toolName: alert.toolName,
      severity: alert.severity,
      message: alert.message,
    });
  }

  private getRecentFailureStreak(toolName: string): number {
    const recentData = this.performanceData
      .filter((d) => d.toolName === toolName)
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, 10); // Check last 10 executions

    let streak = 0;
    for (const data of recentData) {
      if (data.success) {
        break;
      }
      streak++;
    }

    return streak;
  }

  private getPeriodMilliseconds(period: AggregationPeriod): number {
    switch (period) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000; // Using 30 days as approximation for month period (standard analytics practice)
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old data every hour
    setInterval(
      () => {
        const cutoff =
          Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
        const initialCount = this.performanceData.length;

        this.performanceData = this.performanceData.filter(
          (d) => d.startTime > cutoff
        );

        if (initialCount > this.performanceData.length) {
          this.metricsCache.clear(); // Invalidate cache after cleanup
          loggingService.info('Analytics data cleaned up', {
            removedRecords: initialCount - this.performanceData.length,
            remainingRecords: this.performanceData.length,
          });
        }

        // Clean up old alerts
        this.clearOldAlerts();
      },
      60 * 60 * 1000
    ); // Every hour
  }

  private startMetricsRefresh(): void {
    // Refresh metrics cache every 5 minutes
    setInterval(
      () => {
        this.metricsCache.clear();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Escape CSV string value according to RFC 4180 standards
   */
  private escapeCsvValue(value: any): string {
    if (typeof value !== 'string') return String(value);

    // Escape quotes by doubling them and wrap in quotes if contains special characters
    const escaped = value.replace(/"/g, '""');
    return escaped.includes(',') ||
      escaped.includes('"') ||
      escaped.includes('\n')
      ? `"${escaped}"`
      : escaped;
  }

  private toCsv(data: ToolPerformanceData[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row)
        .map((value) => this.escapeCsvValue(value))
        .join(',')
    );

    return [headers, ...rows].join('\n');
  }
}

/**
 * Tool execution tracker for individual tool runs
 */
export class ToolExecutionTracker {
  private data: Partial<ToolPerformanceData>;
  private progressUpdateCount = 0;

  constructor(
    private toolName: string,
    private executionId: string,
    private context: ToolExecutionContext,
    private metadata: Record<string, any>,
    private analyticsService: ToolAnalyticsService
  ) {
    this.data = {
      executionId,
      toolName,
      userId: context.userId,
      sessionId: context.sessionId,
      startTime: Date.now(),
      retryCount: 0,
      metadata: { ...metadata },
    };
  }

  /**
   * Record a progress update
   */
  recordProgress(update: ToolProgressUpdate): void {
    this.progressUpdateCount++;
    this.data.metadata = {
      ...this.data.metadata,
      lastProgress: update,
      progressCount: this.progressUpdateCount,
    };
  }

  /**
   * Record input size
   */
  recordInput(input: any): void {
    this.data.inputSize = this.calculateSize(input);
  }

  /**
   * Record retry attempt
   */
  recordRetry(): void {
    this.data.retryCount = (this.data.retryCount || 0) + 1;
  }

  /**
   * Complete tracking with success
   */
  complete(result: EnhancedToolResult): void {
    this.data.endTime = Date.now();
    this.data.executionTime = this.data.endTime - this.data.startTime!;
    this.data.success = result.success;
    this.data.outputSize = this.calculateSize(result.data);
    this.data.progressUpdates = this.progressUpdateCount;

    if (!result.success) {
      this.data.errorMessage = result.error;
      this.data.errorType = this.inferErrorType(result.error);
    }

    // Record performance data
    this.analyticsService.recordExecution(this.data as ToolPerformanceData);
  }

  /**
   * Complete tracking with error
   */
  error(error: Error): void {
    this.data.endTime = Date.now();
    this.data.executionTime = this.data.endTime - this.data.startTime!;
    this.data.success = false;
    this.data.errorMessage = error.message;
    this.data.errorType = error.name || 'Error';
    this.data.progressUpdates = this.progressUpdateCount;

    // Record performance data
    this.analyticsService.recordExecution(this.data as ToolPerformanceData);
  }

  private calculateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return obj.length;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 1;

    try {
      return JSON.stringify(obj).length;
    } catch {
      return 0;
    }
  }

  /**
   * Infer error type from error message for categorization
   */
  private inferErrorType(errorMessage?: string): string {
    // Validate input to prevent null pointer exceptions
    if (!errorMessage || typeof errorMessage !== 'string') return 'Unknown';

    const message = errorMessage.toLowerCase();

    // Comprehensive error categorization
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    )
      return 'Validation';
    if (
      message.includes('timeout') ||
      message.includes('deadline') ||
      message.includes('timed out')
    )
      return 'Timeout';
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('socket')
    )
      return 'Network';
    if (
      message.includes('permission') ||
      message.includes('auth') ||
      message.includes('forbidden') ||
      message.includes('unauthorized')
    )
      return 'Authorization';
    if (
      message.includes('parse') ||
      message.includes('json') ||
      message.includes('syntax') ||
      message.includes('malformed')
    )
      return 'Parsing';
    if (
      message.includes('memory') ||
      message.includes('limit') ||
      message.includes('overflow') ||
      message.includes('heap')
    )
      return 'Resource';
    if (
      message.includes('rate') ||
      message.includes('throttle') ||
      message.includes('quota')
    )
      return 'RateLimit';
    if (
      message.includes('conflict') ||
      message.includes('concurrent') ||
      message.includes('lock')
    )
      return 'Concurrency';
    if (
      message.includes('not found') ||
      message.includes('404') ||
      message.includes('missing')
    )
      return 'NotFound';
    if (
      message.includes('server') ||
      message.includes('500') ||
      message.includes('internal')
    )
      return 'ServerError';

    return 'Execution';
  }
}

// Export singleton instance
export const toolAnalyticsService = ToolAnalyticsService.getInstance();

// Validation schemas
export const analyticsConfigSchema = z.object({
  enableMetrics: z.boolean().default(true),
  enablePerformanceTracking: z.boolean().default(true),
  enableErrorAnalysis: z.boolean().default(true),
  enableUserAnalytics: z.boolean().default(true),
  retentionDays: z.number().min(1).max(365).default(30),
  samplingRate: z.number().min(0).max(1).default(1),
  alertThresholds: z.object({
    errorRate: z.number().min(0).max(1).default(0.1),
    avgExecutionTime: z.number().min(100).default(10_000),
    failureStreak: z.number().min(1).default(5),
  }),
});

export type AnalyticsConfigType = z.infer<typeof analyticsConfigSchema>;
