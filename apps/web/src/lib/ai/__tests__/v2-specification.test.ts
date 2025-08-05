import { describe, test, expect, beforeEach, jest } from 'bun:test'
import { getAIModel, getModelWithMetadata, collectResponseMetadata, registry } from '../providers'
import { v2ErrorHandler, errorRecoveryService } from '../v2-error-handling'
import { 
  APICallError,
  InvalidArgumentError,
  NoObjectGeneratedError,
  NoSuchModelError 
} from 'ai'

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  logError: jest.fn()
}))

jest.mock('@/lib/config', () => ({
  config: {
    get: jest.fn().mockReturnValue({
      rateLimitMaxRequests: 100,
      aiMaxTokensPerRequest: 4096
    })
  }
}))

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((model: string) => ({
    modelId: model,
    provider: 'openai'
  }))
}))

jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn((model: string) => ({
    modelId: model,
    provider: 'anthropic'
  }))
}))

// Ensure mocks are set up before imports
beforeAll(() => {
  jest.clearAllMocks()
})

describe('V2 Specification Compliance', () => {
  describe('Provider Registry', () => {
    test('should create provider registry without experimental imports', () => {
      expect(registry).toBeDefined()
      expect(typeof registry.languageModel).toBe('function')
    })

    test('should support model aliases', () => {
      const fastModel = getAIModel('fast')
      expect(fastModel).toBeDefined()
      
      const balancedModel = getAIModel('balanced')
      expect(balancedModel).toBeDefined()
      
      const premiumModel = getAIModel('premium')
      expect(premiumModel).toBeDefined()
    })

    test('should support direct model IDs for backward compatibility', () => {
      const gptModel = getAIModel('gpt-4.1-nano')
      expect(gptModel).toBeDefined()
      
      const claudeModel = getAIModel('claude-3-5-sonnet-20241022')
      expect(claudeModel).toBeDefined()
    })

    test('should fall back to default model on invalid ID', () => {
      const invalidModel = getAIModel('non-existent-model')
      expect(invalidModel).toBeDefined()
      
      // Should fall back to premium model
      const defaultModel = getAIModel()
      expect(defaultModel).toBeDefined()
    })

    test('should get model with metadata', () => {
      const metadata = {
        userId: 'test-user',
        sessionId: 'test-session',
        requestId: 'test-request'
      }
      
      const { model, metadata: returnedMetadata } = getModelWithMetadata('fast', metadata)
      expect(model).toBeDefined()
      expect(returnedMetadata).toEqual(metadata)
    })
  })

  describe('Response Metadata Collection', () => {
    test('should collect response metadata correctly', () => {
      const mockResponse = {
        id: 'resp-123',
        modelId: 'gpt-4o-mini',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        },
        finishReason: 'stop',
        latency: 1500,
        cached: false,
        provider: 'openai'
      }

      const metadata = collectResponseMetadata(mockResponse)
      
      expect(metadata.id).toBe('resp-123')
      expect(metadata.modelId).toBe('gpt-4o-mini')
      expect(metadata.usage).toEqual(mockResponse.usage)
      expect(metadata.finishReason).toBe('stop')
      expect(metadata.custom).toBeDefined()
      expect(metadata.custom.timestamp).toBeDefined()
      expect(metadata.custom.latency).toBe(1500)
      expect(metadata.custom.cached).toBe(false)
      expect(metadata.custom.provider).toBe('openai')
    })

    test('should generate ID if not provided', () => {
      const mockResponse = {
        modelId: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop'
      }

      const metadata = collectResponseMetadata(mockResponse)
      expect(metadata.id).toBeDefined()
      expect(typeof metadata.id).toBe('string')
    })
  })

  describe('V2 Error Handling', () => {
    let errorHandler: typeof v2ErrorHandler

    beforeEach(() => {
      errorHandler = v2ErrorHandler
    })

    test('should handle APICallError correctly', () => {
      const error = new APICallError({
        message: 'API call failed',
        url: 'https://api.openai.com/v1/chat/completions',
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: {},
        responseBody: 'Rate limit exceeded',
        cause: undefined,
        isRetryable: true,
        data: undefined
      })

      const handled = errorHandler.handleError(error)
      
      expect(handled.code).toBe('RATE_LIMIT')
      expect(handled.retry).toBe(true)
      expect(handled.userMessage).toContain('too many requests')
    })

    test('should handle InvalidArgumentError', () => {
      const error = new InvalidArgumentError({
        parameter: 'model',
        value: 'invalid-model',
        message: 'Invalid model specified'
      })

      const handled = errorHandler.handleError(error)
      
      expect(handled.code).toBe('INVALID_ARGUMENT')
      expect(handled.retry).toBe(false)
      expect(handled.userMessage).toContain('check your input')
    })

    test('should handle NoObjectGeneratedError', () => {
      const error = new NoObjectGeneratedError({
        message: 'Could not generate object',
        text: 'Invalid JSON response',
        response: {}
      })

      const handled = errorHandler.handleError(error)
      
      expect(handled.code).toBe('NO_OBJECT_GENERATED')
      expect(handled.retry).toBe(true)
      expect(handled.fallback).toContain('simpler schema')
    })

    test('should handle NoSuchModelError', () => {
      const error = new NoSuchModelError({
        modelId: 'non-existent-model',
        modelType: 'languageModel',
        message: 'Model not found'
      })

      const handled = errorHandler.handleError(error)
      
      expect(handled.code).toBe('NO_SUCH_MODEL')
      expect(handled.retry).toBe(false)
      expect(handled.fallback).toContain('default model')
    })

    test('should categorize errors by status code', () => {
      const testCases = [
        { statusCode: 401, expectedCode: 'AUTH_ERROR' },
        { statusCode: 403, expectedCode: 'AUTH_ERROR' },
        { statusCode: 429, expectedCode: 'RATE_LIMIT' },
        { statusCode: 500, expectedCode: 'SERVER_ERROR' },
        { statusCode: 503, expectedCode: 'MODEL_OVERLOADED' }
      ]

      testCases.forEach(({ statusCode, expectedCode }) => {
        const error = new APICallError({
          message: `Error ${statusCode}`,
          url: 'https://api.openai.com/v1/chat/completions',
          requestBodyValues: {},
          statusCode,
          responseHeaders: {},
          responseBody: '',
          cause: undefined,
          isRetryable: statusCode >= 500,
          data: undefined
        })

        const handled = errorHandler.handleError(error)
        expect(handled.code).toBe(expectedCode)
      })
    })

    test('should provide user-friendly messages', () => {
      const error = new Error('Complex technical error with jargon')
      const handled = errorHandler.handleError(error)
      
      expect(handled.userMessage).toBeDefined()
      expect(handled.userMessage).not.toContain('jargon')
      expect(handled.userMessage).toContain('unexpected error')
    })
  })

  describe('Error Recovery Service', () => {
    test('should execute with retry on failure', async () => {
      let attempts = 0
      const action = jest.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const result = await errorRecoveryService.executeWithRecovery(action, {
        maxRetries: 3,
        retryDelay: 10
      })

      expect(result).toBe('success')
      expect(attempts).toBe(3)
      expect(action).toHaveBeenCalledTimes(3)
    })

    test('should use fallback strategies', async () => {
      const failingAction = jest.fn(async () => {
        throw new Error('Primary action failed')
      })

      const fallback1 = jest.fn(async () => {
        throw new Error('Fallback 1 failed')
      })

      const fallback2 = jest.fn(async () => {
        return 'fallback success'
      })

      const result = await errorRecoveryService.executeWithRecovery(failingAction, {
        maxRetries: 1,
        retryDelay: 10,
        fallbacks: [fallback1, fallback2]
      })

      expect(result).toBe('fallback success')
      expect(failingAction).toHaveBeenCalledTimes(1)
      expect(fallback1).toHaveBeenCalledTimes(1)
      expect(fallback2).toHaveBeenCalledTimes(1)
    })

    test('should call onError callback', async () => {
      const onError = jest.fn()
      const action = jest.fn(async () => {
        throw new APICallError({
          message: 'API failed',
          url: 'https://api.test.com',
          requestBodyValues: {},
          statusCode: 500,
          responseHeaders: {},
          responseBody: '',
          cause: undefined,
          isRetryable: true,
          data: undefined
        })
      })

      try {
        await errorRecoveryService.executeWithRecovery(action, {
          maxRetries: 2,
          retryDelay: 10,
          onError
        })
      } catch (e) {
        // Expected to fail
      }

      expect(onError).toHaveBeenCalledTimes(2)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SERVER_ERROR',
          retry: true
        }),
        expect.any(Number)
      )
    })

    test('should throw final error when all attempts fail', async () => {
      const action = jest.fn(async () => {
        throw new Error('Persistent failure')
      })

      await expect(
        errorRecoveryService.executeWithRecovery(action, {
          maxRetries: 2,
          retryDelay: 10
        })
      ).rejects.toThrow('unexpected error')
    })
  })

  describe('Middleware V2 Compliance', () => {
    test('middleware should not include middleware_version field', () => {
      // Import middleware to check structure
      const { loggingMiddleware, performanceMiddleware, securityMiddleware } = require('../middleware')
      
      // Check that middleware objects don't have middleware_version
      expect(loggingMiddleware).toBeDefined()
      expect(loggingMiddleware.middleware_version).toBeUndefined()
      
      expect(performanceMiddleware).toBeDefined()
      expect(performanceMiddleware.middleware_version).toBeUndefined()
      
      expect(securityMiddleware).toBeDefined()
      expect(securityMiddleware.middleware_version).toBeUndefined()
    })

    test('middleware should have proper V2 structure', () => {
      const { loggingMiddleware } = require('../middleware')
      
      // Check for V2 middleware methods
      expect(typeof loggingMiddleware.transformParams).toBe('function')
      expect(typeof loggingMiddleware.wrapGenerate).toBe('function')
      expect(typeof loggingMiddleware.wrapStream).toBe('function')
    })
  })

  describe('Integration Tests', () => {
    test('should integrate error handling with model selection', () => {
      // Test fallback to default model on error
      const model = getAIModel('non-existent-model')
      expect(model).toBeDefined()
      
      // Should have logged a warning
      const { loggingService } = require('@/lib/logger')
      expect(loggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
        expect.any(Object)
      )
    })

    test('should handle metadata throughout request lifecycle', () => {
      const requestMetadata = {
        userId: 'test-user',
        sessionId: 'test-session',
        requestId: 'test-123',
        source: 'test'
      }

      const { model, metadata } = getModelWithMetadata('fast', requestMetadata)
      expect(model).toBeDefined()
      expect(metadata).toEqual(requestMetadata)

      // Simulate response
      const mockResponse = {
        id: 'resp-456',
        modelId: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop'
      }

      const responseMetadata = collectResponseMetadata(mockResponse)
      expect(responseMetadata).toBeDefined()
      expect(responseMetadata.id).toBe('resp-456')
      expect(responseMetadata.custom.timestamp).toBeDefined()
    })
  })
})