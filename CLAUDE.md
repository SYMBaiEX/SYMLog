# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development

```bash
# Start all applications in development mode (uses port 3000 for web)
bun dev

# Start only the web application
bun dev:web

# Start only the backend server
bun dev:server

# Setup Convex backend (first time only)
bun dev:setup
```

### Building and Type Checking

```bash
# Build all applications for production
bun build

# Check TypeScript types across all apps
bun check-types

# Run Biome linter and formatter
bun check
```

### Desktop Development (Tauri)

```bash
# Navigate to web app directory first
cd apps/web

# Start Tauri desktop app in development
bun desktop:dev

# Build Tauri desktop app for production
bun desktop:build
```

### Testing

```bash
# Run tests (specific commands will depend on test setup)
bun test
```

## High-Level Architecture

### Project Structure

- **Monorepo** using Turborepo for optimized builds
- **apps/web**: Next.js 15 web application with App Router
  - **src/app**: App Router pages
  - **src/components**: Reusable UI components
  - **src/hooks**: Custom React hooks
  - **src/lib**: Utility functions
  - **src-tauri**: Tauri desktop application (Rust)
- **packages/backend**: Convex real-time backend
  - **convex**: Database schema and server functions
- **apps/fumadocs**: Documentation site

### Tech Stack Overview

- **Frontend**: Next.js 15, React 19, TypeScript 5.x (strict mode)
- **Styling**: Tailwind CSS 4 with glass morphism components
- **UI Components**: Radix UI + shadcn/ui
- **Backend**: Convex for real-time data synchronization
- **Desktop**: Tauri 2 for native desktop apps (Windows, macOS, Linux)
- **Web3**: Solana wallet integration via Phantom and Crossmint
- **Package Manager**: Bun (1.2.18+)
- **Code Quality**: Biome + Ultracite for linting/formatting

### Key Architectural Patterns

#### Server Components by Default

The app uses Next.js 15 App Router with Server Components as the default. Only use Client Components (`"use client"`) when you need:

- User interactions (onClick, onChange)
- Browser APIs
- React hooks (useState, useEffect)
- Third-party client libraries

#### Real-time Data with Convex

Convex provides reactive queries and mutations for real-time data sync:

- Use `useQuery` for reactive data fetching
- Use `useMutation` for data modifications
- Schema validation is built into Convex functions
- All Convex functions are in `packages/backend/convex`

#### TypeScript Configuration

- Strict mode is enabled
- Use interfaces over types for object shapes
- Explicit return types for functions
- Path alias `@/*` maps to `apps/web/src/*`

#### Component Structure Pattern

```typescript
// 1. Imports
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 2. Types
interface ComponentProps {
  // props definition
}

// 3. Component
export function Component({ ...props }: ComponentProps) {
  // 4. State & Hooks
  // 5. Effects
  // 6. Handlers
  // 7. Render
}
```

### Important Development Notes

1. **Port Configuration**: The web app runs on port 3000 (not 3001 as mentioned in README)
2. **Turbopack**: Development uses Turbopack for faster builds
3. **Environment Variables**: Create `.env.local` for configuration
4. **Desktop Development**: Always `cd apps/web` before running Tauri commands
5. **Code Style**: 2 spaces indentation, single quotes, trailing commas
6. **Commit Format**: `<type>(<scope>): <subject>` (feat, fix, docs, etc.)

### Code Style

- Use TypeScript strict mode
- Prefer interfaces over types for objects
- Use `satisfies` operator for type-safe constants
- Keep components focused and under 200 lines
- Never use "any" types unless 100% necessary
- Always define types, always follow strict type rules
- Do not worry about just getting it working, if it works but has poor type safety we don't want it
- Always generate code with strict type safety as a forethought

### Web3 Integration

- Solana wallet support with Phantom and Crossmint
- Use `@crossmint/client-sdk-react-ui` for wallet UI
- Handle wallet connections and transactions gracefully
- Test on devnet before mainnet deployment

### Performance Targets

- Load Time: <3s on 3G, <1s on WiFi
- Bundle Size: <500KB initial, <2MB total
- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1

### Testing Approach

- Unit tests for utilities and hooks
- Integration tests for API endpoints
- E2E tests for critical user paths
- Aim for ≥80% unit test coverage

## OpenAI Models

- gpt-4.1-nano
- text-embedding-3-large
- gpt-4.1-nano-2025-04-14
- gpt-4.1-mini-2025-04-14
- gpt-4o-mini
- o4-mini

## Vercel AI SDK Types

- Correct SDK v5 types for AI integration
  - `AIStream` for streaming AI responses
  - `createStreamDataTransformer()` for data transformation
  - `OpenAIStream` for OpenAI specific stream handling
  - `StreamingTextResponse` for consistent streaming responses
  - `experimental_StreamData` for advanced streaming data management
