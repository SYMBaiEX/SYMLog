import { openai } from '@ai-sdk/openai';
import {
  embed as aiEmbed,
  embedMany as aiEmbedMany,
  cosineSimilarity,
  type EmbeddingModelUsage,
} from 'ai';
import { LRUCache } from 'lru-cache';

// Constants for embedding configuration
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const LARGE_EMBEDDING_MODEL = 'text-embedding-3-large';
const MAX_BATCH_SIZE = 100;
const MAX_TEXT_LENGTH = 8191; // OpenAI's limit
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MIN_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_TOP_K = 10;
const DEFAULT_DIMENSIONS_SMALL = 1536;
const DEFAULT_DIMENSIONS_LARGE = 3072;
const MAX_DIMENSIONS = 3072;

// Embedding result interfaces
export interface EmbeddingResult {
  embedding: number[];
  text: string;
  model: string;
  dimensions: number;
}

export interface SimilarityResult {
  index: number;
  similarity: number;
  text?: string;
  metadata?: any;
}

export interface SearchResult extends SimilarityResult {
  id: string;
  timestamp?: Date;
}

// Embedding cache for performance optimization
const embeddingCache = new LRUCache<string, number[]>({
  max: CACHE_MAX_SIZE,
  ttl: CACHE_TTL,
});

/**
 * Generate embedding for a single text
 * @param text Text to embed
 * @param options Embedding options
 * @returns Promise resolving to embedding result
 */
export async function embedText(
  text: string,
  options: {
    model?: string;
    dimensions?: number;
    useCache?: boolean;
  } = {}
): Promise<EmbeddingResult> {
  const {
    model = DEFAULT_EMBEDDING_MODEL,
    dimensions,
    useCache = true,
  } = options;

  // Validate and sanitize input
  const sanitizedText = sanitizeTextForEmbedding(text);

  // Check cache first
  const cacheKey = `${model}:${dimensions || 'default'}:${hashText(sanitizedText)}`;
  if (useCache) {
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      return {
        embedding: cached,
        text: sanitizedText,
        model,
        dimensions: cached.length,
      };
    }
  }

  try {
    // Generate embedding using AI SDK v5
    const { embedding } = await embed({
      model,
      value: sanitizedText,
      providerOptions: dimensions
        ? {
            openai: { dimensions },
          }
        : undefined,
    });

    // Cache the result
    if (useCache) {
      embeddingCache.set(cacheKey, embedding);
    }

    return {
      embedding,
      text: sanitizedText,
      model,
      dimensions: embedding.length,
    };
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw new Error(
      `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings for multiple texts
 * @param texts Array of texts to embed
 * @param options Embedding options
 * @returns Promise resolving to array of embedding results
 */
export async function embedTexts(
  texts: string[],
  options: {
    model?: string;
    dimensions?: number;
    batchSize?: number;
    useCache?: boolean;
  } = {}
): Promise<EmbeddingResult[]> {
  const {
    model = DEFAULT_EMBEDDING_MODEL,
    dimensions,
    batchSize = MAX_BATCH_SIZE,
    useCache = true,
  } = options;

  if (!texts || texts.length === 0) {
    return [];
  }

  // Process in batches to avoid API limits
  const results: EmbeddingResult[] = [];
  const batches: Promise<EmbeddingResult[]>[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const sanitizedBatch = batch.map(sanitizeTextForEmbedding);

    // Check cache for each text in batch
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];
    const batchResults: (EmbeddingResult | null)[] = new Array(
      batch.length
    ).fill(null);

    if (useCache) {
      sanitizedBatch.forEach((text, index) => {
        const cacheKey = `${model}:${dimensions || 'default'}:${hashText(text)}`;
        const cached = embeddingCache.get(cacheKey);
        if (cached) {
          batchResults[index] = {
            embedding: cached,
            text,
            model,
            dimensions: cached.length,
          };
        } else {
          uncachedIndices.push(index);
          uncachedTexts.push(text);
        }
      });
    } else {
      uncachedIndices.push(
        ...Array.from({ length: batch.length }, (_, i) => i)
      );
      uncachedTexts.push(...sanitizedBatch);
    }

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      try {
        const { embeddings } = await embedMany({
          model,
          values: uncachedTexts,
          providerOptions: dimensions
            ? {
                openai: { dimensions },
              }
            : undefined,
        });

        // Fill in the results and update cache
        embeddings.forEach((embedding, embIndex) => {
          const originalIndex = uncachedIndices[embIndex];
          const text = uncachedTexts[embIndex];

          batchResults[originalIndex] = {
            embedding,
            text,
            model,
            dimensions: embedding.length,
          };

          if (useCache) {
            const cacheKey = `${model}:${dimensions || 'default'}:${hashText(text)}`;
            embeddingCache.set(cacheKey, embedding);
          }
        });
      } catch (error) {
        console.error('Failed to generate embeddings for batch:', error);
        throw new Error(
          `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Add batch results to promise array for parallel processing
    batches.push(
      Promise.resolve(
        batchResults.filter((r): r is EmbeddingResult => r !== null)
      )
    );
  }

  // Process all batches in parallel
  const allResults = await Promise.all(batches);
  return allResults.flat();
}

