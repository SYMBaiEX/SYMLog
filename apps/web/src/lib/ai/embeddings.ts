import { embed, embedMany, cosineSimilarity } from 'ai'
import { openai } from '@ai-sdk/openai'
import { LRUCache } from 'lru-cache'

// Constants for embedding configuration
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const LARGE_EMBEDDING_MODEL = 'text-embedding-3-large'
const MAX_BATCH_SIZE = 100
const MAX_TEXT_LENGTH = 8191 // OpenAI's limit
const CACHE_MAX_SIZE = 1000
const CACHE_TTL = 1000 * 60 * 60 // 1 hour
const MIN_SIMILARITY_THRESHOLD = 0.7
const DEFAULT_TOP_K = 10

// Embedding result interfaces
export interface EmbeddingResult {
  embedding: number[]
  text: string
  model: string
  dimensions: number
}

export interface SimilarityResult {
  index: number
  similarity: number
  text?: string
  metadata?: any
}

export interface SearchResult extends SimilarityResult {
  id: string
  timestamp?: Date
}

// Embedding cache for performance optimization
const embeddingCache = new LRUCache<string, number[]>({
  max: CACHE_MAX_SIZE,
  ttl: CACHE_TTL,
})

/**
 * Generate embedding for a single text
 * @param text Text to embed
 * @param options Embedding options
 * @returns Promise resolving to embedding result
 */
