import { openai } from '@ai-sdk/openai';
import { cosineSimilarity, embed } from 'ai';
import { systemPrompts } from '../core/providers';
import { artifactTools } from '../tools/artifact-tools';
import { enhancedArtifactTools } from '../tools/enhanced-tools';

// Route interface
export interface Route {
  name: string;
  description?: string;
  examples: string[];
  embedding?: number[];
  metadata?: {
    systemPrompt?: string;
    tools?: Record<string, any>;
    temperature?: number;
    maxTokens?: number;
  };
}

// Route match result
export interface RouteMatch {
  route: Route;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
}

// Semantic router configuration
export interface SemanticRouterConfig {
  routes: Route[];
  embeddingModel?: string;
  similarityThreshold?: number;
  confidenceThresholds?: {
    high: number;
    medium: number;
  };
}

/**
 * Semantic router for intent classification based on embeddings
 */
export class SemanticRouter {
  private routes: Route[];
  private embeddingModel: string;
  private similarityThreshold: number;
  private confidenceThresholds: {
    high: number;
    medium: number;
  };
  private initialized = false;

  constructor(config: SemanticRouterConfig) {
    this.routes = config.routes;
    this.embeddingModel = config.embeddingModel || 'text-embedding-3-small';
    this.similarityThreshold = config.similarityThreshold || 0.5;
    this.confidenceThresholds = config.confidenceThresholds || {
      high: 0.8,
      medium: 0.65,
    };
  }

  /**
   * Initialize router by computing embeddings for all routes
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing semantic router...');

    for (const route of this.routes) {
      // Compute average embedding for route examples
      const embeddings: number[][] = [];

      for (const example of route.examples) {
        const { embedding } = await embed({
          model: openai.embedding(this.embeddingModel),
          value: example,
        });
        embeddings.push(embedding);
      }

      // Average the embeddings
      route.embedding = this.averageEmbeddings(embeddings);
    }

    this.initialized = true;
    console.log(
      `Semantic router initialized with ${this.routes.length} routes`
    );
  }

  /**
   * Route a user message to the best matching intent
   */
  async route(message: string): Promise<RouteMatch | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get embedding for the message
    const { embedding: messageEmbedding } = await embed({
      model: openai.embedding(this.embeddingModel),
      value: message,
    });

    // Find best matching route
    let bestMatch: RouteMatch | null = null;
    let highestSimilarity = 0;

