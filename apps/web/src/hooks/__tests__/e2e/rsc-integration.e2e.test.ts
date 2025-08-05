import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { vi } from 'vitest';

// Mock RSC server responses
const mockRSCResponses = {
  streamingChat: {
    success: {
      status: 200,
      contentType: 'text/html',
      body: `
        <div data-testid="streaming-message">
          <div data-testid="message-content">Hello! How can I help you today?</div>
        </div>
      `,
    },
    prepareStepAnalysis: {
      stepNumber: 0,
      complexity: { score: 4, taskType: 'general' },
      configuration: 'balanced',
    },
  },
  artifactGeneration: {
    success: {
      status: 200,
      contentType: 'text/html',
      body: `
        <div data-testid="artifact-viewer">
          <div data-testid="artifact-type">code</div>
          <div data-testid="artifact-content">
            function hello() { return "Hello World"; }
          </div>
        </div>
      `,
    },
  },
  workflowExecution: {
    success: {
      status: 200,
      contentType: 'text/html',
      body: `
        <div data-testid="workflow-status">
          <div data-testid="workflow-progress">100</div>
          <div data-testid="workflow-step" data-step="0" data-status="completed">Step 1 Complete</div>
          <div data-testid="workflow-step" data-step="1" data-status="completed">Step 2 Complete</div>
        </div>
      `,
    },
  },
};

