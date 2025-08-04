import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("expired")),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_auth_code", ["authCode"]),
  
  rateLimits: defineTable({
    userId: v.string(),
    timestamp: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_expiry", ["expiresAt"]),
  
  csrfTokens: defineTable({
    token: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"])
    .index("by_expiry", ["expiresAt"]),
});
