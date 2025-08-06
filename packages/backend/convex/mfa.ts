import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { createHash, randomBytes } from "crypto"

// TOTP implementation (simplified - use proper library in production)
function generateTOTPSecret(): string {
  return randomBytes(20).toString('base64')
}

function generateBackupCodes(): string[] {
  const codes = []
  for (let i = 0; i < 10; i++) {
    codes.push(randomBytes(4).toString('hex').toUpperCase())
  }
  return codes
}

function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toLowerCase()).digest('hex')
}

/**
 * Enable MFA for a user
 */
export const enableMFA = mutation({
  args: {
    userId: v.id("users"),
    method: v.union(v.literal("totp"), v.literal("sms"), v.literal("email")),
    secret: v.optional(v.string()), // For TOTP
    phoneNumber: v.optional(v.string()), // For SMS
    email: v.optional(v.string()), // For email
    verificationCode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error("User not found")
    }

    // Verify the setup code first
    const isValid = await verifyMFACode(ctx, {
      userId: args.userId,
      code: args.verificationCode,
      method: args.method,
      secret: args.secret,
      phoneNumber: args.phoneNumber,
      email: args.email,
    })

    if (!isValid) {
      throw new Error("Invalid verification code")
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes()
    const hashedBackupCodes = backupCodes.map(code => ({
      code: hashBackupCode(code),
      used: false,
      usedAt: null,
    }))

    // Create MFA configuration
    const mfaConfig = await ctx.db.insert("mfaConfigurations", {
      userId: args.userId,
      method: args.method,
      secret: args.secret, // Should be encrypted in production
      phoneNumber: args.phoneNumber,
      email: args.email,
      isEnabled: true,
      backupCodes: hashedBackupCodes,
      createdAt: Date.now(),
      lastUsedAt: null,
    })

    // Update user to mark MFA as enabled
    await ctx.db.patch(args.userId, {
      mfaEnabled: true,
      mfaMethod: args.method,
    })

    // Log MFA enablement
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "mfa_enabled",
      timestamp: Date.now(),
      success: true,
      metadata: {
        method: args.method,
        configId: mfaConfig,
      },
    })

    // Return backup codes (only time they're shown in plain text)
    return {
      backupCodes,
      method: args.method,
      configId: mfaConfig,
    }
  },
})

/**
 * Verify MFA code during authentication
 */
export const verifyMFACode = mutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    method: v.union(v.literal("totp"), v.literal("sms"), v.literal("email"), v.literal("backup")),
    secret: v.optional(v.string()), // For setup verification
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // If this is for setup verification, use provided parameters
    if (args.secret || args.phoneNumber || args.email) {
      return await verifySetupCode(args.method, args.code, {
        secret: args.secret,
        phoneNumber: args.phoneNumber,
        email: args.email,
      })
    }

    // For regular authentication, get user's MFA config
    const mfaConfig = await ctx.db
      .query("mfaConfigurations")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .filter(q => q.eq(q.field("isEnabled"), true))
      .first()

    if (!mfaConfig) {
      throw new Error("MFA not configured for user")
    }

    let isValid = false

    switch (args.method) {
      case "totp":
        isValid = verifyTOTPCode(args.code, mfaConfig.secret!)
        break
      case "sms":
        isValid = await verifySMSCode(args.code, mfaConfig.phoneNumber!)
        break
      case "email":
        isValid = await verifyEmailCode(args.code, mfaConfig.email!)
        break
      case "backup":
        isValid = await verifyBackupCode(ctx, mfaConfig._id, args.code)
        break
      default:
        throw new Error("Invalid MFA method")
    }

    if (isValid) {
      // Update last used timestamp
      await ctx.db.patch(mfaConfig._id, {
        lastUsedAt: Date.now(),
      })

      // Log successful MFA verification
      await ctx.db.insert("auditLogs", {
        userId: args.userId,
        action: "mfa_verified",
        timestamp: Date.now(),
        success: true,
        metadata: {
          method: args.method,
        },
      })
    } else {
      // Log failed MFA attempt
      await ctx.db.insert("auditLogs", {
        userId: args.userId,
        action: "mfa_verification_failed",
        timestamp: Date.now(),
        success: false,
        metadata: {
          method: args.method,
        },
      })
    }

    return isValid
  },
})

/**
 * Disable MFA for a user
 */
