import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { AdvancedCodeValidator } from '../code-validator';
import {
  StreamingProgressManager,
  streamingProgressManager,
} from '../streaming-progress';
import { ToolAnalyticsService, toolAnalyticsService } from '../tool-analytics';
import { ToolChoiceEnforcer, toolChoiceEnforcer } from '../tool-choice';
import { enhancedArtifactTools } from '../tools/enhanced-tools';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Enhanced Tool System', () => {
  describe('AdvancedCodeValidator', () => {
    let validator: AdvancedCodeValidator;

    beforeEach(() => {
      validator = new AdvancedCodeValidator();
    });

    test('should validate JavaScript code successfully', async () => {
      const code = `
        const greeting = "Hello, World!"
        console.log(greeting)
      `;

      const result = await validator.validateCode(code, 'javascript');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect security vulnerabilities', async () => {
      const maliciousCode = `
        eval("alert('XSS')")
        document.innerHTML = userInput
      `;

      const result = await validator.validateCode(maliciousCode, 'javascript');

      expect(result.isValid).toBe(false);
      expect(result.securityIssues).toHaveLength(2);
      expect(result.securityIssues.some((issue) => issue.type === 'eval')).toBe(
        true
      );
      expect(result.securityIssues.some((issue) => issue.type === 'xss')).toBe(
        true
      );
    });

    test('should detect performance issues', async () => {
      const inefficientCode = `
        const items = ['a', 'b', 'c']
        if (items.indexOf('b') !== -1) {
          console.log('found')
        }
      `;

      const result = await validator.validateCode(
        inefficientCode,
        'javascript'
      );

      expect(result.performance).toHaveLength(1);
      expect(result.performance[0].type).toBe('inefficient');
      expect(result.performance[0].suggestion).toContain('includes()');
    });

    test('should suggest modernizations', async () => {
      const oldCode = `
        var name = "John"
        var greeting = "Hello " + name
      `;

      const result = await validator.validateCode(oldCode, 'javascript');

      expect(result.suggestions).toHaveLength(2);
      expect(
        result.suggestions.some(
          (s) => s.type === 'modern' && s.message.includes('const or let')
        )
      ).toBe(true);
      expect(
        result.suggestions.some(
          (s) => s.type === 'modern' && s.message.includes('template literals')
        )
      ).toBe(true);
    });

    test('should validate TypeScript specific features', async () => {
      const tsCode = `
        function greet(name: any): void {
          console.log("Hello " + name)
        }
      `;

      const result = await validator.validateCode(tsCode, 'typescript');

      expect(result.warnings.some((w) => w.message.includes('any'))).toBe(true);
    });

    test('should repair code automatically', async () => {
      const buggyCode = `
        var items = ['a', 'b', 'c']
        if (items.indexOf('b') !== -1) {
          console.log('found')
        }
      `;

      const validationResult = await validator.validateCode(
        buggyCode,
        'javascript'
      );
      const repairResult = await validator.repairCode(
        buggyCode,
        validationResult,
        { autoFix: true }
      );

      expect(repairResult.repairedCode).toContain('const items');
      expect(repairResult.repairedCode).toContain('.includes(');
      expect(repairResult.appliedFixes).toHaveLength(2);
    });
  });

  describe('ToolChoiceEnforcer', () => {
    let enforcer: ToolChoiceEnforcer;

    beforeEach(() => {
      enforcer = ToolChoiceEnforcer.getInstance();
    });

    test('should enforce required tool usage', () => {
      const toolChoice = enforcer.enforceToolUsage(
        { outputType: 'code', userIntent: 'create' },
        { mode: 'required' }
      );

      expect(toolChoice.type).toBe('required');
    });

    test('should recommend specific tool for code output', () => {
      const recommendation = enforcer.recommendTool({
        outputType: 'code',
        userIntent: 'create',
        complexity: 'moderate',
      });

      expect(recommendation.toolName).toBe('createCodeArtifact');
      expect(recommendation.confidence).toBeGreaterThan(0.8);
    });

    test('should recommend chart tool for visualization', () => {
      const recommendation = enforcer.recommendTool({
        outputType: 'chart',
        userIntent: 'create',
        complexity: 'simple',
      });

      expect(recommendation.toolName).toBe('createChartArtifact');
      expect(recommendation.confidence).toBeGreaterThan(0.8);
    });

    test('should update tool metrics after execution', () => {
      enforcer.updateToolMetrics('createCodeArtifact', true, 1500);
      const metrics = enforcer.getToolMetrics('createCodeArtifact');

      expect(metrics).toBeDefined();
      expect(typeof metrics.successRate).toBe('number');
      expect(typeof metrics.avgExecutionTime).toBe('number');
    });

    test('should handle tool unavailability gracefully', () => {
      expect(() => {
        enforcer.enforceToolUsage(
          { outputType: 'code' },
          {
            mode: 'tool',
            toolName: 'nonexistentTool',
            fallbackBehavior: 'retry',
          }
        );
      }).toThrow();
    });

    test('should select optimal tool based on content analysis', () => {
      const toolName = enforcer.selectToolForOutput(
        'code',
        'Create a React component'
      );
      expect(toolName).toBe('createCodeArtifact');
    });
  });

  describe('StreamingProgressManager', () => {
    let manager: StreamingProgressManager;
    let mockController: any;

    beforeEach(() => {
      manager = StreamingProgressManager.getInstance();
      mockController = {
        update: jest.fn(),
        complete: jest.fn(),
        error: jest.fn(),
        close: jest.fn(),
      };
    });

    afterEach(() => {
      // Clean up any active trackings
      manager.getActiveTrackings().forEach((id) => {
        manager.cancelTracking(id);
      });
    });

    test('should start progress tracking', () => {
      const executionId = 'test-execution-1';
      const tracker = manager.startTracking(executionId, 'testTool', [
        'initializing',
        'processing',
        'complete',
      ]);

      expect(tracker.executionId).toBe(executionId);
      expect(tracker.totalStages).toBe(3);
      expect(manager.isTracking(executionId)).toBe(true);
    });

    test('should update progress correctly', () => {
      const executionId = 'test-execution-2';
      manager.startTracking(
        executionId,
        'testTool',
        ['initializing', 'processing', 'complete'],
        mockController
      );

      manager.updateProgress(executionId, {
        stage: 'processing',
        progress: 50,
        message: 'Processing...',
      });

      expect(mockController.update).toHaveBeenCalled();
      const progress = manager.getProgress(executionId);
      expect(progress?.stage).toBe('processing');
      expect(progress?.progress).toBe(50);
    });

    test('should complete tracking successfully', () => {
      const executionId = 'test-execution-3';
      manager.startTracking(
        executionId,
        'testTool',
        ['initializing', 'complete'],
        mockController
      );

      manager.completeTracking(executionId, { result: 'success' });

      expect(mockController.complete).toHaveBeenCalledWith({
        result: 'success',
      });
      expect(manager.isTracking(executionId)).toBe(false);
    });

    test('should handle errors properly', () => {
      const executionId = 'test-execution-4';
      manager.startTracking(
        executionId,
        'testTool',
        ['initializing', 'complete'],
        mockController
      );

      const error = new Error('Test error');
      manager.errorTracking(executionId, error);

      expect(mockController.error).toHaveBeenCalledWith(error);
      expect(manager.isTracking(executionId)).toBe(false);
    });

    test('should cancel tracking', () => {
      const executionId = 'test-execution-5';
      manager.startTracking(
        executionId,
        'testTool',
        ['initializing', 'complete'],
        mockController
      );

      manager.cancelTracking(executionId);

      expect(mockController.close).toHaveBeenCalled();
      expect(manager.isTracking(executionId)).toBe(false);
    });

    test('should get progress history', () => {
      const executionId = 'test-execution-6';
      manager.startTracking(executionId, 'testTool');

      manager.updateProgress(executionId, {
        stage: 'processing',
        progress: 25,
        message: 'Step 1',
      });
      manager.updateProgress(executionId, {
        stage: 'processing',
        progress: 75,
        message: 'Step 2',
      });

      const history = manager.getProgressHistory(executionId);
      expect(history).toHaveLength(3); // Initial + 2 updates
      expect(history[1].message).toBe('Step 1');
      expect(history[2].message).toBe('Step 2');
    });
  });

  describe('ToolAnalyticsService', () => {
    let analytics: ToolAnalyticsService;

    beforeEach(() => {
      analytics = ToolAnalyticsService.getInstance();
    });

    test('should track tool execution', () => {
      const tracker = analytics.trackExecution('testTool', 'exec-1', {
        userId: 'user1',
      });

      expect(tracker).toBeDefined();
      expect(typeof tracker.complete).toBe('function');
      expect(typeof tracker.error).toBe('function');
    });

    test('should record execution data', () => {
      const executionData = {
        executionId: 'exec-1',
        toolName: 'testTool',
        userId: 'user1',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        executionTime: 1000,
        success: true,
        inputSize: 100,
        outputSize: 200,
        progressUpdates: 3,
        retryCount: 0,
        metadata: { test: true },
      };

      analytics.recordExecution(executionData);

      const metrics = analytics.getToolMetrics('testTool');
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.successRate).toBe(1);
    });

    test('should calculate metrics correctly', () => {
      // Record multiple executions
      const baseTime = Date.now();

      analytics.recordExecution({
        executionId: 'exec-1',
        toolName: 'testTool',
        startTime: baseTime - 2000,
        endTime: baseTime - 1000,
        executionTime: 1000,
        success: true,
        inputSize: 100,
        outputSize: 200,
        progressUpdates: 2,
        retryCount: 0,
        metadata: {},
      });

      analytics.recordExecution({
        executionId: 'exec-2',
        toolName: 'testTool',
        startTime: baseTime - 1000,
        endTime: baseTime,
        executionTime: 2000,
        success: false,
        errorType: 'ValidationError',
        errorMessage: 'Invalid input',
        inputSize: 150,
        outputSize: 0,
        progressUpdates: 1,
        retryCount: 1,
        metadata: {},
      });

      const metrics = analytics.getToolMetrics('testTool');
      expect(metrics.totalExecutions).toBe(2);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.successRate).toBe(0.5);
      expect(metrics.averageExecutionTime).toBe(1500);
      expect(metrics.errorTypes.ValidationError).toBe(1);
    });

    test('should generate performance trends', () => {
      const baseTime = Date.now();

      // Record executions over time
      for (let i = 0; i < 5; i++) {
        analytics.recordExecution({
          executionId: `exec-${i}`,
          toolName: 'testTool',
          startTime: baseTime - i * 60 * 60 * 1000, // Hour intervals
          endTime: baseTime - i * 60 * 60 * 1000 + 1000,
          executionTime: 1000 + i * 100,
          success: i % 2 === 0, // Alternate success/failure
          inputSize: 100,
          outputSize: 100,
          progressUpdates: 1,
          retryCount: 0,
          metadata: {},
        });
      }

      const trends = analytics.getPerformanceTrends('testTool', 'hour', 1);
      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty('executionCount');
      expect(trends[0]).toHaveProperty('successRate');
      expect(trends[0]).toHaveProperty('avgExecutionTime');
    });

    test('should get health overview', () => {
      // Record some test data
      analytics.recordExecution({
        executionId: 'health-test-1',
        toolName: 'tool1',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        executionTime: 1000,
        success: true,
        inputSize: 100,
        outputSize: 100,
        progressUpdates: 1,
        retryCount: 0,
        metadata: {},
      });

      const health = analytics.getHealthOverview();
      expect(health).toHaveProperty('totalExecutions');
      expect(health).toHaveProperty('overallSuccessRate');
      expect(health).toHaveProperty('avgResponseTime');
      expect(health).toHaveProperty('toolsCount');
      expect(Array.isArray(health.topErrors)).toBe(true);
    });

    test('should export data in JSON format', () => {
      analytics.recordExecution({
        executionId: 'export-test-1',
        toolName: 'exportTool',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        executionTime: 1000,
        success: true,
        inputSize: 100,
        outputSize: 100,
        progressUpdates: 1,
        retryCount: 0,
        metadata: {},
      });

      const exportedData = analytics.exportData('exportTool', 'json');
      expect(() => JSON.parse(exportedData)).not.toThrow();

      const parsed = JSON.parse(exportedData);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].toolName).toBe('exportTool');
    });
  });

  describe('Enhanced Artifact Tools Integration', () => {
    test('should create code artifact with validation', async () => {
      const tool = enhancedArtifactTools.createCodeArtifact;

      expect(tool).toBeDefined();
      expect(tool.description).toContain('validation');
      expect(tool.parameters).toBeDefined();
    });

    test('should create chart artifact with optimization', async () => {
      const tool = enhancedArtifactTools.createChartArtifact;

      expect(tool).toBeDefined();
      expect(tool.description).toContain('validation');
      expect(tool.parameters).toBeDefined();
    });

    test('should execute workflow with dependency management', async () => {
      const tool = enhancedArtifactTools.executeWorkflow;

      expect(tool).toBeDefined();
      expect(tool.description).toContain('dependency');
      expect(tool.parameters).toBeDefined();
    });

    test('should enforce structured output', async () => {
      const tool = enhancedArtifactTools.generateStructuredOutput;

      expect(tool).toBeDefined();
      expect(tool.description).toContain('Force tool usage');
      expect(tool.parameters).toBeDefined();
    });
  });

  describe('Edge Case Tests', () => {
    describe('ToolAnalyticsService Edge Cases', () => {
      let analytics: ToolAnalyticsService;

      beforeEach(() => {
        analytics = ToolAnalyticsService.getInstance();
      });

      test('should handle data size limits and cleanup', () => {
        // Simulate adding data beyond the limit
        const maxSize = 10_000;
        const testSize = maxSize + 1000;

        // Add data up to and beyond the limit
        for (let i = 0; i < testSize; i++) {
          analytics.recordExecution({
            executionId: `test-${i}`,
            toolName: 'testTool',
            startTime: Date.now() - i * 1000,
            endTime: Date.now() - i * 1000 + 500,
            executionTime: 500,
            success: true,
            inputSize: 100,
            outputSize: 100,
            progressUpdates: 1,
            retryCount: 0,
            metadata: {},
          });
        }

        // Verify data was trimmed
        const metrics = analytics.getToolMetrics('testTool');
        expect(metrics.totalExecutions).toBeLessThanOrEqual(maxSize);
      });

      test('should handle concurrent metric updates', () => {
        const toolName = 'concurrentTool';
        const promises = [];

        // Simulate concurrent executions
        for (let i = 0; i < 10; i++) {
          promises.push(
            new Promise<void>((resolve) => {
              const tracker = analytics.trackExecution(
                toolName,
                `concurrent-${i}`
              );
              setTimeout(() => {
                tracker.complete({
                  success: true,
                  data: { result: i },
                  executionTime: 100,
                  metadata: {},
                });
                resolve();
              }, Math.random() * 100);
            })
          );
        }

        return Promise.all(promises).then(() => {
          const metrics = analytics.getToolMetrics(toolName);
          expect(metrics.totalExecutions).toBe(10);
          expect(metrics.successfulExecutions).toBe(10);
        });
      });

      test('should handle invalid execution data gracefully', () => {
        expect(() => {
          analytics.recordExecution(null as any);
        }).toThrow('Invalid execution data');

        expect(() => {
          analytics.recordExecution({} as any);
        }).not.toThrow(); // Should handle empty object with defaults
      });

      test('should handle cleanup routine correctly', (done) => {
        // Add old data that should be cleaned up
        const oldTime = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago

        analytics.recordExecution({
          executionId: 'old-execution',
          toolName: 'oldTool',
          startTime: oldTime,
          endTime: oldTime + 1000,
          executionTime: 1000,
          success: true,
          inputSize: 100,
          outputSize: 100,
          progressUpdates: 1,
          retryCount: 0,
          metadata: {},
        });

        // Wait for periodic cleanup (mocked to run immediately in tests)
        setTimeout(() => {
          const metrics = analytics.getToolMetrics('oldTool');
          expect(metrics.totalExecutions).toBe(0); // Old data should be cleaned
          done();
        }, 100);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should integrate progress tracking with tool execution', async () => {
      const executionId = 'integration-test-1';
      const progressUpdates: any[] = [];

      const mockController = {
        update: (update: any) => progressUpdates.push(update),
        complete: jest.fn(),
        error: jest.fn(),
        close: jest.fn(),
      };

      // Start progress tracking
      streamingProgressManager.startTracking(
        executionId,
        'createCodeArtifact',
        ['initializing', 'validating', 'generating', 'complete'],
        mockController
      );

      // Simulate progress updates
      streamingProgressManager.updateProgress(executionId, {
        stage: 'validating',
        progress: 25,
        message: 'Validating code input...',
      });

      streamingProgressManager.updateProgress(executionId, {
        stage: 'generating',
        progress: 75,
        message: 'Creating artifact...',
      });

      streamingProgressManager.completeTracking(executionId, { success: true });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.some((u) => u.stage === 'validating')).toBe(true);
      expect(progressUpdates.some((u) => u.stage === 'generating')).toBe(true);
      expect(mockController.complete).toHaveBeenCalled();
    });

    test('should integrate analytics with tool choice enforcement', () => {
      // Test tool recommendation affects analytics
      const recommendation = toolChoiceEnforcer.recommendTool({
        outputType: 'code',
        userIntent: 'create',
      });

      expect(recommendation.toolName).toBe('createCodeArtifact');

      // Update metrics should affect future recommendations
      toolChoiceEnforcer.updateToolMetrics('createCodeArtifact', true, 800);

      const metrics = toolChoiceEnforcer.getToolMetrics('createCodeArtifact');
      expect(typeof metrics.successRate).toBe('number');
    });

    test('should handle error scenarios end-to-end', () => {
      const executionId = 'error-test-1';
      const tracker = toolAnalyticsService.trackExecution(
        'testTool',
        executionId
      );

      // Start progress tracking
      streamingProgressManager.startTracking(executionId, 'testTool');

      // Simulate error
      const error = new Error('Test execution error');
      streamingProgressManager.errorTracking(executionId, error);
      tracker.error(error);

      // Verify error was recorded
      const metrics = toolAnalyticsService.getToolMetrics('testTool');
      expect(metrics.failedExecutions).toBeGreaterThan(0);
      expect(metrics.successRate).toBeLessThan(1);
    });
  });
});
