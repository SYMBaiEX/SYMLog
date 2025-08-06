import { logError as logErrorToConsole } from '@/lib/logger';
import {
  LoadBalancer,
  type LoadBalancingStrategy,
  type ProviderSelection,
} from './load-balancing';
import {
  type ProviderMetrics,
  ProviderMetricsService,
} from '../providers/provider-metrics';
import {
  type OptimizationConfig,
  type OptimizationResult,
  ProviderOptimizationEngine,
  type RequestContext,
} from '../providers/provider-optimizations';

// Logger wrapper
const loggingService = {
  info: (message: string, data?: unknown) =>
    console.log(`[INFO] ${message}`, data),
  warn: (message: string, data?: unknown) =>
    console.warn(`[WARN] ${message}`, data),
  error: (message: string, data?: unknown) => logErrorToConsole(message, data),
  debug: (message: string, data?: unknown) =>
    console.debug(`[DEBUG] ${message}`, data),
};

// Route configuration
export interface RouteConfig {
  routeId: string;
  pattern: RegExp | string;
  providers: string[];
  defaultStrategy: LoadBalancingStrategy;
  optimizationOverrides?: Partial<OptimizationConfig>;
  fallbackRoutes?: string[];
  timeout?: number;
  retryAttempts?: number;
  circuitBreakerThreshold?: number;
}

// Routing context extends request context with routing-specific data
export interface RoutingContext extends RequestContext {
  routeId?: string;
  originalRequest?: Record<string, unknown>;
  retryCount?: number;
  previousProviders?: string[];
  circuitBreakerState?: CircuitBreakerState;
}

// Circuit breaker state
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

// Routing decision result
export interface RoutingDecision {
  selectedProvider: string;
  selectedModel: string;
  route: RouteConfig;
  optimizationResult: OptimizationResult;
  fallbackChain: string[];
  decision: {
    strategy:
      | 'optimization'
      | 'load-balancing'
      | 'circuit-breaker'
      | 'fallback';
    reason: string;
    confidence: number;
    metadata: Record<string, unknown>;
  };
}

// Route performance metrics
export interface RouteMetrics {
  routeId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  lastOptimizationTime: number;
  providerDistribution: Record<string, number>;
  errorsByProvider: Record<string, number>;
}

/**
 * Adaptive Routing System
 * Provides intelligent routing with circuit breakers, fallbacks, and optimization
 */
export class AdaptiveRoutingSystem {
  private static instance: AdaptiveRoutingSystem;
  private optimizationEngine: ProviderOptimizationEngine;
  private loadBalancer: LoadBalancer;
  private metricsService: ProviderMetricsService;

  private routes: Map<string, RouteConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private routeMetrics: Map<string, RouteMetrics> = new Map();
  private defaultProviders: string[] = ['openai', 'anthropic', 'google'];

  // Performance tracking
  private requestHistory: Array<{
    routeId: string;
    providerId: string;
    success: boolean;
    latency: number;
    timestamp: number;
    context: RoutingContext;
  }> = [];

  private constructor() {
    this.optimizationEngine = ProviderOptimizationEngine.getInstance();
    this.loadBalancer = new LoadBalancer('adaptive');
    this.metricsService = ProviderMetricsService.getInstance();

    this.initializeDefaultRoutes();
    this.startMaintenanceLoop();

    loggingService.info('Adaptive Routing System initialized');
  }

  static getInstance(): AdaptiveRoutingSystem {
    if (!AdaptiveRoutingSystem.instance) {
      AdaptiveRoutingSystem.instance = new AdaptiveRoutingSystem();
    }
    return AdaptiveRoutingSystem.instance;
  }

  /**
   * Register a new route configuration
   */
  registerRoute(config: RouteConfig): void {
    this.routes.set(config.routeId, config);
    this.initializeRouteMetrics(config.routeId);
    loggingService.info('Route registered', { routeId: config.routeId });
  }

