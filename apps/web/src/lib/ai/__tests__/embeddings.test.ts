import { beforeEach, describe, expect, jest, test } from 'bun:test';
import {
  calculateTextSimilarity,
  clusterTexts,
  type EmbedManyOptions,
  type EmbedManyResult,
  type EmbedOptions,
  type EmbedResult,
  embed,
  embedMany,
  embedText,
  embedTexts,
  findSimilar,
  SemanticSearch,
} from '../embeddings';

// Mock the AI SDK
jest.mock('ai', () => ({
  embed: jest.fn(),
  embedMany: jest.fn(),
  cosineSimilarity: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: {
    textEmbeddingModel: jest.fn(),
  },
}));

// Mock LRU cache
jest.mock('lru-cache', () => ({
  LRUCache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  })),
}));

describe('AI SDK v5 Embeddings Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('embed function', () => {
    test('should generate embedding for single text using default model', async () => {
      const { embed: aiEmbed } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');

      // Setup mocks
      const mockModel = { modelId: 'text-embedding-3-small' };
      jest.mocked(openai.textEmbeddingModel).mockReturnValue(mockModel as any);

      const mockResult: EmbedResult = {
        value: 'test text',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      jest.mocked(aiEmbed).mockResolvedValue(mockResult);

      const result = await embed({
        value: 'test text',
      });

      expect(result).toEqual(mockResult);
      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text',
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });
    });

    it('should use text-embedding-3-large with custom dimensions', async () => {
      const mockResult: EmbedResult = {
        value: 'test text',
        embedding: new Array(1024).fill(0.1),
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed.mockResolvedValue(mockResult);

      const result = await embed({
        model: 'text-embedding-3-large',
        value: 'test text',
        providerOptions: {
          openai: {
            dimensions: 1024,
            user: 'test-user',
          },
        },
      });

      expect(result).toEqual(mockResult);
      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text',
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: {
          openai: {
            dimensions: 1024,
            user: 'test-user',
          },
        },
      });
    });

    it('should handle retry logic and error handling', async () => {
      const options: EmbedOptions = {
        value: 'test text',
        maxRetries: 5,
      };

      mockedAiEmbed.mockRejectedValue(new Error('API error'));

      await expect(embed(options)).rejects.toThrow(
        'Embedding generation failed: API error'
      );
      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text',
        maxRetries: 5,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });
    });

    it('should validate input and throw error for empty value', async () => {
      await expect(embed({ value: '' })).rejects.toThrow(
        'Value must be a non-empty string'
      );
      await expect(embed({ value: null as any })).rejects.toThrow(
        'Value must be a non-empty string'
      );
    });

    it('should support abort signal', async () => {
      const abortController = new AbortController();
      const mockResult: EmbedResult = {
        value: 'test text',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed.mockResolvedValue(mockResult);

      await embed({
        value: 'test text',
        abortSignal: abortController.signal,
      });

      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text',
        maxRetries: 2,
        abortSignal: abortController.signal,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });
    });

    it('should support custom headers', async () => {
      const headers = { 'Custom-Header': 'test-value' };
      const mockResult: EmbedResult = {
        value: 'test text',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed.mockResolvedValue(mockResult);

      await embed({
        value: 'test text',
        headers,
      });

      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text',
        maxRetries: 2,
        abortSignal: undefined,
        headers,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });
    });

    it('should support experimental telemetry', async () => {
      const telemetry = {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
        functionId: 'test-function',
        metadata: { test: 'metadata' },
      };

      const mockResult: EmbedResult = {
        value: 'test text',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed.mockResolvedValue(mockResult);

      await embed({
        value: 'test text',
        experimental_telemetry: telemetry,
      });

      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text',
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: telemetry,
        providerOptions: undefined,
      });
    });
  });

  describe('embedMany function', () => {
    it('should generate embeddings for multiple texts', async () => {
      const values = ['text 1', 'text 2', 'text 3'];
      const mockResult: EmbedManyResult = {
        values,
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
          [0.5, 0.6],
        ],
        usage: { tokens: 15 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbedMany.mockResolvedValue(mockResult);

      const result = await embedMany({ values });

      expect(result).toEqual(mockResult);
      expect(mockedAiEmbedMany).toHaveBeenCalledWith({
        model: expect.any(Object),
        values,
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });
    });

    it('should handle large batches by splitting them', async () => {
      // Create a large array that exceeds MAX_BATCH_SIZE (100)
      const values = Array.from({ length: 150 }, (_, i) => `text ${i}`);

      const batch1Result: EmbedManyResult = {
        values: values.slice(0, 100),
        embeddings: Array.from({ length: 100 }, () => [0.1, 0.2]),
        usage: { tokens: 500 },
        response: undefined,
        providerMetadata: undefined,
      };

      const batch2Result: EmbedManyResult = {
        values: values.slice(100),
        embeddings: Array.from({ length: 50 }, () => [0.3, 0.4]),
        usage: { tokens: 250 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbedMany
        .mockResolvedValueOnce(batch1Result)
        .mockResolvedValueOnce(batch2Result);

      const result = await embedMany({ values });

      expect(result.values).toEqual(values);
      expect(result.embeddings).toHaveLength(150);
      expect(result.usage.tokens).toBe(750); // Combined usage
      expect(mockedAiEmbedMany).toHaveBeenCalledTimes(2);
    });

    it('should validate input and throw error for empty array', async () => {
      await expect(embedMany({ values: [] })).rejects.toThrow(
        'Values must be a non-empty array of strings'
      );
      await expect(embedMany({ values: null as any })).rejects.toThrow(
        'Values must be a non-empty array of strings'
      );
    });

    it('should use text-embedding-3-large with provider options', async () => {
      const values = ['text 1', 'text 2'];
      const mockResult: EmbedManyResult = {
        values,
        embeddings: [new Array(3072).fill(0.1), new Array(3072).fill(0.2)],
        usage: { tokens: 10 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbedMany.mockResolvedValue(mockResult);

      await embedMany({
        model: 'text-embedding-3-large',
        values,
        providerOptions: {
          openai: {
            dimensions: 3072,
            user: 'batch-user',
          },
        },
      });

      expect(mockedAiEmbedMany).toHaveBeenCalledWith({
        model: expect.any(Object),
        values,
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: {
          openai: {
            dimensions: 3072,
            user: 'batch-user',
          },
        },
      });
    });
  });

  describe('Legacy wrapper functions', () => {
    it('should maintain backward compatibility with embedText', async () => {
      const mockResult: EmbedResult = {
        value: 'test text',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed.mockResolvedValue(mockResult);

      const result = await embedText('test text', {
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });

      expect(result).toEqual({
        embedding: [0.1, 0.2, 0.3],
        text: 'test text',
        model: 'text-embedding-3-small',
        dimensions: 3,
      });
    });

    it('should maintain backward compatibility with embedTexts', async () => {
      const texts = ['text 1', 'text 2'];
      const mockResult: EmbedManyResult = {
        values: texts,
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        usage: { tokens: 10 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbedMany.mockResolvedValue(mockResult);

      const results = await embedTexts(texts, {
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        embedding: [0.1, 0.2],
        text: 'text 1',
        model: 'text-embedding-3-small',
        dimensions: 2,
      });
    });
  });

  describe('Text sanitization', () => {
    it('should sanitize text with excessive whitespace', async () => {
      const mockResult: EmbedResult = {
        value: 'test text with normalized spaces',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed.mockResolvedValue(mockResult);

      await embed({
        value: '  test   text    with\n\n\nnormalized    spaces  ',
      });

      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'test text with normalized spaces',
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });
    });

    it('should handle text truncation for very long inputs', async () => {
      const longText = 'a'.repeat(10_000); // Longer than MAX_TEXT_LENGTH
      const mockResult: EmbedResult = {
        value: 'a'.repeat(8191), // Truncated
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      // Mock console.warn to avoid log output in tests
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      mockedAiEmbed.mockResolvedValue(mockResult);

      await embed({ value: longText });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Text truncated from 10000 to 8191 characters')
      );
      expect(mockedAiEmbed).toHaveBeenCalledWith({
        model: expect.any(Object),
        value: 'a'.repeat(8191),
        maxRetries: 2,
        abortSignal: undefined,
        headers: undefined,
        experimental_telemetry: undefined,
        providerOptions: undefined,
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Model compatibility', () => {
    const models = [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ];

    models.forEach((model) => {
      it(`should work with ${model}`, async () => {
        const mockResult: EmbedResult = {
          value: 'test text',
          embedding: [0.1, 0.2, 0.3],
          usage: { tokens: 5 },
          response: undefined,
          providerMetadata: undefined,
        };

        mockedAiEmbed.mockResolvedValue(mockResult);

        await embed({
          model,
          value: 'test text',
        });

        expect(mockedOpenAI.textEmbeddingModel).toHaveBeenCalledWith(model);
      });
    });
  });

  describe('Dimension support', () => {
    it('should support custom dimensions for text-embedding-3-large', async () => {
      const dimensions = [512, 1024, 1536, 2048, 3072];

      for (const dim of dimensions) {
        const mockResult: EmbedResult = {
          value: 'test text',
          embedding: new Array(dim).fill(0.1),
          usage: { tokens: 5 },
          response: undefined,
          providerMetadata: undefined,
        };

        mockedAiEmbed.mockResolvedValue(mockResult);

        await embed({
          model: 'text-embedding-3-large',
          value: 'test text',
          providerOptions: {
            openai: { dimensions: dim },
          },
        });

        expect(mockedAiEmbed).toHaveBeenCalledWith({
          model: expect.any(Object),
          value: 'test text',
          maxRetries: 2,
          abortSignal: undefined,
          headers: undefined,
          experimental_telemetry: undefined,
          providerOptions: {
            openai: { dimensions: dim },
          },
        });
      }
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle network timeout errors', async () => {
      mockedAiEmbed.mockRejectedValue(new Error('Request timeout'));

      await expect(embed({ value: 'test' })).rejects.toThrow(
        'Embedding generation failed: Request timeout'
      );
    });

    it('should handle rate limit errors', async () => {
      mockedAiEmbed.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(embed({ value: 'test' })).rejects.toThrow(
        'Embedding generation failed: Rate limit exceeded'
      );
    });

    it('should handle invalid API key errors', async () => {
      mockedAiEmbed.mockRejectedValue(new Error('Invalid API key'));

      await expect(embed({ value: 'test' })).rejects.toThrow(
        'Embedding generation failed: Invalid API key'
      );
    });
  });
});

describe('Utility functions', () => {
  describe('calculateTextSimilarity', () => {
    it('should calculate similarity between two texts', async () => {
      const { cosineSimilarity } = await import('ai');
      jest.mocked(cosineSimilarity).mockReturnValue(0.85);

      const mockResult1: EmbedResult = {
        value: 'text 1',
        embedding: [0.1, 0.2, 0.3],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      const mockResult2: EmbedResult = {
        value: 'text 2',
        embedding: [0.2, 0.3, 0.4],
        usage: { tokens: 5 },
        response: undefined,
        providerMetadata: undefined,
      };

      mockedAiEmbed
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const similarity = await calculateTextSimilarity('text 1', 'text 2');

      expect(similarity).toBe(0.85);
      expect(cosineSimilarity).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        [0.2, 0.3, 0.4]
      );
    });
  });

  describe('findSimilar', () => {
    it('should find similar embeddings above threshold', () => {
      const { cosineSimilarity } = require('ai');
      jest
        .mocked(cosineSimilarity)
        .mockReturnValueOnce(0.9) // High similarity
        .mockReturnValueOnce(0.6) // Low similarity
        .mockReturnValueOnce(0.8); // High similarity

      const queryEmbedding = [0.1, 0.2, 0.3];
      const documentEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.5, 0.6, 0.7],
        [0.2, 0.3, 0.4],
      ];

      const results = findSimilar(queryEmbedding, documentEmbeddings, {
        threshold: 0.7,
        topK: 5,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ index: 0, similarity: 0.9 });
      expect(results[1]).toEqual({ index: 2, similarity: 0.8 });
    });
  });
});

describe('SemanticSearch', () => {
  let search: SemanticSearch;

  beforeEach(() => {
    search = new SemanticSearch({
      model: 'text-embedding-3-small',
      dimensions: 1536,
    });
  });

  it('should add and search documents', async () => {
    const mockResult: EmbedResult = {
      value: 'test document',
      embedding: [0.1, 0.2, 0.3],
      usage: { tokens: 5 },
      response: undefined,
      providerMetadata: undefined,
    };

    mockedAiEmbed.mockResolvedValue(mockResult);

    await search.addDocument('doc1', 'test document', { category: 'test' });

    expect(search.size).toBe(1);

    // Mock search
    const { cosineSimilarity } = require('ai');
    jest.mocked(cosineSimilarity).mockReturnValue(0.95);

    const searchResult = await search.search('test query');

    expect(searchResult).toHaveLength(1);
    expect(searchResult[0]).toEqual({
      id: 'doc1',
      index: 0,
      similarity: 0.95,
      text: 'test document',
      metadata: { category: 'test' },
    });
  });

  it('should support bulk document addition', async () => {
    const documents = [
      { id: 'doc1', text: 'document 1', metadata: { type: 'a' } },
      { id: 'doc2', text: 'document 2', metadata: { type: 'b' } },
    ];

    const mockResult: EmbedManyResult = {
      values: ['document 1', 'document 2'],
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      usage: { tokens: 10 },
      response: undefined,
      providerMetadata: undefined,
    };

    mockedAiEmbedMany.mockResolvedValue(mockResult);

    await search.addDocuments(documents);

    expect(search.size).toBe(2);
  });

  it('should support document removal', async () => {
    const mockResult: EmbedResult = {
      value: 'test document',
      embedding: [0.1, 0.2, 0.3],
      usage: { tokens: 5 },
      response: undefined,
      providerMetadata: undefined,
    };

    mockedAiEmbed.mockResolvedValue(mockResult);

    await search.addDocument('doc1', 'test document');
    expect(search.size).toBe(1);

    const removed = search.removeDocument('doc1');
    expect(removed).toBe(true);
    expect(search.size).toBe(0);

    const notRemoved = search.removeDocument('non-existent');
    expect(notRemoved).toBe(false);
  });

  it('should support export and import', async () => {
    const mockResult: EmbedResult = {
      value: 'test document',
      embedding: [0.1, 0.2, 0.3],
      usage: { tokens: 5 },
      response: undefined,
      providerMetadata: undefined,
    };

    mockedAiEmbed.mockResolvedValue(mockResult);

    await search.addDocument('doc1', 'test document', { category: 'test' });

    const exported = search.export();
    expect(exported).toHaveLength(1);
    expect(exported[0]).toEqual({
      id: 'doc1',
      embedding: [0.1, 0.2, 0.3],
      text: 'test document',
      metadata: { category: 'test' },
    });

    search.clear();
    expect(search.size).toBe(0);

    search.import(exported);
    expect(search.size).toBe(1);
  });
});