    for (const route of this.routes) {
      if (!route.embedding) continue;

      // Add null check for messageEmbedding
      if (!messageEmbedding || messageEmbedding.length === 0) {
        console.warn('Message embedding is empty or null');
        continue;
      }

      const similarity = cosineSimilarity(messageEmbedding, route.embedding);

      if (
        similarity > highestSimilarity &&
        similarity >= this.similarityThreshold
      ) {
        highestSimilarity = similarity;

        // Determine confidence level
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (similarity >= this.confidenceThresholds.high) {
          confidence = 'high';
        } else if (similarity >= this.confidenceThresholds.medium) {
          confidence = 'medium';
        }

        bestMatch = {
          route,
          similarity,
          confidence,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Get route configuration for a matched intent
   */
  getRouteConfig(routeMatch: RouteMatch): {
    systemPrompt: string;
    tools: Record<string, any>;
    temperature?: number;
    maxTokens?: number;
  } {
    const { route } = routeMatch;
    const metadata = route.metadata || {};

    return {
      systemPrompt: metadata.systemPrompt || systemPrompts.default,
      tools: metadata.tools || artifactTools,
      temperature: metadata.temperature,
      maxTokens: metadata.maxTokens,
    };
  }

  /**
   * Add a new route dynamically
   */
  async addRoute(route: Route): Promise<void> {
    // Compute embedding for the new route
    const embeddings: number[][] = [];

    for (const example of route.examples) {
      const { embedding } = await embed({
        model: openai.embedding(this.embeddingModel),
        value: example,
      });
      embeddings.push(embedding);
    }

    route.embedding = this.averageEmbeddings(embeddings);
    this.routes.push(route);

    console.log(`Added route: ${route.name}`);
  }

  /**
   * Remove a route by name
   */
  removeRoute(name: string): boolean {
    const index = this.routes.findIndex((r) => r.name === name);
    if (index > -1) {
      this.routes.splice(index, 1);
      console.log(`Removed route: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get all routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Average multiple embeddings
   */
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];

    const dimension = embeddings[0].length;
    const average = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        average[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      average[i] /= embeddings.length;
    }

    return average;
  }
}

/**
 * Pre-configured chat router with common intents
 */
export const chatRouter = new SemanticRouter({
  routes: [
    {
      name: 'code-help',
      description:
        'User needs help with coding, debugging, or technical implementation',
      examples: [
        'debug this code',
        'fix this bug',
        'write a function that',
        'how do I implement',
        'create a React component',
        'help me with this error',
        'optimize this code',
        'refactor this function',
      ],
      metadata: {
        systemPrompt: systemPrompts.technical,
        tools: {
          ...artifactTools,
          ...enhancedArtifactTools,
        },
        temperature: 0.3,
      },
    },
    {
      name: 'creative',
      description: 'User wants creative content, writing, or artistic help',
      examples: [
        'write a story about',
        'create content for',
        'brainstorm ideas',
        'design a concept',
        'help me write',
        'generate creative',
        'compose a poem',
        'draft an article',
      ],
      metadata: {
        systemPrompt: systemPrompts.creative,
        tools: artifactTools,
        temperature: 0.8,
      },
    },
    {
      name: 'analysis',
      description: 'User needs data analysis, visualization, or insights',
      examples: [
        'analyze this data',
        'create a chart',
        'visualize these numbers',
        'summarize this information',
        'what insights can you find',
        'generate a report',
        'compare these metrics',
        'show me trends',
      ],
      metadata: {
        systemPrompt: systemPrompts.default,
        tools: {
          ...artifactTools,
          createCodeArtifact: enhancedArtifactTools.createCodeArtifact,
        },
        temperature: 0.5,
      },
    },
    {
      name: 'blockchain',
      description: 'User asks about blockchain, Web3, or cryptocurrency',
      examples: [
        'solana wallet',
        'smart contract',
        'blockchain transaction',
        'NFT collection',
        'DeFi protocol',
        'Web3 integration',
        'crypto wallet',
        'token deployment',
      ],
      metadata: {
        systemPrompt: `${systemPrompts.technical}\n\nYou have deep expertise in blockchain technology, smart contracts, and Web3 development.`,
        tools: artifactTools,
        temperature: 0.4,
      },
    },
    {
      name: 'general',
      description: 'General questions or conversation',
      examples: [
        'hello',
        'how are you',
        'what can you do',
        'tell me about',
        'explain',
        'help me understand',
        'what is',
        'can you',
      ],
      metadata: {
        systemPrompt: systemPrompts.default,
        tools: artifactTools,
        temperature: 0.7,
      },
    },
  ],
  similarityThreshold: 0.6,
  confidenceThresholds: {
    high: 0.85,
    medium: 0.7,
  },
});

/**
 * Route user intent and get configuration
 */
export async function routeUserIntent(message: string): Promise<{
  route: string | null;
  confidence: string | null;
  systemPrompt: string;
  tools: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
}> {
  const match = await chatRouter.route(message);

  if (match) {
    const config = chatRouter.getRouteConfig(match);
    return {
      route: match.route.name,
      confidence: match.confidence,
      ...config,
    };
  }

  // Default configuration if no route matches
  return {
    route: null,
    confidence: null,
    systemPrompt: systemPrompts.default,
    tools: artifactTools,
    temperature: 0.7,
  };
}

/**
 * Create a custom semantic router
 */
export function createSemanticRouter(routes: Route[]): SemanticRouter {
  return new SemanticRouter({
    routes,
    similarityThreshold: 0.6,
  });
}

/**
 * Intent-specific routers for specialized domains
 */
export const domainRouters = {
  // Technical domain router
  technical: new SemanticRouter({
    routes: [
      {
        name: 'frontend',
        examples: [
          'React',
          'Vue',
          'Angular',
          'CSS',
          'HTML',
          'frontend',
          'UI',
          'component',
        ],
        metadata: { temperature: 0.3 },
      },
      {
        name: 'backend',
        examples: [
          'API',
          'database',
          'server',
          'Node.js',
          'Python',
          'backend',
          'REST',
          'GraphQL',
        ],
        metadata: { temperature: 0.3 },
      },
      {
        name: 'devops',
        examples: [
          'Docker',
          'Kubernetes',
          'CI/CD',
          'deployment',
          'AWS',
          'cloud',
          'infrastructure',
        ],
        metadata: { temperature: 0.4 },
      },
    ],
  }),

  // Business domain router
  business: new SemanticRouter({
    routes: [
      {
        name: 'strategy',
        examples: [
          'business plan',
          'strategy',
          'market analysis',
          'competition',
          'growth',
        ],
        metadata: { temperature: 0.6 },
      },
      {
        name: 'finance',
        examples: [
          'revenue',
          'profit',
          'budget',
          'financial',
          'investment',
          'ROI',
        ],
        metadata: { temperature: 0.4 },
      },
      {
        name: 'marketing',
        examples: [
          'marketing',
          'campaign',
          'audience',
          'brand',
          'social media',
          'SEO',
        ],
        metadata: { temperature: 0.7 },
      },
    ],
  }),
};