export const disableMFA = mutation({
  args: {
    userId: v.id("users"),
    verificationCode: v.string(),
    method: v.union(v.literal("totp"), v.literal("sms"), v.literal("email"), v.literal("backup")),
  },
  handler: async (ctx, args) => {
    // Verify current MFA code before disabling
    const isValid = await verifyMFACode(ctx, {
      userId: args.userId,
      code: args.verificationCode,
      method: args.method,
    })

    if (!isValid) {
      throw new Error("Invalid verification code")
    }

    // Disable MFA configuration
    const mfaConfig = await ctx.db
      .query("mfaConfigurations")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .first()

    if (mfaConfig) {
      await ctx.db.patch(mfaConfig._id, {
        isEnabled: false,
        disabledAt: Date.now(),
      })
    }

    // Update user
    await ctx.db.patch(args.userId, {
      mfaEnabled: false,
      mfaMethod: null,
    })

    // Log MFA disablement
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "mfa_disabled",
      timestamp: Date.now(),
      success: true,
    })

    return { success: true }
  },
})

/**
 * Generate new backup codes
 */
export const regenerateBackupCodes = mutation({
  args: {
    userId: v.id("users"),
    verificationCode: v.string(),
    method: v.union(v.literal("totp"), v.literal("sms"), v.literal("email")),
  },
  handler: async (ctx, args) => {
    // Verify current MFA code
    const isValid = await verifyMFACode(ctx, {
      userId: args.userId,
      code: args.verificationCode,
      method: args.method,
    })

    if (!isValid) {
      throw new Error("Invalid verification code")
    }

    const mfaConfig = await ctx.db
      .query("mfaConfigurations")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .first()

    if (!mfaConfig) {
      throw new Error("MFA not configured")
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes()
    const hashedBackupCodes = backupCodes.map(code => ({
      code: hashBackupCode(code),
      used: false,
      usedAt: null,
    }))

    // Update MFA configuration with new backup codes
    await ctx.db.patch(mfaConfig._id, {
      backupCodes: hashedBackupCodes,
      backupCodesRegeneratedAt: Date.now(),
    })

    // Log backup codes regeneration
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: "backup_codes_regenerated",
      timestamp: Date.now(),
      success: true,
    })

    return { backupCodes }
  },
})

// Helper functions (simplified implementations)
async function verifySetupCode(method: string, code: string, config: any): Promise<boolean> {
  switch (method) {
    case "totp":
      return verifyTOTPCode(code, config.secret)
    case "sms":
      return await verifySMSCode(code, config.phoneNumber)
    case "email":
      return await verifyEmailCode(code, config.email)
    default:
      return false
  }
}

function verifyTOTPCode(code: string, secret: string): boolean {
  // Simplified TOTP verification - use proper library like 'otplib' in production
  // This is just a placeholder
  const timeStep = Math.floor(Date.now() / 30000)
  const expectedCode = generateSimpleTOTP(secret, timeStep)
  
  // Check current time step and previous one (to account for time drift)
  const prevCode = generateSimpleTOTP(secret, timeStep - 1)
  
  return code === expectedCode || code === prevCode
}

function generateSimpleTOTP(secret: string, timeStep: number): string {
  // Extremely simplified TOTP - use proper HMAC-SHA1 in production
  const hash = createHash('sha256').update(secret + timeStep.toString()).digest('hex')
  return (parseInt(hash.substring(0, 6), 16) % 1000000).toString().padStart(6, '0')
}

async function verifySMSCode(code: string, phoneNumber: string): Promise<boolean> {
  // Integration with SMS service (Twilio, etc.)
  // For now, return true if code is 6 digits
  return /^\d{6}$/.test(code)
}

async function verifyEmailCode(code: string, email: string): Promise<boolean> {
  // Integration with email service
  // For now, return true if code is 6 digits
  return /^\d{6}$/.test(code)
}

async function verifyBackupCode(ctx: any, configId: string, code: string): Promise<boolean> {
  const config = await ctx.db.get(configId)
  if (!config) return false

  const hashedCode = hashBackupCode(code)
  
  // Find matching unused backup code
  const backupCodeIndex = config.backupCodes.findIndex(
    (bc: any) => bc.code === hashedCode && !bc.used
  )

  if (backupCodeIndex === -1) {
    return false
  }

  // Mark backup code as used
  const updatedBackupCodes = [...config.backupCodes]
  updatedBackupCodes[backupCodeIndex] = {
    ...updatedBackupCodes[backupCodeIndex],
    used: true,
    usedAt: Date.now(),
  }

  await ctx.db.patch(configId, {
    backupCodes: updatedBackupCodes,
  })

  return true
}

/**
 * Get MFA status for a user
 */
export const getMFAStatus = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const mfaConfig = await ctx.db
      .query("mfaConfigurations")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .first()

    if (!mfaConfig || !mfaConfig.isEnabled) {
      return {
        enabled: false,
        method: null,
        backupCodesRemaining: 0,
      }
    }

    const backupCodesRemaining = mfaConfig.backupCodes.filter(
      (code: any) => !code.used
    ).length

    return {
      enabled: true,
      method: mfaConfig.method,
      backupCodesRemaining,
      lastUsedAt: mfaConfig.lastUsedAt,
    }
  },
})