/**
 * Find similar items based on embeddings
 * @param queryEmbedding Query embedding to compare against
 * @param documentEmbeddings Array of document embeddings
 * @param options Search options
 * @returns Array of similarity results sorted by score
 */
export function findSimilar(
  queryEmbedding: number[],
  documentEmbeddings: number[][],
  options: {
    topK?: number;
    threshold?: number;
    metadata?: any[];
  } = {}
): SimilarityResult[] {
  const {
    topK = DEFAULT_TOP_K,
    threshold = MIN_SIMILARITY_THRESHOLD,
    metadata = [],
  } = options;

  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new Error('Query embedding cannot be empty');
  }

  if (!documentEmbeddings || documentEmbeddings.length === 0) {
    return [];
  }

  // Calculate similarities
  const similarities = documentEmbeddings.map((docEmbedding, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, docEmbedding),
    ...(metadata[index] && { metadata: metadata[index] }),
  }));

  // Filter by threshold and sort by similarity
  return similarities
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Semantic search service for managing embeddings and search
 */
export class SemanticSearch {
  private embeddings = new Map<
    string,
    { embedding: number[]; text: string; metadata?: any }
  >();
  private model: string;
  private dimensions?: number;

  constructor(options: { model?: string; dimensions?: number } = {}) {
    this.model = options.model || DEFAULT_EMBEDDING_MODEL;
    this.dimensions = options.dimensions;
  }

  /**
   * Add a document to the search index
   * @param id Unique identifier for the document
   * @param text Text content of the document
   * @param metadata Optional metadata
   */
  async addDocument(id: string, text: string, metadata?: any): Promise<void> {
    const result = await embedText(text, {
      model: this.model,
      dimensions: this.dimensions,
    });

    this.embeddings.set(id, {
      embedding: result.embedding,
      text: result.text,
      metadata,
    });
  }

  /**
   * Add multiple documents to the search index
   * @param documents Array of documents to add
   */
  async addDocuments(
    documents: Array<{ id: string; text: string; metadata?: any }>
  ): Promise<void> {
    const texts = documents.map((doc) => doc.text);
    const results = await embedTexts(texts, {
      model: this.model,
      dimensions: this.dimensions,
    });

    results.forEach((result, index) => {
      const doc = documents[index];
      this.embeddings.set(doc.id, {
        embedding: result.embedding,
        text: result.text,
        metadata: doc.metadata,
      });
    });
  }