export async function embedText(
  text: string,
  options: {
    model?: string
    dimensions?: number
    useCache?: boolean
  } = {}
): Promise<EmbeddingResult> {
  const { 
    model = DEFAULT_EMBEDDING_MODEL, 
    dimensions,
    useCache = true 
  } = options

  // Validate and sanitize input
  const sanitizedText = sanitizeTextForEmbedding(text)
  
  // Check cache first
  const cacheKey = `${model}:${dimensions || 'default'}:${hashText(sanitizedText)}`
  if (useCache) {
    const cached = embeddingCache.get(cacheKey)
    if (cached) {
      return {
        embedding: cached,
        text: sanitizedText,
        model,
        dimensions: cached.length
      }
    }
  }

  try {
    // Generate embedding using AI SDK
    const { embedding } = await embed({
      model: openai.embedding(model),
      value: sanitizedText,
      ...(dimensions && { dimensions })
    })

    // Cache the result
    if (useCache) {
      embeddingCache.set(cacheKey, embedding)
    }

    return {
      embedding,
      text: sanitizedText,
      model,
      dimensions: embedding.length
    }
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    model?: string
    dimensions?: number
    batchSize?: number
    useCache?: boolean
  } = {}
): Promise<EmbeddingResult[]> {
  const { 
    model = DEFAULT_EMBEDDING_MODEL, 
    dimensions,
    batchSize = MAX_BATCH_SIZE,
    useCache = true 
  } = options

  if (!texts || texts.length === 0) {
    return []
  }

  // Process in batches to avoid API limits
  const results: EmbeddingResult[] = []
  const batches: Promise<EmbeddingResult[]>[] = []
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const sanitizedBatch = batch.map(sanitizeTextForEmbedding)
    
    // Check cache for each text in batch
    const uncachedIndices: number[] = []
    const uncachedTexts: string[] = []
    const batchResults: (EmbeddingResult | null)[] = new Array(batch.length).fill(null)
    
    if (useCache) {
      sanitizedBatch.forEach((text, index) => {
        const cacheKey = `${model}:${dimensions || 'default'}:${hashText(text)}`
        const cached = embeddingCache.get(cacheKey)
        if (cached) {
          batchResults[index] = {
            embedding: cached,
            text,
            model,
            dimensions: cached.length
          }
        } else {
          uncachedIndices.push(index)
          uncachedTexts.push(text)
        }
      })
    } else {
      uncachedIndices.push(...Array.from({ length: batch.length }, (_, i) => i))
      uncachedTexts.push(...sanitizedBatch)
    }
    
    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      try {
        const { embeddings } = await embedMany({
          model: openai.embedding(model),
          values: uncachedTexts,
          ...(dimensions && { dimensions })
        })
        
        // Fill in the results and update cache
        embeddings.forEach((embedding, embIndex) => {
          const originalIndex = uncachedIndices[embIndex]
          const text = uncachedTexts[embIndex]
          
          batchResults[originalIndex] = {
            embedding,
            text,
            model,
            dimensions: embedding.length
          }
          
          if (useCache) {
            const cacheKey = `${model}:${dimensions || 'default'}:${hashText(text)}`
            embeddingCache.set(cacheKey, embedding)
          }
        })
      } catch (error) {
        console.error('Failed to generate embeddings for batch:', error)
        throw new Error(`Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Add batch results to promise array for parallel processing
    batches.push(Promise.resolve(batchResults.filter((r): r is EmbeddingResult => r !== null)))
  }
  
  // Process all batches in parallel
  const allResults = await Promise.all(batches)
  return allResults.flat()
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
    topK?: number
    threshold?: number
    metadata?: any[]
  } = {}
): SimilarityResult[] {
  const { 
    topK = DEFAULT_TOP_K, 
    threshold = MIN_SIMILARITY_THRESHOLD,
    metadata = []
  } = options

  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new Error('Query embedding cannot be empty')
  }

  if (!documentEmbeddings || documentEmbeddings.length === 0) {
    return []
  }

  // Calculate similarities
  const similarities = documentEmbeddings.map((docEmbedding, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, docEmbedding),
    ...(metadata[index] && { metadata: metadata[index] })
  }))

  // Filter by threshold and sort by similarity
  return similarities
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}

/**
 * Semantic search service for managing embeddings and search
 */
export class SemanticSearch {
  private embeddings = new Map<string, { embedding: number[], text: string, metadata?: any }>()
  private model: string
  private dimensions?: number

  constructor(options: { model?: string; dimensions?: number } = {}) {
    this.model = options.model || DEFAULT_EMBEDDING_MODEL
    this.dimensions = options.dimensions
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
      dimensions: this.dimensions 
    })
    
    this.embeddings.set(id, {
      embedding: result.embedding,
      text: result.text,
      metadata
    })
  }

  /**
   * Add multiple documents to the search index
   * @param documents Array of documents to add
   */
  async addDocuments(
    documents: Array<{ id: string; text: string; metadata?: any }>
  ): Promise<void> {
    const texts = documents.map(doc => doc.text)
    const results = await embedTexts(texts, {
      model: this.model,
      dimensions: this.dimensions
    })
    
    results.forEach((result, index) => {
      const doc = documents[index]
      this.embeddings.set(doc.id, {
        embedding: result.embedding,
        text: result.text,
        metadata: doc.metadata
      })
    })
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
      topK?: number
      threshold?: number
      filter?: (metadata: any) => boolean
    } = {}
  ): Promise<SearchResult[]> {
    const { topK = DEFAULT_TOP_K, threshold = MIN_SIMILARITY_THRESHOLD, filter } = options

    // Generate query embedding
    const queryResult = await embedText(query, {
      model: this.model,
      dimensions: this.dimensions
    })

    // Get all embeddings and metadata
    const ids: string[] = []
    const embeddings: number[][] = []
    const texts: string[] = []
    const metadataArray: any[] = []
    
    for (const [id, data] of this.embeddings.entries()) {
      if (!filter || filter(data.metadata)) {
        ids.push(id)
        embeddings.push(data.embedding)
        texts.push(data.text)
        metadataArray.push(data.metadata)
      }
    }

    // Find similar documents
    const similarities = findSimilar(queryResult.embedding, embeddings, {
      topK,
      threshold,
      metadata: metadataArray
    })

    // Map to search results
    return similarities.map(result => ({
      id: ids[result.index],
      index: result.index,
      similarity: result.similarity,
      text: texts[result.index],
      metadata: result.metadata
    }))
  }

  /**
   * Remove a document from the search index
   * @param id Document ID to remove
   */
  removeDocument(id: string): boolean {
    return this.embeddings.delete(id)
  }

  /**
   * Clear all documents from the search index
   */
  clear(): void {
    this.embeddings.clear()
  }

  /**
   * Get the number of documents in the index
   */
  get size(): number {
    return this.embeddings.size
  }

  /**
   * Export embeddings for persistence
   */
  export(): Array<{ id: string; embedding: number[]; text: string; metadata?: any }> {
    return Array.from(this.embeddings.entries()).map(([id, data]) => ({
      id,
      ...data
    }))
  }

  /**
   * Import embeddings from persistence
   */
  import(data: Array<{ id: string; embedding: number[]; text: string; metadata?: any }>): void {
    this.clear()
    data.forEach(item => {
      this.embeddings.set(item.id, {
        embedding: item.embedding,
        text: item.text,
        metadata: item.metadata
      })
    })
  }
}

/**
 * Sanitize text for embedding generation
 * @param text Input text
 * @returns Sanitized text
 */
function sanitizeTextForEmbedding(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string')
  }
  
  // Remove excessive whitespace and special characters
  let sanitized = text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .trim()
  
  // Truncate if too long
  if (sanitized.length > MAX_TEXT_LENGTH) {
    console.warn(`Text truncated from ${sanitized.length} to ${MAX_TEXT_LENGTH} characters`)
    sanitized = sanitized.substring(0, MAX_TEXT_LENGTH)
  }
  
  return sanitized
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
    model?: string
    dimensions?: number
  } = {}
): Promise<number> {
  const [result1, result2] = await Promise.all([
    embedText(text1, options),
    embedText(text2, options)
  ])
  
  return cosineSimilarity(result1.embedding, result2.embedding)
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
    threshold?: number
    model?: string
    dimensions?: number
  } = {}
): Promise<Array<{ texts: string[]; indices: number[] }>> {
  const { threshold = 0.8 } = options
  
  // Generate embeddings for all texts
  const embeddings = await embedTexts(texts, options)
  
  // Simple clustering algorithm
  const clusters: Array<{ texts: string[]; indices: number[]; centroid: number[] }> = []
  const assigned = new Set<number>()
  
  for (let i = 0; i < embeddings.length; i++) {
    if (assigned.has(i)) continue
    
    const cluster = {
      texts: [texts[i]],
      indices: [i],
      centroid: embeddings[i].embedding
    }
    
    // Find similar texts
    for (let j = i + 1; j < embeddings.length; j++) {
      if (assigned.has(j)) continue
      
      const similarity = cosineSimilarity(cluster.centroid, embeddings[j].embedding)
      if (similarity >= threshold) {
        cluster.texts.push(texts[j])
        cluster.indices.push(j)
        assigned.add(j)
      }
    }
    
    clusters.push(cluster)
    assigned.add(i)
  }
  
  return clusters.map(({ texts, indices }) => ({ texts, indices }))
}

/**
 * Fast non-cryptographic hash function using FNV-1a algorithm for cache keys
 */
function hashText(text: string): string {
  const FNV_OFFSET_BASIS = 2166136261
  const FNV_PRIME = 16777619
  
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  
  // Convert to positive 32-bit integer and then to base36
  return (hash >>> 0).toString(36)
}

// Export singleton instance for convenience
export const semanticSearch = new SemanticSearch()