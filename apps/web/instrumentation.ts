// instrumentation.ts - OpenTelemetry setup (MUST be loaded first)
// This file follows August 2025 best practices for OpenTelemetry Node.js

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_NAMESPACE,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// Environment configuration
const environment = process.env.NODE_ENV || 'development';
const serviceName = process.env.OTEL_SERVICE_NAME || 'symlog-ai-app';
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';
const serviceNamespace = process.env.OTEL_SERVICE_NAMESPACE || 'symlog';
const isProduction = environment === 'production';
const isDevelopment = environment === 'development';

// Enable diagnostic logging in development
if (isDevelopment || process.env.OTEL_LOG_LEVEL) {
  const logLevel =
    (process.env.OTEL_LOG_LEVEL as keyof typeof DiagLogLevel) || 'INFO';
  diag.setLogger(
    new DiagConsoleLogger(),
    DiagLogLevel[logLevel] || DiagLogLevel.INFO
  );
}

// Create resource with service information
const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: serviceName,
  [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  [SEMRESATTRS_SERVICE_NAMESPACE]: serviceNamespace,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  // Additional custom attributes
  'service.instance.id':
    process.env.HOSTNAME || process.env.INSTANCE_ID || 'local',
  'ai.framework': 'vercel-ai-sdk',
  'ai.version': '5.0',
});

// Configure trace exporters
const traceExporters = [];

// Add console exporter for development
if (isDevelopment || process.env.OTEL_TRACES_CONSOLE) {
  traceExporters.push(new ConsoleSpanExporter());
}

// Add OTLP exporter if endpoint is configured
if (
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT
) {
  const otlpConfig: any = {
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    headers: {},
  };

  // Add authentication headers if configured
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    const headers = process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',');
    for (const header of headers) {
      const [key, value] = header.split('=');
      if (key && value) {
        otlpConfig.headers[key.trim()] = value.trim();
      }
    }
  }

  traceExporters.push(new OTLPTraceExporter(otlpConfig));
}

// Configure automatic instrumentations with AI-specific optimizations
const instrumentations = getNodeAutoInstrumentations({
  // Enable specific instrumentations for AI workloads
  '@opentelemetry/instrumentation-http': {
    // Track AI API calls with detailed metadata
    requestHook: (span, request) => {
      // Mark AI-related requests
      if (
        'headers' in request &&
        request.headers &&
        typeof request.headers === 'object'
      ) {
        const headers = request.headers as Record<string, any>;
        if (headers['content-type']?.includes('application/json')) {
          span.setAttribute('http.request.is_ai_call', true);
        }

        // Add correlation IDs for distributed tracing
        if (headers['x-correlation-id']) {
          span.setAttribute('correlation.id', headers['x-correlation-id']);
        }
      }
    },
    responseHook: (span, response) => {
      // Track AI provider responses
      if (
        'headers' in response &&
        response.headers &&
        typeof response.headers === 'object'
      ) {
        const headers = response.headers as Record<string, any>;
        if (headers['x-ratelimit-remaining']) {
          span.setAttribute(
            'ai.rate_limit.remaining',
            headers['x-ratelimit-remaining']
          );
        }
      }
    },
    // Ignore health checks and static assets
    ignoreIncomingRequestHook: (req) => {
      const url = req.url || '';
      return (
        url.includes('/health') ||
        url.includes('/favicon') ||
        url.includes('/_next/static') ||
        url.includes('/api/health')
      );
    },
  },

  '@opentelemetry/instrumentation-express': {
    // Enhanced Express instrumentation for API routes
    requestHook: (span, info) => {
      // Add route-specific attributes
      if (info.request.route?.path) {
        span.setAttribute('http.route', info.request.route.path);
      }

      // Track AI-specific endpoints
      const path = info.request.path || '';
      if (path.startsWith('/api/ai/')) {
        span.setAttribute('ai.endpoint', true);
        span.setAttribute('ai.operation', path.replace('/api/ai/', ''));
      }
    },
  },

  '@opentelemetry/instrumentation-fs': {
    // Enable file system instrumentation for artifact operations
    enabled: true,
  },

  // Disable noisy instrumentations in development
  '@opentelemetry/instrumentation-net': {
    enabled: isProduction,
  },

  '@opentelemetry/instrumentation-dns': {
    enabled: isProduction,
  },
});

// Initialize the OpenTelemetry SDK
const sdk = new NodeSDK({
  resource,
  traceExporter: traceExporters.length === 1 ? traceExporters[0] : undefined,
  instrumentations,
  // Configure sampling for performance
  // In production, use parent-based sampling with ratio
  // In development, sample everything for debugging
  spanProcessors:
    traceExporters.length > 1
      ? traceExporters.map(
          (exporter) =>
            new (require('@opentelemetry/sdk-trace-base').SimpleSpanProcessor)(
              exporter
            )
        )
      : undefined,
});

// Initialize the SDK - this must happen before any other imports
try {
  sdk.start();

  if (isDevelopment) {
    console.log('🔍 OpenTelemetry initialized successfully');
    console.log(`📊 Service: ${serviceName} v${serviceVersion}`);
    console.log(`🌍 Environment: ${environment}`);
    console.log(`📤 Exporters: ${traceExporters.length} configured`);
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
}

// Graceful shutdown handling
const shutdown = () => {
  sdk
    .shutdown()
    .then(() => {
      if (isDevelopment) {
        console.log('🔍 OpenTelemetry terminated successfully');
      }
    })
    .catch((error) => {
      console.error('❌ Error terminating OpenTelemetry:', error);
    })
    .finally(() => process.exit(0));
};

// Handle process termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGQUIT', shutdown);

// Handle uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});

export default sdk;