  /**
   * Search for similar documents
   * @param query Query text to search for
   * @param options Search options
   * @returns Array of search results
   */
  async search(
    query: string,
    options: {
      topK?: number;
      threshold?: number;
      filter?: (metadata: any) => boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      topK = DEFAULT_TOP_K,
      threshold = MIN_SIMILARITY_THRESHOLD,
      filter,
    } = options;

    // Generate query embedding
    const queryResult = await embedText(query, {
      model: this.model,
      dimensions: this.dimensions,
    });

    // Get all embeddings and metadata
    const ids: string[] = [];
    const embeddings: number[][] = [];
    const texts: string[] = [];
    const metadataArray: any[] = [];

    for (const [id, data] of this.embeddings.entries()) {
      if (!filter || filter(data.metadata)) {
        ids.push(id);
        embeddings.push(data.embedding);
        texts.push(data.text);
        metadataArray.push(data.metadata);
      }
    }

    // Find similar documents
    const similarities = findSimilar(queryResult.embedding, embeddings, {
      topK,
      threshold,
      metadata: metadataArray,
    });

    // Map to search results
    return similarities.map((result) => ({
      id: ids[result.index],
      index: result.index,
      similarity: result.similarity,
      text: texts[result.index],
      metadata: result.metadata,
    }));
  }

  /**
   * Remove a document from the search index
   * @param id Document ID to remove
   */
  removeDocument(id: string): boolean {
    return this.embeddings.delete(id);
  }

  /**
   * Clear all documents from the search index
   */
  clear(): void {
    this.embeddings.clear();
  }

  /**
   * Get the number of documents in the index
   */
  get size(): number {
    return this.embeddings.size;
  }

  /**
   * Export embeddings for persistence
   */
  export(): Array<{
    id: string;
    embedding: number[];
    text: string;
    metadata?: any;
  }> {
    return Array.from(this.embeddings.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));
  }

  /**
   * Import embeddings from persistence
   */
  import(
    data: Array<{
      id: string;
      embedding: number[];
      text: string;
      metadata?: any;
    }>
  ): void {
    this.clear();
    data.forEach((item) => {
      this.embeddings.set(item.id, {
        embedding: item.embedding,
        text: item.text,
        metadata: item.metadata,
      });
    });
  }
}

/**
 * Sanitize text for embedding generation
 * @param text Input text
 * @returns Sanitized text
 */
function sanitizeTextForEmbedding(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  // Remove excessive whitespace and special characters
  let sanitized = text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .trim();

  // Truncate if too long
  if (sanitized.length > MAX_TEXT_LENGTH) {
    console.warn(
      `Text truncated from ${sanitized.length} to ${MAX_TEXT_LENGTH} characters`
    );
    sanitized = sanitized.substring(0, MAX_TEXT_LENGTH);
  }

  return sanitized;
}

/**
 * Calculate semantic similarity between two texts
 * @param text1 First text
 * @param text2 Second text
 * @param options Comparison options
 * @returns Similarity score between 0 and 1
 */
export async function calculateTextSimilarity(
  text1: string,
  text2: string,
  options: {
    model?: string;
    dimensions?: number;
  } = {}
): Promise<number> {
  const [result1, result2] = await Promise.all([
    embedText(text1, options),
    embedText(text2, options),
  ]);

  return cosineSimilarity(result1.embedding, result2.embedding);
}

/**
 * Cluster texts based on semantic similarity
 * @param texts Array of texts to cluster
 * @param options Clustering options
 * @returns Array of clusters
 */
