import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { 
  experimental_createProviderRegistry as createProviderRegistry,
  wrapProvider,
  type LanguageModelRequestMetadata,
  type LanguageModelResponseMetadata,
  type ProviderMetadata 
} from 'ai'
import { config } from '../config'
import { loggingMiddleware, performanceMiddleware, securityMiddleware, createCachingMiddleware } from './middleware'

// Create enhanced provider registry with middleware support
export const registry = createProviderRegistry({
  // Wrap OpenAI provider with middleware
  openai: wrapProvider({
    provider: openai,
    languageModelMiddleware: [
      loggingMiddleware,
      performanceMiddleware,
      securityMiddleware
    ]
  }),
  
  // Wrap Anthropic provider with middleware
  anthropic: wrapProvider({
    provider: anthropic,
    languageModelMiddleware: [
      loggingMiddleware,
      performanceMiddleware,
      createCachingMiddleware() // Add caching for Anthropic
    ]
  }),
})

// Model configuration with fallback chain
export const getAIModel = (
  preferredModel?: string,
  metadata?: LanguageModelRequestMetadata
) => {
  const models = {
    // Latest models as of August 2025
    primary: 'gpt-4.1-nano',  // OpenAI's efficient nano model
    secondary: 'claude-sonnet-4-20250514',  // Claude 4 Sonnet - latest model (May 2025)
    fallback: 'gpt-4o-mini',  // Cost-effective OpenAI fallback
    coding: 'gpt-4.1-2025-04-14',  // OpenAI's specialized coding model
    reasoning: 'claude-3-7-sonnet@20250219',  // Claude 3.7 hybrid reasoning model
    budget: 'claude-3-5-sonnet-20241022',  // Proven stable Claude model
  }

  // Return the preferred model or use the primary model
  const modelToUse = preferredModel || models.primary
  
  // Get model from registry with metadata
  const model = registry.languageModel(modelToUse)
  
  // Add provider metadata and options
  if (metadata) {
    return model.withMetadata({
      ...metadata,
      application: 'SYMLog',
      version: '1.0.0',
    })
  }
  
  return model
}

// Rate limiting configuration
export const rateLimitConfig = {
  maxRequestsPerHour: config.get().rateLimitMaxRequests,
  maxTokensPerRequest: config.get().aiMaxTokensPerRequest,
}

// System prompts for different contexts
export const systemPrompts = {
  default: `You are an advanced AI assistant integrated into the SYMLog platform with artifact creation capabilities.
You can create interactive artifacts including:
- Code snippets with syntax highlighting and execution capabilities
- Documents with rich formatting (markdown, HTML)
- Spreadsheets with sortable, filterable data
- Charts and visualizations
- Images and diagrams
- Structured data (JSON, CSV)

When users ask for code, documents, data, or visualizations, use the appropriate artifact tools to create interactive, editable artifacts.
You have access to information about the user's Web3 wallet and can help with various tasks.
Be concise, helpful, and accurate in your responses.`,
  
  technical: `You are a technical AI assistant specializing in Web3, blockchain, and software development with advanced artifact capabilities.
You can create:
- Executable code artifacts (JavaScript, TypeScript, Python, React components, Solidity)
- Technical documentation with proper formatting
- Data structures and API responses
- SQL queries and database schemas
- Architecture diagrams and flowcharts
- Smart contracts and DeFi protocols

Use artifact tools to create interactive code that users can run, edit, and learn from.
Provide detailed technical explanations alongside your artifacts.
Always consider security best practices in your recommendations.`,
  
  creative: `You are a creative AI assistant with multimedia artifact capabilities for the SYMLog platform.
You can create:
- Creative writing documents with rich formatting
- Data visualizations and charts
- Design mockups and wireframes
- Structured creative content (stories, poems, scripts)
- Interactive presentations
- NFT metadata and descriptions

Use artifact tools to bring creative ideas to life in interactive formats.
Think outside the box while remaining practical and actionable in your suggestions.`,
}