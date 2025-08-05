import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { vi } from 'vitest';

// Mock API responses for testing
const mockChatResponse = {
  id: 'test-chat-response',
  messages: [
    { id: '1', role: 'user', content: 'Hello' },
    { id: '2', role: 'assistant', content: 'Hello! How can I help you today?' },
  ],
  usage: { totalTokens: 25 },
};

const mockCompletionResponse = {
  id: 'test-completion',
  choices: [{ text: 'This is a test completion response.' }],
  usage: { totalTokens: 15 },
};

test.describe('React Hooks E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Mock API endpoints
    await page.route('/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponse),
      });
    });

    await page.route('/api/completion', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCompletionResponse),
      });
    });

    await page.route('/api/assistant/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ file_id: 'test-file-123' }),
        });
      } else if (url.includes('/files/')) {
        await route.fulfill({ status: 200 });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockChatResponse),
        });
      }
    });

    // Navigate to test page
    await page.goto('/chat'); // Assuming there's a chat page for testing
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('useChat Integration', () => {
    test('should send and receive messages', async () => {
      // Wait for chat interface to load
      await page.waitForSelector('[data-testid="chat-input"]', {
        timeout: 10_000,
      });

      // Type a message
      await page.fill('[data-testid="chat-input"]', 'Hello, assistant!');

      // Send the message
      await page.click('[data-testid="send-button"]');

      // Wait for response
      await page.waitForSelector('[data-testid="message-assistant"]', {
        timeout: 5000,
      });

      // Verify messages are displayed correctly
      const userMessage = await page.textContent(
        '[data-testid="message-user"]'
      );
      const assistantMessage = await page.textContent(
        '[data-testid="message-assistant"]'
      );

      expect(userMessage).toContain('Hello, assistant!');
      expect(assistantMessage).toContain('Hello! How can I help you today?');
    });

    test('should handle message retry', async () => {
      // Mock an error response first
      await page.route('/api/chat', async (route, request) => {
        const requestCount = await page.evaluate(
          () => window.requestCount || 0
        );

        if (requestCount === 0) {
          await page.evaluate(() => {
            window.requestCount = 1;
          });
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockChatResponse),
          });
        }
      });

      await page.fill('[data-testid="chat-input"]', 'Test retry');
      await page.click('[data-testid="send-button"]');

      // Wait for error state
      await page.waitForSelector('[data-testid="error-message"]', {
        timeout: 3000,
      });

      // Click retry button
      await page.click('[data-testid="retry-button"]');

      // Wait for successful response
      await page.waitForSelector('[data-testid="message-assistant"]', {
        timeout: 5000,
      });

      const assistantMessage = await page.textContent(
        '[data-testid="message-assistant"]'
      );
      expect(assistantMessage).toContain('Hello! How can I help you today?');
    });

    test('should handle conversation persistence', async () => {
      // Send a message
      await page.fill('[data-testid="chat-input"]', 'Test persistence');
      await page.click('[data-testid="send-button"]');

      // Wait for response
      await page.waitForSelector('[data-testid="message-assistant"]');

      // Save conversation
      await page.click('[data-testid="save-conversation"]');

      // Wait for save confirmation
      await page.waitForSelector('[data-testid="toast-success"]');

      // Reload page
      await page.reload();

      // Load conversation
      await page.click('[data-testid="load-conversation"]');

      // Verify messages are restored
      const messages = await page.locator('[data-testid^="message-"]').count();
      expect(messages).toBeGreaterThan(0);
    });

    test('should export conversation', async () => {
      // Send a message to have content to export
      await page.fill('[data-testid="chat-input"]', 'Export test');
      await page.click('[data-testid="send-button"]');

      await page.waitForSelector('[data-testid="message-assistant"]');

      // Open export menu
      await page.click('[data-testid="export-menu"]');

      // Test JSON export
      const [jsonDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-json"]'),
      ]);

      expect(jsonDownload.suggestedFilename()).toContain('.json');

      // Test Markdown export
      const [markdownDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-markdown"]'),
      ]);

      expect(markdownDownload.suggestedFilename()).toContain('.md');
    });
  });

  test.describe('useCompletion Integration', () => {
    test('should generate text completion', async () => {
      // Navigate to completion test page
      await page.goto('/completion-test');

      await page.waitForSelector('[data-testid="completion-input"]');

      // Enter prompt
      await page.fill(
        '[data-testid="completion-input"]',
        'Complete this sentence: The weather today is'
      );

      // Generate completion
      await page.click('[data-testid="generate-button"]');

      // Wait for completion
      await page.waitForSelector('[data-testid="completion-result"]', {
        timeout: 10_000,
      });

      const completion = await page.textContent(
        '[data-testid="completion-result"]'
      );
      expect(completion).toContain('This is a test completion response.');
    });

    test('should handle completion streaming', async () => {
      // Mock streaming response
      await page.route('/api/completion', async (route) => {
        // Simulate streaming by sending chunked response
        const chunks = ['This ', 'is ', 'a ', 'streaming ', 'completion.'];
        let response = '';

        for (const chunk of chunks) {
          response += chunk;
          await page.evaluate((text) => {
            const event = new CustomEvent('completion-chunk', { detail: text });
            window.dispatchEvent(event);
          }, response);

          await page.waitForTimeout(100); // Simulate streaming delay
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ text: response }] }),
        });
      });

      await page.goto('/completion-test');
      await page.fill('[data-testid="completion-input"]', 'Stream this');
      await page.click('[data-testid="generate-button"]');

      // Wait for streaming to complete
      await page.waitForFunction(() => {
        const result = document.querySelector(
          '[data-testid="completion-result"]'
        );
        return result?.textContent?.includes('streaming completion.');
      });

      const completion = await page.textContent(
        '[data-testid="completion-result"]'
      );
      expect(completion).toContain('streaming completion.');
    });

    test('should handle batch completions', async () => {
      await page.goto('/batch-completion-test');

      // Add multiple prompts
      await page.click('[data-testid="add-prompt"]');
      await page.fill('[data-testid="prompt-0"]', 'First prompt');

      await page.click('[data-testid="add-prompt"]');
      await page.fill('[data-testid="prompt-1"]', 'Second prompt');

      await page.click('[data-testid="add-prompt"]');
      await page.fill('[data-testid="prompt-2"]', 'Third prompt');

      // Process batch
      await page.click('[data-testid="process-batch"]');

      // Wait for all completions
      await page.waitForSelector('[data-testid="batch-complete"]', {
        timeout: 15_000,
      });

      // Verify all results
      const results = await page.locator('[data-testid^="result-"]').count();
      expect(results).toBe(3);

      // Check progress indicator
      const progress = await page.textContent('[data-testid="batch-progress"]');
      expect(progress).toBe('100%');
    });
  });

  test.describe('useAssistant Integration', () => {
    test('should create and manage threads', async () => {
      await page.goto('/assistant-test');

      // Create new thread
      await page.click('[data-testid="create-thread"]');

      // Wait for thread creation
      await page.waitForSelector('[data-testid="thread-id"]');

      const threadId = await page.textContent('[data-testid="thread-id"]');
      expect(threadId).toBeTruthy();

      // Send message in thread
      await page.fill('[data-testid="assistant-input"]', 'Hello assistant');
      await page.click('[data-testid="send-to-assistant"]');

      // Wait for response
      await page.waitForSelector('[data-testid="assistant-response"]');

      const response = await page.textContent(
        '[data-testid="assistant-response"]'
      );
      expect(response).toContain('Hello! How can I help you today?');
    });

    test('should handle tool execution', async () => {
      await page.goto('/assistant-test');

      // Create thread with tools
      await page.click('[data-testid="create-thread-with-tools"]');

      // Send message that should trigger tool
      await page.fill('[data-testid="assistant-input"]', 'Calculate 2 + 3');
      await page.click('[data-testid="send-to-assistant"]');

      // Wait for tool execution
      await page.waitForSelector('[data-testid="tool-execution"]');

      const toolResult = await page.textContent('[data-testid="tool-result"]');
      expect(toolResult).toContain('5'); // Expected calculation result
    });

    test('should upload and manage files', async () => {
      await page.goto('/assistant-test');

      // Create test file
      const fileContent = 'This is a test file for upload';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

      // Upload file
      await page.setInputFiles('[data-testid="file-upload"]', {
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent),
      });

      await page.click('[data-testid="upload-file"]');

      // Wait for upload success
      await page.waitForSelector('[data-testid="upload-success"]');

      const fileId = await page.textContent('[data-testid="file-id"]');
      expect(fileId).toBeTruthy();

      // Delete file
      await page.click('[data-testid="delete-file"]');

      // Wait for deletion success
      await page.waitForSelector('[data-testid="delete-success"]');
    });

    test('should export thread data', async () => {
      await page.goto('/assistant-test');

      // Create thread and send messages
      await page.click('[data-testid="create-thread"]');
      await page.fill('[data-testid="assistant-input"]', 'Test export');
      await page.click('[data-testid="send-to-assistant"]');

      await page.waitForSelector('[data-testid="assistant-response"]');

      // Export thread
      await page.click('[data-testid="export-thread"]');

      // Test JSON export
      const [jsonDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-thread-json"]'),
      ]);

      expect(jsonDownload.suggestedFilename()).toMatch(/thread-.*\.json/);

      // Test Markdown export
      const [markdownDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-thread-markdown"]'),
      ]);

      expect(markdownDownload.suggestedFilename()).toMatch(/thread-.*\.md/);
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should handle high message volume', async () => {
      await page.goto('/chat');

      // Send multiple messages rapidly
      for (let i = 0; i < 10; i++) {
        await page.fill('[data-testid="chat-input"]', `Message ${i + 1}`);
        await page.click('[data-testid="send-button"]');

        // Small delay to prevent overwhelming
        await page.waitForTimeout(100);
      }

      // Wait for all responses
      await page.waitForFunction(
        () => {
          const messages = document.querySelectorAll(
            '[data-testid="message-assistant"]'
          );
          return messages.length >= 10;
        },
        { timeout: 30_000 }
      );

      const messageCount = await page
        .locator('[data-testid="message-assistant"]')
        .count();
      expect(messageCount).toBe(10);
    });

    test('should handle network interruptions gracefully', async () => {
      await page.goto('/chat');

      // Start sending a message
      await page.fill(
        '[data-testid="chat-input"]',
        'Test network interruption'
      );
      await page.click('[data-testid="send-button"]');

      // Simulate network interruption
      await page.route('/api/chat', (route) => route.abort());

      // Wait for error handling
      await page.waitForSelector('[data-testid="network-error"]', {
        timeout: 5000,
      });

      // Restore network
      await page.unroute('/api/chat');
      await page.route('/api/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockChatResponse),
        });
      });

      // Retry should work
      await page.click('[data-testid="retry-button"]');
      await page.waitForSelector('[data-testid="message-assistant"]', {
        timeout: 5000,
      });
    });

    test('should maintain performance with large conversation history', async () => {
      await page.goto('/chat');

      // Load a large conversation (simulate)
      await page.evaluate(() => {
        const messages = [];
        for (let i = 0; i < 100; i++) {
          messages.push(
            { id: `user-${i}`, role: 'user', content: `User message ${i}` },
            {
              id: `assistant-${i}`,
              role: 'assistant',
              content: `Assistant response ${i}`,
            }
          );
        }

        // Trigger large conversation load
        window.dispatchEvent(
          new CustomEvent('load-large-conversation', {
            detail: { messages },
          })
        );
      });

      // Wait for conversation to load
      await page.waitForFunction(() => {
        const messages = document.querySelectorAll('[data-testid^="message-"]');
        return messages.length >= 200;
      });

      // Test that interface remains responsive
      const startTime = Date.now();
      await page.fill('[data-testid="chat-input"]', 'Performance test');
      await page.click('[data-testid="send-button"]');

      await page.waitForSelector('[data-testid="message-assistant"]');
      const responseTime = Date.now() - startTime;

      // Response should be reasonable even with large history
      expect(responseTime).toBeLessThan(5000);
    });

    test('should handle concurrent operations', async () => {
      await page.goto('/chat');

      // Start multiple operations concurrently
      const operations = [
        page
          .fill('[data-testid="chat-input"]', 'Concurrent test 1')
          .then(() => page.click('[data-testid="send-button"]')),
        page.click('[data-testid="save-conversation"]'),
        page.click('[data-testid="export-menu"]'),
      ];

      // All operations should complete without conflicts
      await Promise.all(operations);

      // Verify no error states
      const errorElements = await page
        .locator('[data-testid*="error"]')
        .count();
      expect(errorElements).toBe(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async () => {
      await page.goto('/chat');

      // Tab to input field
      await page.keyboard.press('Tab');

      // Type message
      await page.keyboard.type('Accessibility test');

      // Send with Enter
      await page.keyboard.press('Enter');

      // Wait for response
      await page.waitForSelector('[data-testid="message-assistant"]');

      // Verify message was sent
      const userMessage = await page.textContent(
        '[data-testid="message-user"]'
      );
      expect(userMessage).toContain('Accessibility test');
    });

    test('should have proper ARIA labels', async () => {
      await page.goto('/chat');

      // Check input accessibility
      const inputAriaLabel = await page.getAttribute(
        '[data-testid="chat-input"]',
        'aria-label'
      );
      expect(inputAriaLabel).toBeTruthy();

      // Check button accessibility
      const buttonAriaLabel = await page.getAttribute(
        '[data-testid="send-button"]',
        'aria-label'
      );
      expect(buttonAriaLabel).toBeTruthy();

      // Check message accessibility
      await page.fill('[data-testid="chat-input"]', 'ARIA test');
      await page.click('[data-testid="send-button"]');

      await page.waitForSelector('[data-testid="message-assistant"]');

      const messageRole = await page.getAttribute(
        '[data-testid="message-assistant"]',
        'role'
      );
      expect(messageRole).toBe('article');
    });

    test('should support screen readers', async () => {
      await page.goto('/chat');

      // Send message
      await page.fill('[data-testid="chat-input"]', 'Screen reader test');
      await page.click('[data-testid="send-button"]');

      // Wait for response
      await page.waitForSelector('[data-testid="message-assistant"]');

      // Check for live region updates
      const liveRegion = await page.locator('[aria-live="polite"]');
      expect(await liveRegion.count()).toBeGreaterThan(0);

      // Verify content is accessible
      const messageText = await page.textContent(
        '[data-testid="message-assistant"]'
      );
      expect(messageText).toBeTruthy();
    });
  });
});
