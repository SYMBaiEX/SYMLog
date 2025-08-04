import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import { config } from '../config'

// Create provider registry with fallback support
export const registry = createProviderRegistry({
  openai,
  anthropic,
})

// Model configuration with fallback chain
export const getAIModel = (preferredModel?: string) => {
  const models = {
    // Latest models as of August 2025
    // Note: These model identifiers may need adjustment based on the actual API naming conventions
    primary: 'gpt-4.5',  // OpenAI's latest foundation model (Orion) - 7T parameters
    secondary: 'claude-opus-4-20250501',  // Anthropic's latest and best coding model (May 2025)
    fallback: 'claude-3.7-sonnet-20250201',  // Cost-effective fallback (Feb 2025)
    reasoning: 'o1-preview',  // OpenAI's chain-of-thought reasoning model
    gemini: 'gemini-2.5-pro',  // Google's latest Gemini model
  }

  // Return the preferred model or use the primary model
  const modelToUse = preferredModel || models.primary
  
  // Map model names to provider-specific formats
  if (modelToUse.includes('gpt') || modelToUse.includes('o1') || modelToUse.includes('o3')) {
    return openai(modelToUse)
  } else if (modelToUse.includes('claude')) {
    return anthropic(modelToUse)
  } else if (modelToUse.includes('gemini')) {
    // Note: Google Gemini integration would need to be added
    console.warn('Gemini models not yet integrated, falling back to Claude')
    return anthropic(models.secondary)
  }
  
  // Default to Claude Opus 4 for best coding performance
  return anthropic(models.secondary)
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