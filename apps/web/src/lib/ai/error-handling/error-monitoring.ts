import {
  type EnhancedErrorInfo,
  type ErrorCategory,
  ErrorSeverity,
  getAdvancedErrorHandler,
} from './advanced-error-handling';
import { ErrorPattern, getErrorClassifier } from './error-classification';
// import { createLogger } from '../logger/unified-logger'; // TODO: Fix logger import

// Create AI error monitoring logger - temporary fix
const logger = {
  info: (...args: any[]) => console.log('[ai-error-monitoring]', ...args),
  warn: (...args: any[]) => console.warn('[ai-error-monitoring]', ...args),
  error: (...args: any[]) => console.error('[ai-error-monitoring]', ...args),
  debug: (...args: any[]) => console.debug('[ai-error-monitoring]', ...args),
};

// Alert types
export enum AlertType {
  ERROR_RATE = 'error-rate',
  ERROR_SPIKE = 'error-spike',
  CRITICAL_ERROR = 'critical-error',
  PATTERN_DETECTED = 'pattern-detected',
  SERVICE_DEGRADATION = 'service-degradation',
  QUOTA_WARNING = 'quota-warning',
}

// Alert configuration
export interface AlertConfig {
  type: AlertType;
  threshold: number;
  window: number; // Time window in ms
  cooldown: number; // Cooldown period in ms
  enabled: boolean;
  channels: AlertChannel[];
}

// Alert channel types
export interface AlertChannel {
  type: 'console' | 'webhook' | 'email' | 'slack' | 'custom';
  config: Record<string, any>;
}

// Alert event
export interface AlertEvent {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
}

// Monitoring metrics
export interface MonitoringMetrics {
  errorRate: number;
  errorCount: number;
  successRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByPattern: Record<ErrorPattern, number>;
  recentErrors: EnhancedErrorInfo[];
  activeAlerts: AlertEvent[];
}

// Default alert configurations
const DEFAULT_ALERTS: AlertConfig[] = [
  {
    type: AlertType.ERROR_RATE,
    threshold: 0.1, // 10% error rate
    window: 300_000, // 5 minutes
    cooldown: 600_000, // 10 minutes
    enabled: true,
    channels: [{ type: 'console', config: {} }],
  },
  {
    type: AlertType.ERROR_SPIKE,
    threshold: 5, // 5x normal rate
    window: 60_000, // 1 minute
    cooldown: 300_000, // 5 minutes
    enabled: true,
    channels: [{ type: 'console', config: {} }],
  },
  {
    type: AlertType.CRITICAL_ERROR,
    threshold: 1, // Any critical error
    window: 0, // Immediate
    cooldown: 60_000, // 1 minute
    enabled: true,
    channels: [{ type: 'console', config: {} }],
  },
  {
    type: AlertType.SERVICE_DEGRADATION,
    threshold: 0.5, // 50% success rate
    window: 600_000, // 10 minutes
    cooldown: 1_800_000, // 30 minutes
    enabled: true,
    channels: [{ type: 'console', config: {} }],
  },
  {
    type: AlertType.QUOTA_WARNING,
    threshold: 0.8, // 80% of quota
    window: 3_600_000, // 1 hour
    cooldown: 3_600_000, // 1 hour
    enabled: true,
    channels: [{ type: 'console', config: {} }],
  },
];

/**
 * Error Monitoring and Alerting System
 */