  /**
   * Main routing decision method
   */
  async route(
    request: Record<string, unknown>,
    context: RoutingContext
  ): Promise<RoutingDecision> {
    const startTime = Date.now();

    try {
      // Identify route
      const route = this.identifyRoute(request, context);
      context.routeId = route.routeId;

      // Check circuit breaker
      const circuitBreakerResult = this.checkCircuitBreaker(
        route.routeId,
        route.providers
      );
      if (circuitBreakerResult.state === 'open') {
        return this.handleCircuitBreakerOpen(
          route,
          context,
          circuitBreakerResult
        );
      }

      // Filter available providers
      const availableProviders = this.filterAvailableProviders(
        circuitBreakerResult.availableProviders,
        context
      );

      if (availableProviders.length === 0) {
        return this.handleNoProvidersAvailable(route, context);
      }

      // Apply optimization-based routing
      const optimizationResult = await this.applyOptimizedRouting(
        availableProviders,
        context,
        route
      );

      // Build fallback chain
      const fallbackChain = this.buildFallbackChain(
        availableProviders,
        optimizationResult.selectedProvider,
        route
      );

      const decision: RoutingDecision = {
        selectedProvider: optimizationResult.selectedProvider,
        selectedModel: optimizationResult.selectedModel,
        route,
        optimizationResult,
        fallbackChain,
        decision: {
          strategy: 'optimization',
          reason: optimizationResult.reason,
          confidence: optimizationResult.confidence,
          metadata: {
            routingTime: Date.now() - startTime,
            circuitBreakerState: circuitBreakerResult.state,
            availableProviders: availableProviders.length,
            optimization: optimizationResult.optimizations,
          },
        },
      };

      // Record routing decision
      this.recordRoutingDecision(decision, context);

      return decision;
    } catch (error) {
      loggingService.error('Routing decision failed', error);
      return this.handleRoutingFailure(error, context);
    }
  }

  /**
   * Record the outcome of a routing decision
   */
  recordOutcome(
    decision: RoutingDecision,
    outcome: {
      success: boolean;
      latency: number;
      error?: Error;
      responseMetadata?: any;
    }
  ): void {
    const context: RoutingContext = {
      routeId: decision.route.routeId,
      requestType: 'chat', // Default
      priority: 'medium',
      userTier: 'pro',
    };

    // Update circuit breaker
    this.updateCircuitBreaker(
      decision.selectedProvider,
      outcome.success,
      outcome.error
    );

    // Update route metrics
    this.updateRouteMetrics(decision.route.routeId, {
      providerId: decision.selectedProvider,
      success: outcome.success,
      latency: outcome.latency,
    });

    // Record for optimization engine learning
    this.optimizationEngine.recordActualPerformance(
      decision.selectedProvider,
      context,
      {
        latency: outcome.latency,
        cost: 0.005, // Estimated
        success: outcome.success,
        errorType: outcome.error?.name,
      }
    );

    // Update request history
    this.requestHistory.push({
      routeId: decision.route.routeId,
      providerId: decision.selectedProvider,
      success: outcome.success,
      latency: outcome.latency,
      timestamp: Date.now(),
      context,
    });

    // Limit history size
    if (this.requestHistory.length > 10_000) {
      this.requestHistory = this.requestHistory.slice(-5000);
    }

    loggingService.debug('Routing outcome recorded', {
      routeId: decision.route.routeId,
      provider: decision.selectedProvider,
      success: outcome.success,
      latency: outcome.latency,
    });
  }

