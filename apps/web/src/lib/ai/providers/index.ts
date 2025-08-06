// Provider functionality exports
export {
  gatewayRegistry,
  registerGateway,
  getRegisteredGateways,
  clearGatewayRegistry,
  type GatewayConfig,
  type GatewayRegistry,
} from './gateway-registry';

// Re-export specific items to avoid conflicts
export { executeWithGateway, getGatewayModel } from './gateway-registry';

export * from './gateway';
export * from './provider-discovery';
export * from './provider-metrics';
export * from './provider-optimizations';
export * from './providers-gateway';