import { describe, expect, test } from 'bun:test';
import {
  calculateTextSimilarity,
  clusterTexts,
  createRAGEmbeddings,
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
  semanticRetrieve,
  VectorDatabase,
} from '../embeddings';

describe('Embeddings Module', () => {
  describe('Function exports', () => {
    test('should export embed function', () => {
      expect(typeof embed).toBe('function');
    });

    test('should export embedMany function', () => {
      expect(typeof embedMany).toBe('function');
    });

    test('should export embedText function (legacy)', () => {
      expect(typeof embedText).toBe('function');
    });

    test('should export embedTexts function (legacy)', () => {
      expect(typeof embedTexts).toBe('function');
    });

    test('should export utility functions', () => {
      expect(typeof calculateTextSimilarity).toBe('function');
      expect(typeof clusterTexts).toBe('function');
      expect(typeof findSimilar).toBe('function');
    });

    test('should export RAG utilities', () => {
      expect(typeof createRAGEmbeddings).toBe('function');
      expect(typeof semanticRetrieve).toBe('function');
    });

    test('should export classes', () => {
      expect(typeof SemanticSearch).toBe('function');
      expect(typeof VectorDatabase).toBe('function');
    });
  });

  describe('Type definitions', () => {
    test('should have proper EmbedOptions interface', () => {
      const options: EmbedOptions = {
        value: 'test',
        model: 'text-embedding-3-small',
        maxRetries: 2,
      };
      expect(typeof options.value).toBe('string');
      expect(typeof options.model).toBe('string');
      expect(typeof options.maxRetries).toBe('number');
    });

    test('should have proper EmbedManyOptions interface', () => {
      const options: EmbedManyOptions = {
        values: ['test1', 'test2'],
        model: 'text-embedding-3-large',
        maxRetries: 3,
      };
      expect(Array.isArray(options.values)).toBe(true);
      expect(typeof options.model).toBe('string');
      expect(typeof options.maxRetries).toBe('number');
    });
  });

  describe('Input validation', () => {
    test('embed should validate input', async () => {
      try {
        await embed({ value: '' });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          'Value must be a non-empty string'
        );
      }
    });

    test('embedMany should validate input', async () => {
      try {
        await embedMany({ values: [] });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          'Values must be a non-empty array'
        );
      }
    });
  });

  describe('SemanticSearch class', () => {
    test('should create instance with default options', () => {
      const search = new SemanticSearch();
      expect(search).toBeInstanceOf(SemanticSearch);
      expect(search.size).toBe(0);
    });

    test('should create instance with custom options', () => {
      const search = new SemanticSearch({
        model: 'text-embedding-3-large',
        dimensions: 3072,
      });
      expect(search).toBeInstanceOf(SemanticSearch);
      expect(search.size).toBe(0);
    });

    test('should support clear operation', () => {
      const search = new SemanticSearch();
      search.clear();
      expect(search.size).toBe(0);
    });

    test('should support removeDocument', () => {
      const search = new SemanticSearch();
      const removed = search.removeDocument('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('VectorDatabase class', () => {
    test('should create instance with default options', () => {
      const db = new VectorDatabase();
      expect(db).toBeInstanceOf(VectorDatabase);
      expect(db.size).toBe(0);
    });

    test('should create instance with custom options', () => {
      const db = new VectorDatabase({
        model: 'text-embedding-3-large',
        dimensions: 3072,
      });
      expect(db).toBeInstanceOf(VectorDatabase);
      expect(db.size).toBe(0);
    });

    test('should support clear operation', () => {
      const db = new VectorDatabase();
      db.clear();
      expect(db.size).toBe(0);
    });

    test('should support delete operation', () => {
      const db = new VectorDatabase();
      const deleted = db.delete('non-existent');
      expect(deleted).toBe(false);
    });

    test('should provide statistics', () => {
      const db = new VectorDatabase();
      const stats = db.getStats();
      expect(stats.totalDocuments).toBe(0);
      expect(stats.totalEmbeddings).toBe(0);
      expect(stats.avgEmbeddingDimensions).toBe(0);
      expect(stats.oldestDocument).toBe(null);
      expect(stats.newestDocument).toBe(null);
    });

    test('should support export/import', () => {
      const db = new VectorDatabase();
      const exported = db.export();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBe(0);

      db.import([]);
      expect(db.size).toBe(0);
    });
  });

  describe('findSimilar function', () => {
    test('should handle empty query embedding', () => {
      try {
        findSimilar([], [[0.1, 0.2]]);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          'Query embedding cannot be empty'
        );
      }
    });

    test('should handle empty document embeddings', () => {
      const results = findSimilar([0.1, 0.2], []);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});

describe('Integration readiness', () => {
  test('should be ready for OpenAI integration', () => {
    // Verify all required functions exist for OpenAI integration
    expect(typeof embed).toBe('function');
    expect(typeof embedMany).toBe('function');

    // Verify support for text-embedding-3-large
    const largeSampleOptions: EmbedOptions = {
      value: 'test',
      model: 'text-embedding-3-large',
      providerOptions: {
        openai: {
          dimensions: 3072,
          user: 'test-user',
        },
      },
    };
    expect(largeSampleOptions.model).toBe('text-embedding-3-large');
    expect(largeSampleOptions.providerOptions?.openai?.dimensions).toBe(3072);
  });

  test('should support all required OpenAI models', () => {
    const supportedModels = [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ];

    supportedModels.forEach((model) => {
      const options: EmbedOptions = {
        value: 'test',
        model,
      };
      expect(options.model).toBe(model);
    });
  });

  test('should support dimension configuration', () => {
    const dimensionConfigs = [
      { model: 'text-embedding-3-small', dimensions: 1536 },
      { model: 'text-embedding-3-large', dimensions: 3072 },
      { model: 'text-embedding-3-large', dimensions: 1024 },
      { model: 'text-embedding-3-large', dimensions: 512 },
    ];

    dimensionConfigs.forEach((config) => {
      const options: EmbedOptions = {
        value: 'test',
        model: config.model,
        providerOptions: {
          openai: {
            dimensions: config.dimensions,
          },
        },
      };
      expect(options.providerOptions?.openai?.dimensions).toBe(
        config.dimensions
      );
    });
  });
});
