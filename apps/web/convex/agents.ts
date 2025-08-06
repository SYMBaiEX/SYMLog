import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Agent management queries
export const getUserAgents = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Row-level security: only return agents for the authenticated user
    return await ctx.db
      .query('agents')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
  },
});

export const getActiveAgents = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agents')
      .withIndex('by_user_active', (q) =>
        q.eq('userId', args.userId).eq('isActive', true)
      )
      .collect();
  },
});

export const getAgentById = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);

    // Security check: ensure user owns this agent
    if (!agent || agent.userId !== args.userId) {
      return null;
    }

    return agent;
  },
});

// Agent memory queries
export const getAgentMemories = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    type: v.optional(
      v.union(
        v.literal('conversation'),
        v.literal('learning'),
        v.literal('reflection'),
        v.literal('context'),
        v.literal('preference')
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use compound index for authorization and filtering in one query
    let query;

    if (args.type) {
      // Use the more specific compound index when type is provided
      query = ctx.db
        .query('agentMemories')
        .withIndex('by_user_agent_type', (q) =>
          q
            .eq('userId', args.userId)
            .eq('agentId', args.agentId)
            .eq(
              'type',
              args.type as
                | 'conversation'
                | 'learning'
                | 'reflection'
                | 'context'
                | 'preference'
            )
        );
    } else {
      // Use user_agent index when no type filter
      query = ctx.db
        .query('agentMemories')
        .withIndex('by_user_agent', (q) =>
          q.eq('userId', args.userId).eq('agentId', args.agentId)
        );
    }

    const memories = await query.order('desc').take(args.limit || 50);

    return memories;
  },
});

export const getAgentMemoryTimeline = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use compound index for authorization and filtering in one query
    let query = ctx.db
      .query('agentMemories')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      );

    // Apply time filtering if provided
    if (args.startTime || args.endTime) {
      if (args.startTime && args.endTime) {
        query = query.filter((q) =>
          q.and(
            q.gte(q.field('timestamp'), args.startTime!),
            q.lte(q.field('timestamp'), args.endTime!)
          )
        );
      } else if (args.startTime) {
        query = query.filter((q) =>
          q.gte(q.field('timestamp'), args.startTime!)
        );
      } else if (args.endTime) {
        query = query.filter((q) => q.lte(q.field('timestamp'), args.endTime!));
      }
    }

    return await query.order('desc').collect();
  },
});

// Agent knowledge queries
export const getAgentKnowledge = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    category: v.optional(
      v.union(
        v.literal('facts'),
        v.literal('skills'),
        v.literal('preferences'),
        v.literal('relationships'),
        v.literal('procedures'),
        v.literal('concepts')
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== args.userId) {
      return [];
    }

    let query = ctx.db
      .query('agentKnowledge')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      );

    if (args.category) {
      query = ctx.db
        .query('agentKnowledge')
        .withIndex('by_agent_category', (q) =>
          q
            .eq('agentId', args.agentId)
            .eq(
              'category',
              args.category as
                | 'facts'
                | 'skills'
                | 'preferences'
                | 'relationships'
                | 'procedures'
                | 'concepts'
            )
        )
        .filter((q) => q.eq(q.field('userId'), args.userId));
    }

    const knowledge = await query.order('desc').take(args.limit || 50);

    return knowledge;
  },
});

export const getAgentKnowledgeStats = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
  },
  handler: async (ctx, args) => {
    // Verify user owns the agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== args.userId) {
      return null;
    }

    const knowledge = await ctx.db
      .query('agentKnowledge')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      )
      .collect();

    const memories = await ctx.db
      .query('agentMemories')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      )
      .collect();

    // Calculate statistics
    const knowledgeByCategory = knowledge.reduce(
      (acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const memoriesByType = memories.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const avgConfidence =
      knowledge.length > 0
        ? knowledge.reduce((sum, item) => sum + item.confidence, 0) /
          knowledge.length
        : 0;

    const totalMemories = memories.length;
    const totalKnowledge = knowledge.length;
    const recentMemories = memories.filter(
      (m) => m.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
    ).length;

    return {
      totalKnowledge,
      totalMemories,
      recentMemories,
      avgConfidence,
      knowledgeByCategory,
      memoriesByType,
      lastUpdated: Math.max(
        Math.max(...knowledge.map((k) => k.updatedAt), 0),
        Math.max(...memories.map((m) => m.timestamp), 0)
      ),
    };
  },
});

