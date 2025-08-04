import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'

// Create provider registry with fallback support
export const registry = createProviderRegistry({
  openai,
  anthropic,
})

// Model configuration with fallback chain
export const getAIModel = (preferredModel?: string) => {
  const models = {
    primary: process.env.AI_MODEL_PRIMARY || 'gpt-4-turbo-preview',
    secondary: process.env.AI_MODEL_SECONDARY || 'claude-3-sonnet-20240229',
    fallback: process.env.AI_MODEL_FALLBACK || 'gpt-3.5-turbo',
  }

  // Return the preferred model or use the primary model
  const modelToUse = preferredModel || models.primary
  
  // Map model names to provider-specific formats
  if (modelToUse.includes('gpt') || modelToUse.includes('o1')) {
    return openai(modelToUse)
  } else if (modelToUse.includes('claude')) {
    return anthropic(modelToUse)
  }
  
  // Default to OpenAI
  return openai(models.primary)
}

// Rate limiting configuration
export const rateLimitConfig = {
  maxRequestsPerHour: parseInt(process.env.AI_RATE_LIMIT_PER_USER_PER_HOUR || '100'),
  maxTokensPerRequest: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST || '2000'),
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