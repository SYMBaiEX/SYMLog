// Gateway core components

export type {
  FallbackChainConfig,
  FallbackExecutionResult,
  FallbackOption,
  FallbackStrategy,
} from '../fallback-chain';
export * from '../fallback-chain';
// Re-export types for convenience
export type {
  GatewayConfig,
  ModelInfo,
  ModelRequirements,
  ModelSelection,
  ProviderHealth,
  ProviderInfo,
} from '../gateway';
export * from '../gateway';
export type {
  AggregatedResponse,
  ErrorInterceptor,
  MiddlewareConfig,
  RequestContext,
  RequestInterceptor,
  ResponseInterceptor,
} from '../gateway-middleware';
export * from '../gateway-middleware';
export * from '../gateway-registry';

// Main gateway interface
export {
  executeWithGateway,
  gatewayRegistry,
  getGatewayModel,
  getGatewayModelById,
} from '../gateway-registry';
export type {
  CapabilityRequirements,
  ComplexityAnalysis,
  RoutingDecision,
} from '../intelligent-routing';
export * from '../intelligent-routing';

export type {
  LoadBalancerConfig,
  LoadBalancingStrategy,
  ProviderSelection,
} from '../load-balancing';
export * from '../load-balancing';
export type {
  CostTracking,
  MetricWindow,
  ModelMetrics,
  ProviderMetrics,
  RateLimitStatus,
  TokenUsage,
} from '../provider-metrics';
// Supporting services
export * from '../provider-metrics';