export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private errorHandler = getAdvancedErrorHandler();
  private errorClassifier = getErrorClassifier();
  private alerts: Map<AlertType, AlertConfig> = new Map();
  private alertHistory: AlertEvent[] = [];
  private lastAlertTime: Map<AlertType, number> = new Map();
  private metrics: Map<string, number[]> = new Map();
  private operationMetrics: Map<
    string,
    { success: number; failure: number; totalTime: number }
  > = new Map();

  private constructor() {
    this.initializeAlerts();
    this.startMetricsCollection();
  }

  static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService();
    }
    return ErrorMonitoringService.instance;
  }

  /**
   * Monitor an AI operation
   */
  async monitorOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();
      this.recordSuccess(operationName, startTime, metadata);
      return result;
    } catch (error) {
      await this.recordError(operationName, error, startTime, metadata);
      throw error;
    }
  }

  /**
   * Record an error occurrence
   */
  async recordError(
    operationName: string,
    error: unknown,
    startTime: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const errorInfo = this.errorHandler.handleError(error);
    const classification = this.errorClassifier.classifyError(error);
    const duration = Date.now() - startTime;

    // Update operation metrics
    const opMetrics = this.operationMetrics.get(operationName) || {
      success: 0,
      failure: 0,
      totalTime: 0,
    };
    opMetrics.failure++;
    opMetrics.totalTime += duration;
    this.operationMetrics.set(operationName, opMetrics);

    // Track error
    this.trackMetric('error_count', 1);
    this.trackMetric(`error_${errorInfo.category}`, 1);
    this.trackMetric(`pattern_${classification.pattern}`, 1);

    // Check alerts
    await this.checkAlerts(errorInfo, classification, operationName, metadata);

    logger.debug('Error recorded', {
      operation: operationName,
      category: errorInfo.category,
      pattern: classification.pattern,
      duration,
    });
  }

  /**
   * Record a successful operation
   */
  recordSuccess(
    operationName: string,
    startTime: number,
    metadata?: Record<string, any>
  ): void {
    const duration = Date.now() - startTime;

    // Update operation metrics
    const opMetrics = this.operationMetrics.get(operationName) || {
      success: 0,
      failure: 0,
      totalTime: 0,
    };
    opMetrics.success++;
    opMetrics.totalTime += duration;
    this.operationMetrics.set(operationName, opMetrics);

    // Track success
    this.trackMetric('success_count', 1);
    this.trackMetric('response_time', duration);
  }

  /**
   * Get current monitoring metrics
   */
  getMetrics(): MonitoringMetrics {
    const stats = this.errorHandler.getErrorStatistics();
    const classificationStats = this.errorClassifier.getErrorStatistics();

    // Calculate rates
    const totalOps =
      this.getMetricSum('success_count') + this.getMetricSum('error_count');
    const errorRate =
      totalOps > 0 ? this.getMetricSum('error_count') / totalOps : 0;
    const successRate =
      totalOps > 0 ? this.getMetricSum('success_count') / totalOps : 0;

    // Calculate response times
    const responseTimes = this.metrics.get('response_time') || [];
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
    const p95ResponseTime = this.calculatePercentile(responseTimes, 0.95);

    return {
      errorRate,
      errorCount: this.getMetricSum('error_count'),
      successRate,
      avgResponseTime,
      p95ResponseTime,
      errorsByCategory: stats.byCategory,
      errorsByPattern: classificationStats.byPattern,
      recentErrors: stats.recentErrors.slice(0, 10),
      activeAlerts: this.alertHistory.filter((a) => !a.acknowledged),
    };
  }

  /**
   * Get operation-specific metrics
   */
  getOperationMetrics(operationName: string): {
    successRate: number;
    errorRate: number;
    avgResponseTime: number;
    totalCalls: number;
  } {
    const metrics = this.operationMetrics.get(operationName);

    if (!metrics) {
      return {
        successRate: 0,
        errorRate: 0,
        avgResponseTime: 0,
        totalCalls: 0,
      };
    }

    const total = metrics.success + metrics.failure;
    const successRate = total > 0 ? metrics.success / total : 0;
    const errorRate = total > 0 ? metrics.failure / total : 0;
    const avgResponseTime = total > 0 ? metrics.totalTime / total : 0;

    return {
      successRate,
      errorRate,
      avgResponseTime,
      totalCalls: total,
    };
  }

  /**
   * Configure alerts
   */
  configureAlert(config: AlertConfig): void {
    this.alerts.set(config.type, config);
    logger.info('Alert configured', { type: config.type });
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', { alertId });
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): AlertEvent[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear metrics and reset monitoring
   */
  reset(): void {
    this.metrics.clear();
    this.operationMetrics.clear();
    this.alertHistory = [];
    this.lastAlertTime.clear();
    logger.info('Monitoring system reset');
  }

  // Private helper methods

  private initializeAlerts(): void {
    DEFAULT_ALERTS.forEach((alert) => {
      this.alerts.set(alert.type, alert);
    });
  }

  private startMetricsCollection(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3_600_000);
  }

  private trackMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only recent values (last hour)
    const cutoff = Date.now() - 3_600_000;
    const recentValues = values.filter((_, index) => {
      // Estimate timestamp based on position
      const estimatedTime = Date.now() - (values.length - index) * 1000;
      return estimatedTime > cutoff;
    });

    this.metrics.set(name, recentValues);
  }

  private getMetricSum(name: string): number {
    const values = this.metrics.get(name) || [];
    return values.reduce((a, b) => a + b, 0);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private async checkAlerts(
    errorInfo: EnhancedErrorInfo,
    classification: any,
    operationName: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Check critical error alert
    if (errorInfo.severity === ErrorSeverity.CRITICAL) {
      await this.triggerAlert(AlertType.CRITICAL_ERROR, {
        error: errorInfo,
        operation: operationName,
        metadata,
      });
    }

    // Check error rate
    const metrics = this.getMetrics();
    const errorRateConfig = this.alerts.get(AlertType.ERROR_RATE);
    if (
      errorRateConfig?.enabled &&
      metrics.errorRate > errorRateConfig.threshold
    ) {
      await this.triggerAlert(AlertType.ERROR_RATE, {
        errorRate: metrics.errorRate,
        threshold: errorRateConfig.threshold,
      });
    }

    // Check for pattern detection
    if (
      classification.pattern === ErrorPattern.RATE_LIMIT ||
      classification.pattern === ErrorPattern.QUOTA_EXCEEDED
    ) {
      await this.triggerAlert(AlertType.PATTERN_DETECTED, {
        pattern: classification.pattern,
        suggestions: classification.metadata,
      });
    }

    // Check service degradation
    const serviceConfig = this.alerts.get(AlertType.SERVICE_DEGRADATION);
    if (
      serviceConfig?.enabled &&
      metrics.successRate < serviceConfig.threshold
    ) {
      await this.triggerAlert(AlertType.SERVICE_DEGRADATION, {
        successRate: metrics.successRate,
        threshold: serviceConfig.threshold,
      });
    }
  }

  private async triggerAlert(
    type: AlertType,
    data: Record<string, any>
  ): Promise<void> {
    const config = this.alerts.get(type);
    if (!config?.enabled) return;

    // Check cooldown
    const lastAlert = this.lastAlertTime.get(type) || 0;
    if (Date.now() - lastAlert < config.cooldown) return;

    // Create alert event
    const alert: AlertEvent = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.getAlertSeverity(type),
      title: this.getAlertTitle(type),
      message: this.getAlertMessage(type, data),
      metadata: data,
      timestamp: new Date(),
      acknowledged: false,
    };

    // Record alert
    this.alertHistory.push(alert);
    this.lastAlertTime.set(type, Date.now());

    // Send to channels
    for (const channel of config.channels) {
      await this.sendAlert(alert, channel);
    }
  }

  private async sendAlert(
    alert: AlertEvent,
    channel: AlertChannel
  ): Promise<void> {
    switch (channel.type) {
      case 'console': {
        const alertData = {
          title: alert.title,
          message: alert.message,
          type: alert.type,
          metadata: alert.metadata,
        };
        
        if (alert.severity === 'critical') {
          logger.error(`[ALERT] ${alert.title}`, alertData);
        } else if (alert.severity === 'high') {
          logger.warn(`[ALERT] ${alert.title}`, alertData);
        } else {
          logger.info(`[ALERT] ${alert.title}`, alertData);
        }
        break;
      }

      case 'webhook':
        // Implement webhook sending
        break;

      case 'email':
        // Implement email sending
        break;

      case 'slack':
        // Implement Slack notification
        break;

      case 'custom':
        if (channel.config.handler) {
          await channel.config.handler(alert);
        }
        break;
    }
  }

  private getAlertSeverity(
    type: AlertType
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case AlertType.CRITICAL_ERROR:
        return 'critical';
      case AlertType.SERVICE_DEGRADATION:
      case AlertType.ERROR_SPIKE:
        return 'high';
      case AlertType.ERROR_RATE:
      case AlertType.QUOTA_WARNING:
        return 'medium';
      default:
        return 'low';
    }
  }

  private getAlertTitle(type: AlertType): string {
    switch (type) {
      case AlertType.ERROR_RATE:
        return 'High Error Rate Detected';
      case AlertType.ERROR_SPIKE:
        return 'Error Spike Detected';
      case AlertType.CRITICAL_ERROR:
        return 'Critical Error Occurred';
      case AlertType.PATTERN_DETECTED:
        return 'Error Pattern Detected';
      case AlertType.SERVICE_DEGRADATION:
        return 'Service Degradation Detected';
      case AlertType.QUOTA_WARNING:
        return 'Quota Warning';
      default:
        return 'Alert';
    }
  }

  private getAlertMessage(type: AlertType, data: Record<string, any>): string {
    switch (type) {
      case AlertType.ERROR_RATE:
        return `Error rate (${(data.errorRate * 100).toFixed(1)}%) exceeded threshold (${(data.threshold * 100).toFixed(1)}%)`;
      case AlertType.ERROR_SPIKE:
        return `Error rate increased by ${data.multiplier}x normal levels`;
      case AlertType.CRITICAL_ERROR:
        return `Critical error in operation "${data.operation}": ${data.error.message}`;
      case AlertType.PATTERN_DETECTED:
        return `Detected ${data.pattern} pattern. ${data.suggestions?.join('. ')}`;
      case AlertType.SERVICE_DEGRADATION:
        return `Success rate (${(data.successRate * 100).toFixed(1)}%) below threshold (${(data.threshold * 100).toFixed(1)}%)`;
      case AlertType.QUOTA_WARNING:
        return `API quota usage at ${(data.usage * 100).toFixed(1)}% of limit`;
      default:
        return JSON.stringify(data);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 3_600_000; // 1 hour

    // Clean up operation metrics older than 1 hour
    for (const [operation, metrics] of this.operationMetrics.entries()) {
      // Reset metrics that haven't been updated recently
      // This is a simplified approach - in production you'd track timestamps
      if (metrics.success + metrics.failure === 0) {
        this.operationMetrics.delete(operation);
      }
    }

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(
      (alert) => alert.timestamp.getTime() > cutoff
    );

    logger.debug('Cleaned up old metrics');
  }
}

// Export singleton getter
export const getErrorMonitoringService = (): ErrorMonitoringService => {
  return ErrorMonitoringService.getInstance();
};

// Convenience functions
export async function monitorAIOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const monitor = getErrorMonitoringService();
  return monitor.monitorOperation(operationName, operation, metadata);
}

export function getAIMetrics(): MonitoringMetrics {
  const monitor = getErrorMonitoringService();
  return monitor.getMetrics();
}

export function configureAIAlert(config: AlertConfig): void {
  const monitor = getErrorMonitoringService();
  monitor.configureAlert(config);
}