export async function clusterTexts(
  texts: string[],
  options: {
    threshold?: number;
    model?: string;
    dimensions?: number;
  } = {}
): Promise<Array<{ texts: string[]; indices: number[] }>> {
  const { threshold = 0.8 } = options;

  // Generate embeddings for all texts
  const embeddings = await embedTexts(texts, options);

  // Simple clustering algorithm
  const clusters: Array<{
    texts: string[];
    indices: number[];
    centroid: number[];
  }> = [];
  const assigned = new Set<number>();

  for (let i = 0; i < embeddings.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = {
      texts: [texts[i]],
      indices: [i],
      centroid: embeddings[i].embedding,
    };

    // Find similar texts
    for (let j = i + 1; j < embeddings.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = cosineSimilarity(
        cluster.centroid,
        embeddings[j].embedding
      );
      if (similarity >= threshold) {
        cluster.texts.push(texts[j]);
        cluster.indices.push(j);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
    assigned.add(i);
  }

  return clusters.map(({ texts, indices }) => ({ texts, indices }));
}

/**
 * Fast non-cryptographic hash function using FNV-1a algorithm for cache keys
 */
function hashText(text: string): string {
  const FNV_OFFSET_BASIS = 2_166_136_261;
  const FNV_PRIME = 16_777_619;

  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to positive 32-bit integer and then to base36
  return (hash >>> 0).toString(36);
}

// Export singleton instance for convenience
export const semanticSearch = new SemanticSearch();

// Core AI SDK v5 embed function implementation
export interface EmbedOptions {
  model?: string;
  value: string;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
  experimental_telemetry?: {
    isEnabled?: boolean;
    recordInputs?: boolean;
    recordOutputs?: boolean;
    functionId?: string;
    metadata?: Record<string, any>;
  };
  providerOptions?: {
    openai?: {
      dimensions?: number;
      user?: string;
    };
  };
}

export interface EmbedResult {
  value: string;
  embedding: number[];
  usage: EmbeddingModelUsage;
  response?: Response;
  providerMetadata?: Record<string, any>;
}

/**
 * Generate an embedding for a single value using the AI SDK v5 API
 * Fully compatible with text-embedding-3-large and text-embedding-3-small
 * @param options Embedding options
 * @returns Promise resolving to embedding result
 */
export async function embed(options: EmbedOptions): Promise<EmbedResult> {
  const {
    model = DEFAULT_EMBEDDING_MODEL,
    value,
    maxRetries = 2,
    abortSignal,
    headers,
    experimental_telemetry,
    providerOptions,
  } = options;

  // Validate input
  if (!value || typeof value !== 'string') {
    throw new Error('Value must be a non-empty string');
  }

  // Sanitize text
  const sanitizedValue = sanitizeTextForEmbedding(value);

  try {
    // Call the AI SDK embed function
    const result = await aiEmbed({
      model: openai.textEmbeddingModel(model),
      value: sanitizedValue,
      maxRetries,
      abortSignal,
      headers,
      experimental_telemetry,
      ...(providerOptions && { providerOptions }),
    });

    return result as EmbedResult;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw new Error(
      `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Core AI SDK v5 embedMany function implementation
export interface EmbedManyOptions {
  model?: string;
  values: string[];
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
  experimental_telemetry?: {
    isEnabled?: boolean;
    recordInputs?: boolean;
    recordOutputs?: boolean;
    functionId?: string;
    metadata?: Record<string, any>;
  };
  providerOptions?: {
    openai?: {
      dimensions?: number;
      user?: string;
    };
  };
}

export interface EmbedManyResult {
  values: string[];
  embeddings: number[][];
  usage: EmbeddingModelUsage;
  response?: Response;
  providerMetadata?: Record<string, any>;
}

/**
 * Generate embeddings for multiple values using the AI SDK v5 API
 * Supports batch processing with text-embedding-3-large and text-embedding-3-small
 * @param options Embedding options
 * @returns Promise resolving to embeddings result
 */
export async function embedMany(
  options: EmbedManyOptions
): Promise<EmbedManyResult> {
  const {
    model = DEFAULT_EMBEDDING_MODEL,
    values,
    maxRetries = 2,
    abortSignal,
    headers,
    experimental_telemetry,
    providerOptions,
  } = options;

  // Validate input
  if (!(values && Array.isArray(values)) || values.length === 0) {
    throw new Error('Values must be a non-empty array of strings');
  }

  // Sanitize all texts
  const sanitizedValues = values.map(sanitizeTextForEmbedding);

  // Process in batches if needed
  if (sanitizedValues.length > MAX_BATCH_SIZE) {
    // Split into batches and process in parallel
    const batches: string[][] = [];
    for (let i = 0; i < sanitizedValues.length; i += MAX_BATCH_SIZE) {
      batches.push(sanitizedValues.slice(i, i + MAX_BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map((batch) =>
        aiEmbedMany({
          model: openai.textEmbeddingModel(model),
          values: batch,
          maxRetries,
          abortSignal,
          headers,
          experimental_telemetry,
          ...(providerOptions && { providerOptions }),
        })
      )
    );

    // Combine results
    const allEmbeddings = batchResults.flatMap((result) => result.embeddings);
    const totalUsage: EmbeddingModelUsage = {
      tokens: batchResults.reduce(
        (sum, result) => sum + result.usage.tokens,
        0
      ),
    };

    return {
      values: sanitizedValues,
      embeddings: allEmbeddings,
      usage: totalUsage,
      response: undefined, // Batch results don't have individual response objects
      providerMetadata: batchResults[batchResults.length - 1].providerMetadata,
    };
  }

  try {
    // Call the AI SDK embedMany function
    const result = await aiEmbedMany({
      model: openai.textEmbeddingModel(model),
      values: sanitizedValues,
      maxRetries,
      abortSignal,
      headers,
      experimental_telemetry,
      ...(providerOptions && { providerOptions }),
    });

    return result;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw new Error(
      `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Additional utility functions leveraging the core embed functionality

/**
 * Create embeddings for RAG (Retrieval Augmented Generation) use cases
 * Optimized for document chunking and similarity search
 * @param documents Array of documents to embed
 * @param options RAG-specific options
 * @returns Array of embedded document chunks
 */
export async function createRAGEmbeddings(
  documents: Array<{
    id: string;
    content: string;
    metadata?: Record<string, any>;
  }>,
  options: {
    model?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    dimensions?: number;
  } = {}
): Promise<
  Array<{
    id: string;
    chunkId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }>
> {
  const {
    model = LARGE_EMBEDDING_MODEL, // Use large model for better RAG performance
    chunkSize = 1000,
    chunkOverlap = 200,
    dimensions = DEFAULT_DIMENSIONS_LARGE,
  } = options;

  const chunks: Array<{
    id: string;
    chunkId: string;
    content: string;
    metadata?: Record<string, any>;
  }> = [];

  // Chunk documents
  for (const doc of documents) {
    const docChunks = chunkText(doc.content, chunkSize, chunkOverlap);
    docChunks.forEach((chunk, index) => {
      chunks.push({
        id: doc.id,
        chunkId: `${doc.id}_chunk_${index}`,
        content: chunk,
        metadata: doc.metadata,
      });
    });
  }

  // Generate embeddings for all chunks
  const texts = chunks.map((chunk) => chunk.content);
  const embedResult = await embedMany({
    model,
    values: texts,
    providerOptions: dimensions
      ? {
          openai: { dimensions },
        }
      : undefined,
  });

  // Combine chunks with embeddings
  return chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embedResult.embeddings[index],
  }));
}

/**
 * Chunk text into overlapping segments for better context preservation
 * @param text Text to chunk
 * @param chunkSize Maximum size of each chunk in characters
 * @param overlap Number of characters to overlap between chunks
 * @returns Array of text chunks
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at word boundaries
    if (end < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(' ');
      if (lastSpaceIndex > chunkSize * 0.8) {
        // Only break if we're not losing too much content
        chunk = chunk.slice(0, lastSpaceIndex);
      }
    }

    chunks.push(chunk.trim());

    // Move start position, accounting for overlap
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Perform semantic similarity search across embedded documents
 * Optimized for RAG retrieval with relevance scoring
 * @param query Search query
 * @param embeddedDocs Array of embedded documents
 * @param options Search options
 * @returns Ranked search results
 */
export async function semanticRetrieve(
  query: string,
  embeddedDocs: Array<{
    id: string;
    chunkId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
  }>,
  options: {
    model?: string;
    topK?: number;
    threshold?: number;
    diversityWeight?: number;
    rerankResults?: boolean;
  } = {}
): Promise<
  Array<{
    id: string;
    chunkId: string;
    content: string;
    similarity: number;
    metadata?: Record<string, any>;
  }>
> {
  const {
    model = LARGE_EMBEDDING_MODEL,
    topK = 10,
    threshold = 0.6,
    diversityWeight = 0.1,
    rerankResults = true,
  } = options;

  // Generate query embedding
  const queryResult = await embed({
    model,
    value: query,
  });

  // Calculate similarities
  const similarities = embeddedDocs.map((doc) => ({
    ...doc,
    similarity: cosineSimilarity(queryResult.embedding, doc.embedding),
  }));

  // Filter by threshold and sort by similarity
  let results = similarities
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  // Apply diversity if requested
  if (diversityWeight > 0 && results.length > 1) {
    results = applyDiversityReranking(results, diversityWeight);
  }

  // Take top K results
  results = results.slice(0, topK);

  // Remove embedding from results
  return results.map(({ embedding, ...rest }) => rest);
}

/**
 * Apply diversity reranking to avoid redundant results
 * @param results Sorted results by similarity
 * @param diversityWeight Weight for diversity (0-1)
 * @returns Reranked results
 */
function applyDiversityReranking<
  T extends { similarity: number; embedding: number[] },
>(results: T[], diversityWeight: number): T[] {
  if (results.length <= 1) return results;

  const reranked: T[] = [results[0]]; // Always include top result
  const remaining = results.slice(1);

  while (reranked.length < results.length && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Calculate average similarity to already selected results
      const avgSimilarity =
        reranked.reduce(
          (sum, selected) =>
            sum + cosineSimilarity(candidate.embedding, selected.embedding),
          0
        ) / reranked.length;

      // Combine original similarity with diversity penalty
      const diversityScore =
        candidate.similarity - diversityWeight * avgSimilarity;

      if (diversityScore > bestScore) {
        bestScore = diversityScore;
        bestIndex = i;
      }
    }

    reranked.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return reranked;
}

/**
 * Create a vector database interface for embeddings
 * Provides CRUD operations for embedded documents
 */
export class VectorDatabase {
  private documents = new Map<
    string,
    {
      id: string;
      content: string;
      embedding: number[];
      metadata?: Record<string, any>;
      timestamp: Date;
    }
  >();

  private model: string;
  private dimensions?: number;

  constructor(options: { model?: string; dimensions?: number } = {}) {
    this.model = options.model || LARGE_EMBEDDING_MODEL;
    this.dimensions = options.dimensions;
  }

  /**
   * Insert a document into the vector database
   * @param document Document to insert
   */
  async insert(document: {
    id: string;
    content: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const result = await embed({
      model: this.model,
      value: document.content,
      providerOptions: this.dimensions
        ? {
            openai: { dimensions: this.dimensions },
          }
        : undefined,
    });

    this.documents.set(document.id, {
      id: document.id,
      content: document.content,
      embedding: result.embedding,
      metadata: document.metadata,
      timestamp: new Date(),
    });
  }

  /**
   * Insert multiple documents efficiently
   * @param documents Array of documents to insert
   */
  async insertBatch(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    const texts = documents.map((doc) => doc.content);
    const result = await embedMany({
      model: this.model,
      values: texts,
      providerOptions: this.dimensions
        ? {
            openai: { dimensions: this.dimensions },
          }
        : undefined,
    });

    documents.forEach((doc, index) => {
      this.documents.set(doc.id, {
        id: doc.id,
        content: doc.content,
        embedding: result.embeddings[index],
        metadata: doc.metadata,
        timestamp: new Date(),
      });
    });
  }

  /**
   * Query the vector database
   * @param query Search query
   * @param options Query options
   */
  async query(
    query: string,
    options: {
      topK?: number;
      threshold?: number;
      filter?: (metadata: any) => boolean;
      includeEmbeddings?: boolean;
    } = {}
  ): Promise<
    Array<{
      id: string;
      content: string;
      similarity: number;
      metadata?: Record<string, any>;
      embedding?: number[];
      timestamp: Date;
    }>
  > {
    const {
      topK = 10,
      threshold = 0.5,
      filter,
      includeEmbeddings = false,
    } = options;

    // Generate query embedding
    const queryResult = await embed({
      model: this.model,
      value: query,
      providerOptions: this.dimensions
        ? {
            openai: { dimensions: this.dimensions },
          }
        : undefined,
    });

    // Calculate similarities and filter
    const results: Array<{
      id: string;
      content: string;
      similarity: number;
      metadata?: Record<string, any>;
      embedding?: number[];
      timestamp: Date;
    }> = [];

    for (const [id, doc] of this.documents.entries()) {
      // Apply metadata filter if provided
      if (filter && !filter(doc.metadata)) {
        continue;
      }

      const similarity = cosineSimilarity(queryResult.embedding, doc.embedding);

      if (similarity >= threshold) {
        results.push({
          id: doc.id,
          content: doc.content,
          similarity,
          metadata: doc.metadata,
          ...(includeEmbeddings && { embedding: doc.embedding }),
          timestamp: doc.timestamp,
        });
      }
    }

    // Sort by similarity and take top K
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Update a document in the database
   * @param id Document ID
   * @param updates Updates to apply
   */
  async update(
    id: string,
    updates: {
      content?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    const existing = this.documents.get(id);
    if (!existing) {
      return false;
    }

    let newEmbedding = existing.embedding;

    // Regenerate embedding if content changed
    if (updates.content && updates.content !== existing.content) {
      const result = await embed({
        model: this.model,
        value: updates.content,
        providerOptions: this.dimensions
          ? {
              openai: { dimensions: this.dimensions },
            }
          : undefined,
      });
      newEmbedding = result.embedding;
    }

    this.documents.set(id, {
      ...existing,
      content: updates.content ?? existing.content,
      metadata: { ...existing.metadata, ...updates.metadata },
      embedding: newEmbedding,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Delete a document from the database
   * @param id Document ID
   */
  delete(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalDocuments: number;
    totalEmbeddings: number;
    avgEmbeddingDimensions: number;
    oldestDocument: Date | null;
    newestDocument: Date | null;
  } {
    const docs = Array.from(this.documents.values());

    return {
      totalDocuments: docs.length,
      totalEmbeddings: docs.length,
      avgEmbeddingDimensions: docs.length > 0 ? docs[0].embedding.length : 0,
      oldestDocument:
        docs.length > 0
          ? new Date(Math.min(...docs.map((d) => d.timestamp.getTime())))
          : null,
      newestDocument:
        docs.length > 0
          ? new Date(Math.max(...docs.map((d) => d.timestamp.getTime())))
          : null,
    };
  }

  /**
   * Export the database
   */
  export(): Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
    timestamp: string;
  }> {
    return Array.from(this.documents.values()).map((doc) => ({
      ...doc,
      timestamp: doc.timestamp.toISOString(),
    }));
  }

  /**
   * Import data into the database
   */
  import(
    data: Array<{
      id: string;
      content: string;
      embedding: number[];
      metadata?: Record<string, any>;
      timestamp: string;
    }>
  ): void {
    this.documents.clear();
    data.forEach((item) => {
      this.documents.set(item.id, {
        ...item,
        timestamp: new Date(item.timestamp),
      });
    });
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents.clear();
  }

  /**
   * Get the number of documents
   */
  get size(): number {
    return this.documents.size;
  }
}