test.describe('RSC Integration E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Mock RSC server action endpoints
    await page.route('/api/rsc/streaming-chat', async (route) => {
      const request = route.request();
      const postData = request.postData();

      if (postData?.includes('enableIntelligentStepping')) {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prepareStepAnalysis:
              mockRSCResponses.streamingChat.prepareStepAnalysis,
            response: mockRSCResponses.streamingChat.success.body,
          }),
        });
      } else {
        await route.fulfill(mockRSCResponses.streamingChat.success);
      }
    });

    await page.route('/api/rsc/artifact-generation', async (route) => {
      await route.fulfill(mockRSCResponses.artifactGeneration.success);
    });

    await page.route('/api/rsc/workflow-execution', async (route) => {
      await route.fulfill(mockRSCResponses.workflowExecution.success);
    });

    // Navigate to RSC test page
    await page.goto('/rsc-test');
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('PrepareStep Integration', () => {
    test('should use intelligent stepping for complex queries', async () => {
      // Enable intelligent stepping
      await page.check('[data-testid="enable-intelligent-stepping"]');

      // Submit a complex query
      const complexQuery =
        'Create a comprehensive React component with TypeScript, error boundaries, and accessibility features';
      await page.fill('[data-testid="rsc-input"]', complexQuery);
      await page.click('[data-testid="submit-rsc-request"]');

      // Wait for response with prepareStep analysis
      await page.waitForSelector('[data-testid="prepare-step-analysis"]', {
        timeout: 10_000,
      });

      // Verify prepareStep was applied
      const analysis = await page.textContent(
        '[data-testid="prepare-step-analysis"]'
      );
      expect(analysis).toContain('stepNumber: 0');
      expect(analysis).toContain('complexity');
      expect(analysis).toContain('taskType');

      // Verify response reflects intelligent configuration
      const response = await page.textContent(
        '[data-testid="streaming-message"]'
      );
      expect(response).toBeTruthy();
    });

    test('should adapt configuration based on step complexity', async () => {
      await page.check('[data-testid="enable-intelligent-stepping"]');

      const testCases = [
        {
          query: 'What is 2+2?',
          expectedTaskType: 'simple',
          expectedComplexity: { min: 0, max: 3 },
        },
        {
          query: 'Write a machine learning algorithm to classify images',
          expectedTaskType: 'technical',
          expectedComplexity: { min: 5, max: 10 },
        },
        {
          query: 'Create a magical story about dragons in a fantasy world',
          expectedTaskType: 'creative',
          expectedComplexity: { min: 3, max: 8 },
        },
      ];

      for (const testCase of testCases) {
        await page.fill('[data-testid="rsc-input"]', testCase.query);
        await page.click('[data-testid="submit-rsc-request"]');

        await page.waitForSelector('[data-testid="prepare-step-analysis"]');

        const analysisText = await page.textContent(
          '[data-testid="prepare-step-analysis"]'
        );
        expect(analysisText).toContain(
          `taskType: ${testCase.expectedTaskType}`
        );

        // Extract complexity score from analysis
        const complexityMatch = analysisText?.match(/score: (\d+)/);
        if (complexityMatch) {
          const score = Number.parseInt(complexityMatch[1]);
          expect(score).toBeGreaterThanOrEqual(testCase.expectedComplexity.min);
          expect(score).toBeLessThanOrEqual(testCase.expectedComplexity.max);
        }
      }
    });

    test('should handle multi-step conversations with context compression', async () => {
      await page.check('[data-testid="enable-intelligent-stepping"]');
      await page.check('[data-testid="enable-message-compression"]');

      // Send multiple messages to build conversation history
      const messages = [
        'Tell me about React hooks',
        'Explain useState in detail',
        'Show me useEffect examples',
        'What about custom hooks?',
        'How do I test custom hooks?',
      ];

      for (const [index, message] of messages.entries()) {
        await page.fill('[data-testid="rsc-input"]', message);
        await page.click('[data-testid="submit-rsc-request"]');

        // Wait for response
        await page.waitForSelector(`[data-testid="message-${index}"]`);

        if (index >= 2) {
          // Check if message compression was applied
          const compressionIndicator = await page.locator(
            '[data-testid="compression-applied"]'
          );
          if ((await compressionIndicator.count()) > 0) {
            const compressionText = await compressionIndicator.textContent();
            expect(compressionText).toContain('compressed');
          }
        }
      }

      // Verify conversation state is maintained
      const conversationLength = await page
        .locator('[data-testid^="message-"]')
        .count();
      expect(conversationLength).toBe(messages.length * 2); // User + assistant messages
    });

    test('should optimize tool selection based on query type', async () => {
      await page.check('[data-testid="enable-intelligent-stepping"]');

      // Test technical query - should activate code-related tools
      await page.fill(
        '[data-testid="rsc-input"]',
        'Generate a TypeScript interface for user data'
      );
      await page.click('[data-testid="submit-rsc-request"]');

      await page.waitForSelector('[data-testid="active-tools"]');
      const technicalTools = await page.textContent(
        '[data-testid="active-tools"]'
      );
      expect(technicalTools).toContain('codeTool');
      expect(technicalTools).toContain('generateTool');

      // Test simple query - should limit tool usage
      await page.fill('[data-testid="rsc-input"]', 'What time is it?');
      await page.click('[data-testid="submit-rsc-request"]');

      await page.waitForSelector('[data-testid="active-tools"]');
      const simpleTools = await page.textContent(
        '[data-testid="active-tools"]'
      );
      const toolCount = (simpleTools?.match(/Tool:/g) || []).length;
      expect(toolCount).toBeLessThanOrEqual(2);
    });
  });

  test.describe('Advanced Streaming Patterns', () => {
    test('should handle streaming errors with recovery', async () => {
      // Mock intermittent failure
      let requestCount = 0;
      await page.route('/api/rsc/streaming-chat', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          await route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Temporary server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            body: mockRSCResponses.streamingChat.success.body,
          });
        }
      });

      await page.fill('[data-testid="rsc-input"]', 'Test error recovery');
      await page.click('[data-testid="submit-rsc-request"]');

      // Should show error initially
      await page.waitForSelector('[data-testid="error-message"]', {
        timeout: 5000,
      });

      // Should automatically retry and succeed
      await page.waitForSelector('[data-testid="streaming-message"]', {
        timeout: 10_000,
      });

      const successMessage = await page.textContent(
        '[data-testid="streaming-message"]'
      );
      expect(successMessage).toContain('Hello! How can I help you today?');
    });

    test('should handle concurrent stream operations', async () => {
      // Enable concurrent streaming
      await page.check('[data-testid="enable-concurrent-streams"]');

      // Start multiple streams simultaneously
      const queries = [
        'Generate a React component',
        'Create a TypeScript interface',
        'Write a CSS animation',
      ];

      // Submit all queries rapidly
      for (const [index, query] of queries.entries()) {
        await page.fill(`[data-testid="concurrent-input-${index}"]`, query);
        await page.click(`[data-testid="submit-concurrent-${index}"]`);
      }

      // Wait for all streams to complete
      await Promise.all(
        queries.map((_, index) =>
          page.waitForSelector(`[data-testid="concurrent-result-${index}"]`, {
            timeout: 15_000,
          })
        )
      );

      // Verify all results are present
      for (let i = 0; i < queries.length; i++) {
        const result = await page.textContent(
          `[data-testid="concurrent-result-${i}"]`
        );
        expect(result).toBeTruthy();
      }

      // Check that streams were managed properly
      const streamMetrics = await page.textContent(
        '[data-testid="stream-metrics"]'
      );
      expect(streamMetrics).toContain('Concurrent streams: 3');
      expect(streamMetrics).toContain('All completed');
    });

    test('should compress large streaming data', async () => {
      await page.check('[data-testid="enable-stream-compression"]');

      // Request a large dataset
      await page.fill(
        '[data-testid="rsc-input"]',
        'Generate a large data structure with 1000 items'
      );
      await page.click('[data-testid="submit-rsc-request"]');

      // Wait for compression indicator
      await page.waitForSelector('[data-testid="compression-active"]');

      // Verify compression ratio
      const compressionInfo = await page.textContent(
        '[data-testid="compression-info"]'
      );
      expect(compressionInfo).toContain('Compression ratio:');
      expect(compressionInfo).toMatch(/\d+%/);

      // Verify final result is still complete
      await page.waitForSelector('[data-testid="final-result"]');
      const result = await page.textContent('[data-testid="final-result"]');
      expect(result).toBeTruthy();
    });

    test('should handle rate limiting gracefully', async () => {
      // Enable rate limiting (low limit for testing)
      await page.check('[data-testid="enable-rate-limiting"]');
      await page.fill('[data-testid="rate-limit-value"]', '2'); // 2 requests per minute

      // Send requests rapidly
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="rsc-input"]', `Request ${i + 1}`);
        await page.click('[data-testid="submit-rsc-request"]');
      }

      // Should show rate limiting message
      await page.waitForSelector('[data-testid="rate-limit-message"]');

      const rateLimitText = await page.textContent(
        '[data-testid="rate-limit-message"]'
      );
      expect(rateLimitText).toContain('Rate limit exceeded');
      expect(rateLimitText).toContain('Please wait');

      // Should show remaining requests counter
      const remainingRequests = await page.textContent(
        '[data-testid="remaining-requests"]'
      );
      expect(remainingRequests).toMatch(/\d+ requests remaining/);
    });
  });

  test.describe('RSC Artifact Generation', () => {
    test('should generate and stream artifacts with UI updates', async () => {
      // Navigate to artifact generation section
      await page.click('[data-testid="artifact-tab"]');

      // Configure artifact generation
      await page.selectOption('[data-testid="artifact-type"]', 'code');
      await page.fill(
        '[data-testid="artifact-prompt"]',
        'Create a React component for user authentication'
      );

      // Start generation
      await page.click('[data-testid="generate-artifact"]');

      // Should show loading state
      await page.waitForSelector('[data-testid="artifact-loading"]');
      const loadingText = await page.textContent(
        '[data-testid="artifact-loading"]'
      );
      expect(loadingText).toContain('Generating');

      // Should show progress updates
      await page.waitForSelector('[data-testid="generation-progress"]');

      // Wait for final artifact
      await page.waitForSelector('[data-testid="artifact-viewer"]', {
        timeout: 15_000,
      });

      // Verify artifact properties
      const artifactType = await page.textContent(
        '[data-testid="artifact-type"]'
      );
      const artifactContent = await page.textContent(
        '[data-testid="artifact-content"]'
      );

      expect(artifactType).toBe('code');
      expect(artifactContent).toContain('function');
      expect(artifactContent).toBeTruthy();
    });

    test('should handle artifact editing and updates', async () => {
      // Generate initial artifact
      await page.click('[data-testid="artifact-tab"]');
      await page.fill(
        '[data-testid="artifact-prompt"]',
        'Create a simple button component'
      );
      await page.click('[data-testid="generate-artifact"]');

      await page.waitForSelector('[data-testid="artifact-viewer"]');

      // Edit the artifact
      await page.click('[data-testid="edit-artifact"]');
      await page.fill(
        '[data-testid="artifact-editor"]',
        'Updated component code'
      );
      await page.click('[data-testid="save-artifact-edit"]');

      // Should show update confirmation
      await page.waitForSelector('[data-testid="artifact-updated"]');

      // Verify updated content
      const updatedContent = await page.textContent(
        '[data-testid="artifact-content"]'
      );
      expect(updatedContent).toContain('Updated component code');
    });

    test('should export artifacts in different formats', async () => {
      // Generate artifact
      await page.click('[data-testid="artifact-tab"]');
      await page.fill(
        '[data-testid="artifact-prompt"]',
        'Create a data visualization chart'
      );
      await page.click('[data-testid="generate-artifact"]');

      await page.waitForSelector('[data-testid="artifact-viewer"]');

      // Test different export formats
      const exportFormats = ['json', 'markdown', 'html'];

      for (const format of exportFormats) {
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.click(`[data-testid="export-${format}"]`),
        ]);

        expect(download.suggestedFilename()).toContain(`.${format}`);
      }
    });
  });

  test.describe('RSC Workflow Execution', () => {
    test('should execute multi-step workflows with streaming updates', async () => {
      // Navigate to workflow section
      await page.click('[data-testid="workflow-tab"]');

      // Configure workflow
      const workflowSteps = [
        { name: 'Analysis', description: 'Analyze requirements' },
        { name: 'Design', description: 'Create design specification' },
        { name: 'Implementation', description: 'Implement solution' },
        { name: 'Testing', description: 'Run tests and validation' },
      ];

      // Add workflow steps
      for (const [index, step] of workflowSteps.entries()) {
        await page.click('[data-testid="add-workflow-step"]');
        await page.fill(`[data-testid="step-name-${index}"]`, step.name);
        await page.fill(
          `[data-testid="step-description-${index}"]`,
          step.description
        );
      }

      // Execute workflow
      await page.click('[data-testid="execute-workflow"]');

      // Should show workflow status
      await page.waitForSelector('[data-testid="workflow-status"]');

      // Verify progress updates
      for (let i = 0; i < workflowSteps.length; i++) {
        await page.waitForSelector(
          `[data-testid="workflow-step"][data-step="${i}"][data-status="running"]`
        );
        await page.waitForSelector(
          `[data-testid="workflow-step"][data-step="${i}"][data-status="completed"]`
        );
      }

      // Verify final status
      const finalProgress = await page.textContent(
        '[data-testid="workflow-progress"]'
      );
      expect(finalProgress).toBe('100');

      const completedSteps = await page
        .locator('[data-testid="workflow-step"][data-status="completed"]')
        .count();
      expect(completedSteps).toBe(workflowSteps.length);
    });

    test('should handle workflow errors and recovery', async () => {
      // Mock workflow with failing step
      await page.route('/api/rsc/workflow-execution', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            steps: [
              { id: 'step-1', status: 'completed', result: 'Success' },
              { id: 'step-2', status: 'failed', error: 'Step 2 failed' },
              { id: 'step-3', status: 'pending' },
            ],
          }),
        });
      });

      await page.click('[data-testid="workflow-tab"]');
      await page.click('[data-testid="execute-sample-workflow"]');

      // Should show error for failed step
      await page.waitForSelector(
        '[data-testid="workflow-step"][data-step="1"][data-status="failed"]'
      );

      // Should show retry option
      await page.waitForSelector('[data-testid="retry-step-1"]');

      // Click retry
      await page.click('[data-testid="retry-step-1"]');

      // Should show retry attempt
      await page.waitForSelector('[data-testid="step-retry-indicator"]');
    });

    test('should support workflow pause and resume', async () => {
      await page.click('[data-testid="workflow-tab"]');
      await page.click('[data-testid="execute-long-workflow"]');

      // Wait for workflow to start
      await page.waitForSelector('[data-testid="workflow-running"]');

      // Pause workflow
      await page.click('[data-testid="pause-workflow"]');
      await page.waitForSelector('[data-testid="workflow-paused"]');

      // Resume workflow
      await page.click('[data-testid="resume-workflow"]');
      await page.waitForSelector('[data-testid="workflow-running"]');

      // Verify workflow continues
      await page.waitForSelector('[data-testid="workflow-completed"]', {
        timeout: 15_000,
      });
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should maintain performance with large RSC streams', async () => {
      // Enable performance monitoring
      await page.check('[data-testid="enable-performance-monitoring"]');

      // Request large content generation
      await page.fill(
        '[data-testid="rsc-input"]',
        'Generate a comprehensive documentation with 50 sections'
      );
      await page.click('[data-testid="submit-rsc-request"]');

      // Monitor streaming performance
      await page.waitForSelector('[data-testid="performance-metrics"]');

      // Should complete within reasonable time
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="large-content-complete"]', {
        timeout: 30_000,
      });
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(30_000); // Should complete within 30 seconds

      // Check performance metrics
      const performanceData = await page.textContent(
        '[data-testid="performance-metrics"]'
      );
      expect(performanceData).toContain('Response time:');
      expect(performanceData).toContain('Memory usage:');
      expect(performanceData).toContain('Streaming rate:');
    });

    test('should handle network interruptions gracefully', async () => {
      // Start RSC stream
      await page.fill(
        '[data-testid="rsc-input"]',
        'Generate content with network interruption test'
      );
      await page.click('[data-testid="submit-rsc-request"]');

      // Wait for stream to start
      await page.waitForSelector('[data-testid="streaming-active"]');

      // Simulate network interruption by failing the route
      await page.route('/api/rsc/**', (route) => route.abort());

      // Should show reconnection attempt
      await page.waitForSelector('[data-testid="reconnection-attempt"]');

      // Restore network
      await page.unroute('/api/rsc/**');
      await page.route('/api/rsc/streaming-chat', async (route) => {
        await route.fulfill(mockRSCResponses.streamingChat.success);
      });

      // Should recover and complete
      await page.waitForSelector('[data-testid="stream-recovered"]');
      await page.waitForSelector('[data-testid="streaming-complete"]');
    });

    test('should optimize memory usage for long-running streams', async () => {
      // Enable memory optimization
      await page.check('[data-testid="enable-memory-optimization"]');

      // Start long-running stream
      await page.fill(
        '[data-testid="rsc-input"]',
        'Generate continuous content stream'
      );
      await page.click('[data-testid="start-continuous-stream"]');

      // Monitor memory usage
      const memoryUsage: number[] = [];

      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);

        const memoryText = await page.textContent(
          '[data-testid="memory-usage"]'
        );
        const memoryMatch = memoryText?.match(/(\d+(?:\.\d+)?)\s*MB/);

        if (memoryMatch) {
          memoryUsage.push(Number.parseFloat(memoryMatch[1]));
        }
      }

      // Stop stream
      await page.click('[data-testid="stop-continuous-stream"]');

      // Memory usage should not continuously increase
      const maxMemory = Math.max(...memoryUsage);
      const minMemory = Math.min(...memoryUsage);
      const memoryIncrease = maxMemory - minMemory;

      expect(memoryIncrease).toBeLessThan(50); // Should not increase by more than 50MB
    });
  });

  test.describe('Accessibility and User Experience', () => {
    test('should provide proper ARIA labels for streaming content', async () => {
      await page.fill(
        '[data-testid="rsc-input"]',
        'Test accessibility features'
      );
      await page.click('[data-testid="submit-rsc-request"]');

      // Check streaming container accessibility
      const streamingContainer = page.locator(
        '[data-testid="streaming-container"]'
      );
      expect(await streamingContainer.getAttribute('role')).toBe('log');
      expect(await streamingContainer.getAttribute('aria-live')).toBe('polite');
      expect(await streamingContainer.getAttribute('aria-label')).toContain(
        'Streaming content'
      );

      // Check individual message accessibility
      await page.waitForSelector('[data-testid="streaming-message"]');
      const message = page.locator('[data-testid="streaming-message"]');
      expect(await message.getAttribute('role')).toBe('article');
      expect(await message.getAttribute('aria-label')).toBeTruthy();
    });

    test('should support keyboard navigation for RSC interfaces', async () => {
      // Tab to RSC input
      await page.keyboard.press('Tab');

      // Verify focus is on input
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      );
      expect(focusedElement).toBe('rsc-input');

      // Type message using keyboard
      await page.keyboard.type('Keyboard navigation test');

      // Submit using Enter
      await page.keyboard.press('Enter');

      // Verify response
      await page.waitForSelector('[data-testid="streaming-message"]');
      const response = await page.textContent(
        '[data-testid="streaming-message"]'
      );
      expect(response).toBeTruthy();
    });

    test('should provide screen reader announcements for stream updates', async () => {
      // Enable screen reader mode
      await page.check('[data-testid="enable-screen-reader-mode"]');

      await page.fill(
        '[data-testid="rsc-input"]',
        'Screen reader announcement test'
      );
      await page.click('[data-testid="submit-rsc-request"]');

      // Check for announcement elements
      await page.waitForSelector('[data-testid="sr-announcement"]');

      const announcements = await page
        .locator('[data-testid="sr-announcement"]')
        .allTextContents();
      expect(
        announcements.some((text) => text.includes('Stream started'))
      ).toBe(true);
      expect(
        announcements.some((text) => text.includes('Stream completed'))
      ).toBe(true);
    });
  });
});
