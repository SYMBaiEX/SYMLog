// Gateway core components

export type {
  FallbackChainConfig,
  FallbackExecutionResult,
  FallbackOption,
  FallbackStrategy,
} from '../../routing/fallback-chain';
export * from '../../routing/fallback-chain';
// Re-export types for convenience
export type {
  GatewayConfig,
  ModelInfo,
  ModelRequirements,
  ModelSelection,
  ProviderHealth,
  ProviderInfo,
} from '../../core/gateway';
export * from '../../core/gateway';
export type {
  AggregatedResponse,
  ErrorInterceptor,
  MiddlewareConfig,
  RequestContext,
  RequestInterceptor,
  ResponseInterceptor,
} from '../../core/gateway-middleware';
export * from '../../core/gateway-middleware';
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
} from '../../routing/intelligent-routing';
export * from '../../routing/intelligent-routing';

export type {
  LoadBalancerConfig,
  LoadBalancingStrategy,
  ProviderSelection,
} from '../../routing/load-balancing';
export * from '../../routing/load-balancing';
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
