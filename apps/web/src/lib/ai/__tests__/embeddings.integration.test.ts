import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  calculateTextSimilarity,
  embed,
  embedMany,
  SemanticSearch,
} from '../embeddings';

// Integration tests that run against real OpenAI API
// These tests require a valid OpenAI API key in environment variables
// Run with: OPENAI_API_KEY=your-key npm run test:integration

const isIntegrationTest =
  process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test';

describe.skipIf(!isIntegrationTest)('Embeddings Integration Tests', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not found, skipping integration tests');
    }
  });

  afterAll(() => {
    // Cleanup any resources if needed
  });

  describe('embed function integration', () => {
    it('should generate real embeddings with text-embedding-3-small', async () => {
      const result = await embed({
        model: 'text-embedding-3-small',
        value: 'The quick brown fox jumps over the lazy dog',
      });

      expect(result.value).toBe('The quick brown fox jumps over the lazy dog');
      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding).toHaveLength(1536); // Default dimensions for text-embedding-3-small
      expect(result.usage.tokens).toBeGreaterThan(0);
      expect(typeof result.usage.tokens).toBe('number');

      // Check that embedding values are numbers in reasonable range
      result.embedding.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(-2);
        expect(value).toBeLessThan(2);
      });
    }, 10_000); // 10 second timeout

    it('should generate real embeddings with text-embedding-3-large', async () => {
      const result = await embed({
        model: 'text-embedding-3-large',
        value: 'Advanced text embedding with large model',
      });

      expect(result.value).toBe('Advanced text embedding with large model');
      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding).toHaveLength(3072); // Default dimensions for text-embedding-3-large
      expect(result.usage.tokens).toBeGreaterThan(0);
    }, 10_000);

    it('should generate embeddings with custom dimensions', async () => {
      const result = await embed({
        model: 'text-embedding-3-large',
        value: 'Custom dimensions test',
        providerOptions: {
          openai: {
            dimensions: 1024,
          },
        },
      });

      expect(result.embedding).toHaveLength(1024);
      expect(result.usage.tokens).toBeGreaterThan(0);
    }, 10_000);

    it('should handle user identification', async () => {
      const result = await embed({
        model: 'text-embedding-3-small',
        value: 'User identification test',
        providerOptions: {
          openai: {
            user: 'integration-test-user',
          },
        },
      });

      expect(result.value).toBe('User identification test');
      expect(result.embedding).toHaveLength(1536);
    }, 10_000);
  });

  describe('embedMany function integration', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First document about machine learning',
        'Second document about artificial intelligence',
        'Third document about natural language processing',
      ];

      const result = await embedMany({
        model: 'text-embedding-3-small',
        values: texts,
      });

      expect(result.values).toEqual(texts);
      expect(result.embeddings).toHaveLength(3);
      expect(result.usage.tokens).toBeGreaterThan(0);

      // Each embedding should have correct dimensions
      result.embeddings.forEach((embedding) => {
        expect(embedding).toHaveLength(1536);
        embedding.forEach((value) => {
          expect(typeof value).toBe('number');
          expect(value).toBeGreaterThan(-2);
          expect(value).toBeLessThan(2);
        });
      });
    }, 15_000);

    it('should handle large batches efficiently', async () => {
      // Test with 150 items to verify batch processing
      const texts = Array.from(
        { length: 150 },
        (_, i) => `Document ${i} with unique content`
      );

      const result = await embedMany({
        model: 'text-embedding-3-small',
        values: texts,
      });

      expect(result.values).toHaveLength(150);
      expect(result.embeddings).toHaveLength(150);
      expect(result.usage.tokens).toBeGreaterThan(100); // Should be substantial for 150 texts
    }, 30_000); // Longer timeout for large batch

    it('should work with text-embedding-3-large and custom dimensions', async () => {
      const texts = [
        'Advanced embedding test one',
        'Advanced embedding test two',
      ];

      const result = await embedMany({
        model: 'text-embedding-3-large',
        values: texts,
        providerOptions: {
          openai: {
            dimensions: 2048,
          },
        },
      });

      expect(result.embeddings).toHaveLength(2);
      result.embeddings.forEach((embedding) => {
        expect(embedding).toHaveLength(2048);
      });
    }, 15_000);
  });

  describe('Semantic similarity integration', () => {
    it('should calculate meaningful similarity scores', async () => {
      // Test with semantically similar texts
      const similarity1 = await calculateTextSimilarity(
        'The cat sat on the mat',
        'A cat was sitting on a mat'
      );

      // Test with semantically different texts
      const similarity2 = await calculateTextSimilarity(
        'The cat sat on the mat',
        'Quantum computing and artificial intelligence'
      );

      expect(similarity1).toBeGreaterThan(0.7); // Similar texts should have high similarity
      expect(similarity2).toBeLessThan(0.5); // Different texts should have lower similarity
      expect(similarity1).toBeGreaterThan(similarity2); // Similar should be higher than different
    }, 15_000);

    it('should handle identical texts', async () => {
      const text = 'This is an identical text for testing';
      const similarity = await calculateTextSimilarity(text, text);

      expect(similarity).toBeGreaterThan(0.99); // Identical texts should have very high similarity
    }, 10_000);
  });

  describe('SemanticSearch integration', () => {
    it('should perform end-to-end semantic search', async () => {
      const search = new SemanticSearch({
        model: 'text-embedding-3-small',
      });

      // Add documents
      await search.addDocuments([
        {
          id: 'doc1',
          text: 'Machine learning is a subset of artificial intelligence',
          metadata: { category: 'AI' },
        },
        {
          id: 'doc2',
          text: 'Python is a popular programming language for data science',
          metadata: { category: 'Programming' },
        },
        {
          id: 'doc3',
          text: 'Neural networks are inspired by biological neural networks',
          metadata: { category: 'AI' },
        },
        {
          id: 'doc4',
          text: 'JavaScript is used for web development and frontend applications',
          metadata: { category: 'Programming' },
        },
      ]);

      expect(search.size).toBe(4);

      // Search for AI-related content
      const aiResults = await search.search(
        'artificial intelligence and neural networks',
        {
          topK: 2,
          threshold: 0.5,
        }
      );

      expect(aiResults).toHaveLength(2);
      expect(aiResults[0].metadata.category).toBe('AI');
      expect(aiResults[1].metadata.category).toBe('AI');
      expect(aiResults[0].similarity).toBeGreaterThan(0.5);

      // Search for programming-related content
      const progResults = await search.search(
        'programming languages and web development',
        {
          topK: 2,
          threshold: 0.5,
        }
      );

      expect(progResults).toHaveLength(2);
      expect(progResults[0].metadata.category).toBe('Programming');
      expect(progResults[0].similarity).toBeGreaterThan(0.5);
    }, 20_000);

    it('should handle document filtering', async () => {
      const search = new SemanticSearch({
        model: 'text-embedding-3-small',
      });

      await search.addDocuments([
        {
          id: 'doc1',
          text: 'Machine learning tutorial',
          metadata: { type: 'tutorial', level: 'beginner' },
        },
        {
          id: 'doc2',
          text: 'Advanced machine learning concepts',
          metadata: { type: 'article', level: 'advanced' },
        },
        {
          id: 'doc3',
          text: 'Machine learning basics',
          metadata: { type: 'tutorial', level: 'beginner' },
        },
      ]);

      // Search with filter for tutorials only
      const tutorialResults = await search.search('machine learning', {
        topK: 5,
        filter: (metadata) => metadata.type === 'tutorial',
      });

      expect(tutorialResults).toHaveLength(2);
      tutorialResults.forEach((result) => {
        expect(result.metadata.type).toBe('tutorial');
      });
    }, 15_000);
  });

  describe('Error handling integration', () => {
    it('should handle rate limiting gracefully', async () => {
      // This test might fail if rate limits are hit
      // In production, implement exponential backoff
      const promises = Array.from({ length: 5 }, (_, i) =>
        embed({
          model: 'text-embedding-3-small',
          value: `Rate limit test ${i}`,
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.embedding).toHaveLength(1536);
      });
    }, 30_000);

    it('should handle malformed input gracefully', async () => {
      // Test with very long input
      const longText = 'word '.repeat(3000); // Approximately 6000 tokens, over the limit

      const result = await embed({
        model: 'text-embedding-3-small',
        value: longText,
      });

      // Should truncate and still work
      expect(result.embedding).toHaveLength(1536);
      expect(result.usage.tokens).toBeGreaterThan(0);
    }, 10_000);
  });

  describe('Model comparison', () => {
    it('should produce different embeddings for different models', async () => {
      const text = 'Compare embeddings across different models';

      const [smallResult, largeResult] = await Promise.all([
        embed({
          model: 'text-embedding-3-small',
          value: text,
        }),
        embed({
          model: 'text-embedding-3-large',
          value: text,
        }),
      ]);

      expect(smallResult.embedding).toHaveLength(1536);
      expect(largeResult.embedding).toHaveLength(3072);

      // Embeddings should be different (different models, different dimensions)
      expect(smallResult.embedding).not.toEqual(
        largeResult.embedding.slice(0, 1536)
      );
    }, 15_000);
  });

  describe('Performance benchmarks', () => {
    it('should embed single text within reasonable time', async () => {
      const start = Date.now();

      await embed({
        model: 'text-embedding-3-small',
        value: 'Performance test for single embedding',
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should embed batch of texts efficiently', async () => {
      const texts = Array.from(
        { length: 10 },
        (_, i) => `Batch performance test ${i}`
      );
      const start = Date.now();

      await embedMany({
        model: 'text-embedding-3-small',
        values: texts,
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10_000); // Batch should be efficient
    });
  });
});
