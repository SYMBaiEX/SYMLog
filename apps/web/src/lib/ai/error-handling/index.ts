// Error handling functionality exports
// Primary exports from advanced-error-handling
export * from './advanced-error-handling';
export * from './error-classification';
export * from './error-handler';
export * from './error-monitoring';
export * from './error-recovery';
export * from './resilient-ai';
export * from './retry-strategies';

// Secondary exports with specific naming to avoid conflicts
export {
  type ErrorCategory as BasicErrorCategory,
  type ErrorSeverity as BasicErrorSeverity,
} from './error-handling';