// Conversation queries
export const getAgentConversations = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    status: v.optional(
      v.union(
        v.literal('active'),
        v.literal('completed'),
        v.literal('archived')
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== args.userId) {
      return [];
    }

    let query = ctx.db
      .query('conversations')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      );

    if (args.status) {
      query = query.filter((q) => q.eq(q.field('status'), args.status));
    }

    return await query.order('desc').take(args.limit || 20);
  },
});

export const getConversationMessages = query({
  args: {
    userId: v.string(),
    conversationId: v.id('conversations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== args.userId) {
      return [];
    }

    return await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversation', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .order('asc') // Messages in chronological order
      .take(args.limit || 100);
  },
});

// Learning events queries
export const getAgentLearningEvents = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    eventType: v.optional(
      v.union(
        v.literal('knowledge_gained'),
        v.literal('memory_created'),
        v.literal('skill_improved'),
        v.literal('preference_learned'),
        v.literal('mistake_corrected')
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== args.userId) {
      return [];
    }

    let query = ctx.db
      .query('agentLearningEvents')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      );

    if (args.eventType) {
      query = ctx.db
        .query('agentLearningEvents')
        .withIndex('by_agent_type', (q) =>
          q
            .eq('agentId', args.agentId)
            .eq(
              'eventType',
              args.eventType as
                | 'knowledge_gained'
                | 'memory_created'
                | 'skill_improved'
                | 'preference_learned'
                | 'mistake_corrected'
            )
        )
        .filter((q) => q.eq(q.field('userId'), args.userId));
    }

    return await query.order('desc').take(args.limit || 30);
  },
});

export const getAgentLearningProgress = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user owns the agent
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== args.userId) {
      return null;
    }

    const daysBack = args.days || 30;
    const startTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const learningEvents = await ctx.db
      .query('agentLearningEvents')
      .withIndex('by_user_agent', (q) =>
        q.eq('userId', args.userId).eq('agentId', args.agentId)
      )
      .filter((q) => q.gte(q.field('timestamp'), startTime))
      .collect();

    // Group events by day
    const eventsByDay = learningEvents.reduce(
      (acc, event) => {
        const day = new Date(event.timestamp).toISOString().split('T')[0];
        if (!acc[day]) {
          acc[day] = [];
        }
        acc[day].push(event);
        return acc;
      },
      {} as Record<string, typeof learningEvents>
    );

    // Calculate daily progress metrics
    const progressData = Object.entries(eventsByDay).map(([day, events]) => ({
      date: day,
      events: events.length,
      totalImpact: events.reduce((sum, e) => sum + e.impact, 0),
      avgImpact: events.reduce((sum, e) => sum + e.impact, 0) / events.length,
      eventTypes: events.reduce(
        (acc, e) => {
          acc[e.eventType] = (acc[e.eventType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    }));

    return {
      progressData,
      totalEvents: learningEvents.length,
      totalImpact: learningEvents.reduce((sum, e) => sum + e.impact, 0),
      avgDailyEvents: learningEvents.length / daysBack,
      period: { days: daysBack, startTime, endTime: Date.now() },
    };
  },
});

// Search functionality
export const searchAgentData = query({
  args: {
    userId: v.string(),
    agentId: v.id('agents'),
    searchQuery: v.string(),
    dataType: v.optional(
      v.union(v.literal('memories'), v.literal('knowledge'), v.literal('all'))
    ),
  },
  handler: async (ctx, args) => {
    const query = args.searchQuery.toLowerCase();
    const searchMemories = args.dataType !== 'knowledge';
    const searchKnowledge = args.dataType !== 'memories';

    const results = { memories: [] as any[], knowledge: [] as any[] };

    // Use compound index for authorization - no separate agent lookup needed
    if (searchMemories) {
      const memories = await ctx.db
        .query('agentMemories')
        .withIndex('by_user_agent', (q) =>
          q.eq('userId', args.userId).eq('agentId', args.agentId)
        )
        .collect();

      results.memories = memories.filter(
        (memory) =>
          memory.content.toLowerCase().includes(query) ||
          (memory.metadata?.tags &&
            memory.metadata.tags.some((tag) =>
              tag.toLowerCase().includes(query)
            ))
      );
    }

    if (searchKnowledge) {
      const knowledge = await ctx.db
        .query('agentKnowledge')
        .withIndex('by_user_agent', (q) =>
          q.eq('userId', args.userId).eq('agentId', args.agentId)
        )
        .collect();

      results.knowledge = knowledge.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query) ||
          (item.metadata?.tags &&
            item.metadata.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    }

    return results;
  },
});
