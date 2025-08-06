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

  rateLimits: defineTable({
    userId: v.string(),
    timestamp: v.number(),
    expiresAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_timestamp', ['userId', 'timestamp'])
    .index('by_expiry', ['expiresAt']),

  csrfTokens: defineTable({
    token: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId'])
    .index('by_expiry', ['expiresAt'])
    .index('by_used_and_expiry', ['used', 'expiresAt']), // For efficient cleanup of expired tokens

  tokenUsage: defineTable({
    userId: v.string(),
    timestamp: v.number(),
    estimatedTokens: v.number(),
    actualTokens: v.number(),
    status: v.union(
      v.literal('reserved'),
      v.literal('completed'),
      v.literal('cancelled')
    ),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
  })
    .index('by_user_and_date', ['userId', 'timestamp'])
    .index('by_status_and_expiry', ['status', 'expiresAt'])
    .index('by_user', ['userId']),

  // Agent data tables for user-facing knowledge and memory viewing
  agents: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    model: v.string(),
    systemPrompt: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(
      v.object({
        tags: v.optional(v.array(v.string())),
        category: v.optional(v.string()),
        version: v.optional(v.string()),
      })
    ),
  })
    .index('by_user', ['userId'])
    .index('by_user_active', ['userId', 'isActive'])
    .index('by_user_updated', ['userId', 'updatedAt']),

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
    timestamp: v.number(),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        importance: v.optional(v.number()), // 1-10 scale
        tags: v.optional(v.array(v.string())),
        source: v.optional(v.string()),
        relatedMemoryIds: v.optional(v.array(v.id('agentMemories'))),
      })
    ),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_type', ['agentId', 'type'])
    .index('by_user_agent_type', ['userId', 'agentId', 'type']) // Compound index for efficient filtering
    .index('by_timestamp', ['timestamp'])
    .index('by_expiry', ['expiresAt'])
    .searchIndex('search_content', {
      searchField: 'content',
      filterFields: ['userId', 'agentId', 'type'],
    }),

  agentKnowledge: defineTable({
    userId: v.string(),
    agentId: v.id('agents'),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal('facts'),
      v.literal('skills'),
      v.literal('preferences'),
      v.literal('relationships'),
      v.literal('procedures'),
      v.literal('concepts')
    ),
    confidence: v.number(), // 0-1 scale
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(
      v.object({
        tags: v.optional(v.array(v.string())),
        source: v.optional(v.string()),
        usageCount: v.optional(v.number()),
        lastUsed: v.optional(v.number()),
      })
    ),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_category', ['agentId', 'category'])
    .index('by_user_agent_category', ['userId', 'agentId', 'category']) // Compound index for filtering
    .index('by_agent_confidence', ['agentId', 'confidence'])
    .index('by_agent_updated', ['agentId', 'updatedAt'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['userId', 'agentId', 'category'],
    })
    .searchIndex('search_content', {
      searchField: 'content',
      filterFields: ['userId', 'agentId', 'category'],
    }),

  conversations: defineTable({
    userId: v.string(),
    agentId: v.id('agents'),
    title: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('completed'),
      v.literal('archived')
    ),
    startedAt: v.number(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
    metadata: v.optional(
      v.object({
        tags: v.optional(v.array(v.string())),
        summary: v.optional(v.string()),
        totalTokens: v.optional(v.number()),
      })
    ),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_status', ['agentId', 'status'])
    .index('by_user_agent_status', ['userId', 'agentId', 'status']) // Compound index for filtering
    .index('by_user_recent', ['userId', 'lastMessageAt'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['userId', 'agentId', 'status'],
    }),

  conversationMessages: defineTable({
    conversationId: v.id('conversations'),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),
    timestamp: v.number(),
    metadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        tokens: v.optional(v.number()),
        attachments: v.optional(v.array(v.string())),
      })
    ),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_conversation_time', ['conversationId', 'timestamp']),

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
    impact: v.number(), // 1-10 scale representing learning impact
    timestamp: v.number(),
    metadata: v.optional(
      v.object({
        relatedKnowledgeId: v.optional(v.id('agentKnowledge')),
        relatedMemoryId: v.optional(v.id('agentMemories')),
        context: v.optional(v.string()),
        confidence: v.optional(v.number()),
      })
    ),
  })
    .index('by_user_agent', ['userId', 'agentId'])
    .index('by_agent_type', ['agentId', 'eventType'])
    .index('by_user_agent_type', ['userId', 'agentId', 'eventType']) // Compound index for filtering
    .index('by_agent_time', ['agentId', 'timestamp'])
    .index('by_user_agent_time', ['userId', 'agentId', 'timestamp']) // Compound index for recent events
    .index('by_impact', ['impact'])
    .searchIndex('search_description', {
      searchField: 'description',
      filterFields: ['userId', 'agentId', 'eventType'],
    }),
});
