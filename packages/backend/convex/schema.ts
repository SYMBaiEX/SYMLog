import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),

  authSessions: defineTable({
    authCode: v.string(),
    userId: v.string(),
    userEmail: v.string(),
    walletAddress: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('expired')
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index('by_auth_code', ['authCode']),

  // Agent-related tables for user-facing knowledge and memory viewing
  agents: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    model: v.string(), // AI model being used (gpt-4.1-nano, o3-mini, etc.)
    systemPrompt: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(),
  })
    .index('by_user', ['userId'])
    .index('by_user_active', ['userId', 'isActive']),

  agentMemories: defineTable({
    userId: v.string(),
    agentId: v.id('agents'),
    type: v.union(
      v.literal('conversation'),
      v.literal('learning'),
      v.literal('reflection'),
      v.literal('context'),
      v.literal('preference')
    ),
    content: v.string(),
    metadata: v.optional(
      v.object({
        importance: v.optional(v.number()), // 1-10 importance score
        tags: v.optional(v.array(v.string())),
        source: v.optional(v.string()), // conversation, user_input, inference
        relatedMemoryIds: v.optional(v.array(v.id('agentMemories'))),
      })
    ),
    timestamp: v.number(),
    expiresAt: v.optional(v.number()), // For temporary memories
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_type', ['agentId', 'type'])
    .index('by_timestamp', ['timestamp']),

  agentKnowledge: defineTable({
    userId: v.string(),
    agentId: v.id('agents'),
    category: v.union(
      v.literal('facts'),
      v.literal('skills'),
      v.literal('preferences'),
      v.literal('relationships'),
      v.literal('procedures'),
      v.literal('concepts')
    ),
    title: v.string(),
    content: v.string(),
    confidence: v.number(), // 0-1 confidence in knowledge accuracy
    metadata: v.optional(
      v.object({
        tags: v.optional(v.array(v.string())),
        source: v.optional(v.string()),
        lastVerified: v.optional(v.number()),
        usageCount: v.optional(v.number()),
        relatedKnowledgeIds: v.optional(v.array(v.id('agentKnowledge'))),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_category', ['agentId', 'category'])
    .index('by_confidence', ['confidence']),

  conversations: defineTable({
    userId: v.string(),
    agentId: v.id('agents'),
    title: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('completed'),
      v.literal('archived')
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(
      v.object({
        messageCount: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        avgResponseTime: v.optional(v.number()),
      })
    ),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_status', ['status']),

  conversationMessages: defineTable({
    conversationId: v.id('conversations'),
    userId: v.string(),
    agentId: v.id('agents'),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),
    model: v.optional(v.string()), // Model used for this specific message
    metadata: v.optional(
      v.object({
        tokens: v.optional(v.number()),
        responseTime: v.optional(v.number()),
        cost: v.optional(v.number()),
        reasoning: v.optional(v.string()), // For reasoning models
        attachments: v.optional(v.array(v.string())),
      })
    ),
    timestamp: v.number(),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_timestamp', ['timestamp']),

  agentLearningEvents: defineTable({
    userId: v.string(),
    agentId: v.id('agents'),
    eventType: v.union(
      v.literal('knowledge_gained'),
      v.literal('memory_created'),
      v.literal('skill_improved'),
      v.literal('preference_learned'),
      v.literal('mistake_corrected')
    ),
    description: v.string(),
    relatedData: v.optional(
      v.object({
        memoryId: v.optional(v.id('agentMemories')),
        knowledgeId: v.optional(v.id('agentKnowledge')),
        conversationId: v.optional(v.id('conversations')),
      })
    ),
    impact: v.number(), // 1-10 scale of learning impact
    timestamp: v.number(),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_type', ['agentId', 'eventType'])
    .index('by_impact', ['impact']),
});