  /**
   * Get routing analytics and insights
   */
  getRoutingAnalytics(): {
    totalRoutes: number;
    totalRequests: number;
    averageLatency: number;
    successRate: number;
    topPerformingRoutes: Array<{ routeId: string; metrics: RouteMetrics }>;
    circuitBreakerStatus: Array<{
      providerId: string;
      state: CircuitBreakerState;
    }>;
    providerDistribution: Record<string, number>;
  } {
    const totalRequests = this.requestHistory.length;
    const successfulRequests = this.requestHistory.filter(
      (r) => r.success
    ).length;
    const totalLatency = this.requestHistory.reduce(
      (sum, r) => sum + r.latency,
      0
    );

    const providerDistribution = this.requestHistory.reduce(
      (acc, r) => {
        acc[r.providerId] = (acc[r.providerId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topRoutes = Array.from(this.routeMetrics.values())
      .sort((a, b) => b.successfulRequests - a.successfulRequests)
      .slice(0, 5)
      .map((metrics) => ({ routeId: metrics.routeId, metrics }));

    const circuitBreakerStatus = Array.from(this.circuitBreakers.entries()).map(
      ([providerId, state]) => ({ providerId, state })
    );

    return {
      totalRoutes: this.routes.size,
      totalRequests,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      topPerformingRoutes: topRoutes,
      circuitBreakerStatus,
      providerDistribution,
    };
  }

  /**
   * Update route configuration
   */
  updateRoute(routeId: string, updates: Partial<RouteConfig>): void {
    const existing = this.routes.get(routeId);
    if (!existing) {
      throw new Error(`Route ${routeId} not found`);
    }

    const updated = { ...existing, ...updates };
    this.routes.set(routeId, updated);
    loggingService.info('Route updated', { routeId, updates });
  }

  /**
   * Get route performance metrics
   */
  getRouteMetrics(routeId: string): RouteMetrics | undefined {
    return this.routeMetrics.get(routeId);
  }

  /**
   * Force circuit breaker state change
   */
  setCircuitBreakerState(
    providerId: string,
    state: CircuitBreakerState['state']
  ): void {
    const current = this.circuitBreakers.get(providerId) || {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };

    current.state = state;
    if (state === 'closed') {
      current.failureCount = 0;
    }

    this.circuitBreakers.set(providerId, current);
    loggingService.info('Circuit breaker state changed', { providerId, state });
  }

  // Private methods

  private identifyRoute(request: any, context: RoutingContext): RouteConfig {
    // Try to match request to configured routes
    for (const [routeId, route] of this.routes) {
      if (this.matchesRoute(request, route, context)) {
        return route;
      }
    }

    // Return default route
    return this.getDefaultRoute(context);
  }

  private matchesRoute(
    request: any,
    route: RouteConfig,
    context: RoutingContext
  ): boolean {
    if (typeof route.pattern === 'string') {
      return (
        request?.type === route.pattern || context.requestType === route.pattern
      );
    }

    if (route.pattern instanceof RegExp) {
      const requestString = JSON.stringify(request) + JSON.stringify(context);
      return route.pattern.test(requestString);
    }

    return false;
  }

  private getDefaultRoute(context: RoutingContext): RouteConfig {
    const routeId = `default-${context.requestType || 'general'}`;

    if (!this.routes.has(routeId)) {
      const defaultRoute: RouteConfig = {
        routeId,
        pattern: context.requestType || 'general',
        providers: this.defaultProviders,
        defaultStrategy: 'adaptive',
        timeout: 30_000,
        retryAttempts: 2,
        circuitBreakerThreshold: 5,
      };
      this.registerRoute(defaultRoute);
    }

    return this.routes.get(routeId)!;
  }

  private checkCircuitBreaker(
    routeId: string,
    providers: string[]
  ): { state: CircuitBreakerState['state']; availableProviders: string[] } {
    const availableProviders: string[] = [];
    let overallState: CircuitBreakerState['state'] = 'closed';

    for (const providerId of providers) {
      const breaker = this.circuitBreakers.get(providerId);

      if (!breaker) {
        // No circuit breaker data, assume healthy
        availableProviders.push(providerId);
        continue;
      }

      const now = Date.now();

      switch (breaker.state) {
        case 'closed':
          availableProviders.push(providerId);
          break;

        case 'open':
          if (now >= breaker.nextAttemptTime) {
            // Transition to half-open
            breaker.state = 'half-open';
            availableProviders.push(providerId);
            this.circuitBreakers.set(providerId, breaker);
          } else {
            overallState = 'open';
          }
          break;

        case 'half-open':
          availableProviders.push(providerId);
          break;
      }
    }

    return { state: overallState, availableProviders };
  }

  private filterAvailableProviders(
    providers: string[],
    context: RoutingContext
  ): string[] {
    return providers.filter((providerId) => {
      // Skip providers that have failed recently for this context
      if (context.previousProviders?.includes(providerId)) {
        return false;
      }

      // Check if provider meets context requirements
      // This could be enhanced with capability checking
      return true;
    });
  }

  private async applyOptimizedRouting(
    providers: string[],
    context: RoutingContext,
    route: RouteConfig
  ): Promise<OptimizationResult> {
    try {
      // Apply route-specific optimization overrides
      if (route.optimizationOverrides) {
        this.optimizationEngine.updateConfig(route.optimizationOverrides);
      }

      const result = await this.optimizationEngine.optimizeProviderSelection(
        providers,
        context
      );

      return result;
    } catch (error) {
      loggingService.warn(
        'Optimization failed, falling back to load balancing',
        error
      );

      // Fallback to load balancing
      const selection = await this.loadBalancer.selectProvider(
        providers,
        context
      );

      return {
        selectedProvider: selection.providerId,
        selectedModel: this.getDefaultModelForProvider(selection.providerId),
        reason: `Load balancing fallback: ${selection.reason}`,
        confidence: 0.6,
        expectedLatency: 2000,
        expectedCost: 0.01,
        fallbackProviders: providers.filter((p) => p !== selection.providerId),
        optimizations: [
          {
            type: 'load-balancing-fallback',
            description: 'Applied load balancing due to optimization failure',
            impact: 'medium',
          },
        ],
      };
    }
  }

  private buildFallbackChain(
    availableProviders: string[],
    selectedProvider: string,
    route: RouteConfig
  ): string[] {
    const chain = availableProviders.filter((p) => p !== selectedProvider);

    // Add fallback routes if configured
    if (route.fallbackRoutes) {
      for (const fallbackRouteId of route.fallbackRoutes) {
        const fallbackRoute = this.routes.get(fallbackRouteId);
        if (fallbackRoute) {
          chain.push(
            ...fallbackRoute.providers.filter((p) => !chain.includes(p))
          );
        }
      }
    }

    return chain;
  }

  private handleCircuitBreakerOpen(
    route: RouteConfig,
    context: RoutingContext,
    circuitBreakerState: any
  ): RoutingDecision {
    loggingService.warn('All providers circuit breaker open', {
      routeId: route.routeId,
      providers: route.providers,
    });

    // Use emergency fallback
    const emergencyProvider = 'openai'; // Default emergency provider

    return {
      selectedProvider: emergencyProvider,
      selectedModel: this.getDefaultModelForProvider(emergencyProvider),
      route,
      optimizationResult: {
        selectedProvider: emergencyProvider,
        selectedModel: this.getDefaultModelForProvider(emergencyProvider),
        reason: 'Circuit breaker emergency fallback',
        confidence: 0.3,
        expectedLatency: 5000,
        expectedCost: 0.02,
        fallbackProviders: [],
        optimizations: [
          {
            type: 'circuit-breaker-fallback',
            description: 'Emergency fallback due to circuit breaker',
            impact: 'high',
          },
        ],
      },
      fallbackChain: [],
      decision: {
        strategy: 'circuit-breaker',
        reason: 'All providers unavailable due to circuit breaker',
        confidence: 0.3,
        metadata: circuitBreakerState,
      },
    };
  }

  private handleNoProvidersAvailable(
    route: RouteConfig,
    context: RoutingContext
  ): RoutingDecision {
    loggingService.error('No providers available for routing', {
      routeId: route.routeId,
      context,
    });

    throw new Error(`No providers available for route ${route.routeId}`);
  }

  private handleRoutingFailure(
    error: any,
    context: RoutingContext
  ): RoutingDecision {
    const emergencyProvider = 'openai';
    const emergencyRoute: RouteConfig = {
      routeId: 'emergency',
      pattern: 'emergency',
      providers: [emergencyProvider],
      defaultStrategy: 'round-robin',
    };

    return {
      selectedProvider: emergencyProvider,
      selectedModel: this.getDefaultModelForProvider(emergencyProvider),
      route: emergencyRoute,
      optimizationResult: {
        selectedProvider: emergencyProvider,
        selectedModel: this.getDefaultModelForProvider(emergencyProvider),
        reason: 'Emergency routing due to system failure',
        confidence: 0.2,
        expectedLatency: 10_000,
        expectedCost: 0.05,
        fallbackProviders: [],
        optimizations: [
          {
            type: 'emergency-routing',
            description: 'Emergency routing activated',
            impact: 'high',
          },
        ],
      },
      fallbackChain: [],
      decision: {
        strategy: 'fallback',
        reason: `Routing failure: ${error.message}`,
        confidence: 0.2,
        metadata: { error: error.message },
      },
    };
  }

  private recordRoutingDecision(
    decision: RoutingDecision,
    context: RoutingContext
  ): void {
    // Update route metrics
    const metrics = this.routeMetrics.get(decision.route.routeId);
    if (metrics) {
      metrics.totalRequests++;
      metrics.providerDistribution[decision.selectedProvider] =
        (metrics.providerDistribution[decision.selectedProvider] || 0) + 1;
    }
  }

  private updateCircuitBreaker(
    providerId: string,
    success: boolean,
    error?: Error
  ): void {
    const breaker = this.circuitBreakers.get(providerId) || {
      state: 'closed' as const,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };

    const now = Date.now();

    if (success) {
      if (breaker.state === 'half-open') {
        // Success in half-open state, close the circuit
        breaker.state = 'closed';
        breaker.failureCount = 0;
      } else if (breaker.state === 'closed') {
        // Reset failure count on success
        breaker.failureCount = Math.max(0, breaker.failureCount - 1);
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = now;

      const threshold = 5; // Configurable threshold

      if (breaker.state === 'closed' && breaker.failureCount >= threshold) {
        // Open the circuit
        breaker.state = 'open';
        breaker.nextAttemptTime = now + 60_000; // 1 minute timeout
      } else if (breaker.state === 'half-open') {
        // Failure in half-open state, open the circuit again
        breaker.state = 'open';
        breaker.nextAttemptTime = now + 120_000; // 2 minute timeout
      }
    }

    this.circuitBreakers.set(providerId, breaker);
  }

  private updateRouteMetrics(
    routeId: string,
    outcome: { providerId: string; success: boolean; latency: number }
  ): void {
    const metrics = this.routeMetrics.get(routeId);
    if (!metrics) return;

    if (outcome.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      metrics.errorsByProvider[outcome.providerId] =
        (metrics.errorsByProvider[outcome.providerId] || 0) + 1;
    }

    // Update latency metrics
    const totalLatency =
      metrics.averageLatency * (metrics.totalRequests - 1) + outcome.latency;
    metrics.averageLatency = totalLatency / metrics.totalRequests;

    // Update P95 (simplified)
    if (outcome.latency > metrics.p95Latency) {
      metrics.p95Latency = outcome.latency;
    }
  }

  private getDefaultModelForProvider(providerId: string): string {
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022',
      google: 'gemini-pro',
    };

    return defaultModels[providerId] || 'gpt-4o-mini';
  }

  private initializeDefaultRoutes(): void {
    const defaultRoutes: RouteConfig[] = [
      {
        routeId: 'chat',
        pattern: 'chat',
        providers: ['openai', 'anthropic', 'google'],
        defaultStrategy: 'adaptive',
        timeout: 30_000,
        retryAttempts: 2,
        circuitBreakerThreshold: 5,
      },
      {
        routeId: 'completion',
        pattern: 'completion',
        providers: ['openai', 'anthropic'],
        defaultStrategy: 'least-latency',
        timeout: 20_000,
        retryAttempts: 1,
        circuitBreakerThreshold: 3,
      },
      {
        routeId: 'embedding',
        pattern: 'embedding',
        providers: ['openai', 'google'],
        defaultStrategy: 'cost-optimized',
        timeout: 15_000,
        retryAttempts: 2,
        circuitBreakerThreshold: 5,
      },
    ];

    for (const route of defaultRoutes) {
      this.registerRoute(route);
    }
  }

  private initializeRouteMetrics(routeId: string): void {
    this.routeMetrics.set(routeId, {
      routeId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      lastOptimizationTime: Date.now(),
      providerDistribution: {},
      errorsByProvider: {},
    });
  }

  private startMaintenanceLoop(): void {
    // Cleanup and maintenance every 5 minutes
    setInterval(
      () => {
        this.performMaintenance();
      },
      5 * 60 * 1000
    );
  }

  private performMaintenance(): void {
    // Cleanup old request history
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.requestHistory = this.requestHistory.filter(
      (r) => r.timestamp > cutoff
    );

    // Reset circuit breakers that have been open too long
    for (const [providerId, breaker] of this.circuitBreakers) {
      if (
        breaker.state === 'open' &&
        Date.now() > breaker.nextAttemptTime + 300_000
      ) {
        // 5 minutes
        breaker.state = 'closed';
        breaker.failureCount = 0;
        this.circuitBreakers.set(providerId, breaker);
      }
    }

    loggingService.debug('Maintenance completed', {
      historySize: this.requestHistory.length,
      circuitBreakers: this.circuitBreakers.size,
    });
  }
}

// Export convenience functions
export const createAdaptiveRouter = (): AdaptiveRoutingSystem => {
  return AdaptiveRoutingSystem.getInstance();
};

export const routeRequest = async (
  request: any,
  context: RoutingContext
): Promise<RoutingDecision> => {
  const router = AdaptiveRoutingSystem.getInstance();
  return router.route(request, context);
};

// Export singleton
export const adaptiveRouter = AdaptiveRoutingSystem.getInstance();
