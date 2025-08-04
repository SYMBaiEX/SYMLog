# Windsurf AI Assistance Configuration

## Overview

This file configures Windsurf's AI features (Cascade, Supercomplete, AI Flows) specifically for the SYMLog platform development. These settings optimize AI assistance for our Next.js 15, React 19, TypeScript, and Tauri monorepo.

## Cascade AI Agent Configuration

### Core Agent Behavior

```yaml
cascade:
  mode: "intelligent" # intelligent, conservative, aggressive
  context_depth: "deep" # shallow, medium, deep, comprehensive
  auto_execution: true
  iterative_debugging: true
  multi_file_operations: true
  production_safe: true
```

### SYMLog-Specific Patterns

#### Framework Recognition
```typescript
// Cascade understands these SYMLog patterns automatically
const FRAMEWORK_PATTERNS = {
  "nextjs": {
    "app_router": true,
    "server_components": true,
    "version": "15.x",
    "patterns": [
      "app/**/*.tsx", 
      "app/**/*.ts",
      "middleware.ts"
    ]
  },
  "react": {
    "version": "19.x",
    "concurrent_features": true,
    "server_components": true,
    "use_client_directive": true
  },
  "tauri": {
    "version": "2.x",
    "commands": "src-tauri/src/**/*.rs",
    "config": "src-tauri/tauri.conf.json"
  }
}
```

#### Context Awareness
```typescript
// Cascade maintains context for these SYMLog areas
const CONTEXT_AREAS = {
  "authentication": {
    "convex_auth": "convex/auth.ts",
    "middleware": "src/middleware.ts",
    "crossmint": "components/crossmint-*.tsx"
  },
  "ui_components": {
    "shadcn": "components/ui/**/*.tsx",
    "custom": "components/**/*.tsx",
    "themes": "theme-provider.tsx"
  },
  "desktop": {
    "tauri_commands": "src-tauri/src/**/*.rs",
    "frontend_integration": "components/tauri-*.tsx"
  }
}
```

### Intelligent Code Understanding

#### Type System Integration
```typescript
// Cascade understands SYMLog type patterns
interface CascadeTypeAwareness {
  // Convex schema types
  convex_types: {
    documents: "convex/_generated/dataModel.d.ts",
    api: "convex/_generated/api.d.ts"
  },
  
  // Component prop patterns
  component_props: {
    base: "React.ComponentPropsWithoutRef<'element'>",
    forwarded_ref: "React.ForwardedRef<HTMLElement>",
    polymorphic: "As extends React.ElementType"
  },
  
  // API route patterns
  api_routes: {
    request: "Request",
    response: "Response | NextResponse",
    params: "{ params: { [key: string]: string } }"
  }
}
```

#### Smart Imports and Dependencies
```typescript
// Cascade automatically suggests correct imports for SYMLog
const SMART_IMPORTS = {
  // UI Components
  "Button": "import { Button } from '@/components/ui/button'",
  "Card": "import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'",
  
  // Utilities
  "cn": "import { cn } from '@/lib/utils'",
  "clsx": "import { clsx } from 'clsx'",
  
  // React patterns
  "useState": "import { useState } from 'react'",
  "useEffect": "import { useEffect } from 'react'",
  
  // Next.js patterns
  "Image": "import Image from 'next/image'",
  "Link": "import Link from 'next/link'",
  "notFound": "import { notFound } from 'next/navigation'",
  
  // Convex
  "useQuery": "import { useQuery } from 'convex/react'",
  "useMutation": "import { useMutation } from 'convex/react'",
  
  // Tauri
  "invoke": "import { invoke } from '@tauri-apps/api/tauri'"
}
```

## Supercomplete Configuration

### Intelligent Autocomplete Patterns

#### React Component Completion
```typescript
// Supercomplete patterns for SYMLog React components
const REACT_PATTERNS = {
  // Component scaffolding
  functional_component: `
interface {ComponentName}Props {
  {props}
}

export function {ComponentName}({ {destructured_props} }: {ComponentName}Props) {
  return (
    <div className="{tailwind_classes}">
      {jsx_content}
    </div>
  );
}`,

  // Hook patterns
  custom_hook: `
export function use{HookName}({parameters}) {
  const [state, setState] = useState({initial_state});
  
  useEffect(() => {
    {effect_logic}
  }, [{dependencies}]);
  
  return { {return_values} };
}`,

  // Context patterns
  context_provider: `
const {ContextName}Context = createContext<{ContextType} | undefined>(undefined);

export function {ContextName}Provider({ children }: { children: React.ReactNode }) {
  {provider_logic}
  
  return (
    <{ContextName}Context.Provider value={{ {values} }}>
      {children}
    </{ContextName}Context.Provider>
  );
}`
};
```

#### Next.js App Router Patterns
```typescript
// Supercomplete for Next.js App Router patterns
const NEXTJS_PATTERNS = {
  // Page component
  page: `
export default function {PageName}Page() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{page_title}</h1>
      {page_content}
    </div>
  );
}`,

  // Layout component
  layout: `
export default function {LayoutName}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="{layout_classes}">
      {layout_content}
      {children}
    </div>
  );
}`,

  // API route
  api_route: `
export async function {HTTP_METHOD}(
  request: Request,
  { params }: { params: { {param_types} } }
) {
  try {
    {api_logic}
    
    return NextResponse.json({ {success_response} });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`,

  // Server Component
  server_component: `
export default async function {ComponentName}({
  {server_props}
}: {
  {prop_types}
}) {
  const data = await {data_fetching};
  
  return (
    <div className="{container_classes}">
      {server_rendered_content}
    </div>
  );
}`
};
```

### Context-Aware Suggestions

#### Tailwind CSS Intelligence
```typescript
// Supercomplete understands SYMLog design system
const TAILWIND_PATTERNS = {
  // Common layout patterns
  container: "container mx-auto px-4 sm:px-6 lg:px-8",
  flex_center: "flex items-center justify-center",
  grid_responsive: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
  
  // Component-specific patterns
  button: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  card: "rounded-lg border bg-card text-card-foreground shadow-sm",
  input: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
};
```

#### Database and API Patterns
```typescript
// Supercomplete for Convex integration
const CONVEX_PATTERNS = {
  // Query patterns
  query: `
const {queryName} = useQuery(
  api.{module}.{functionName},
  {query_args}
);`,

  // Mutation patterns
  mutation: `
const {mutationName} = useMutation(api.{module}.{functionName});

const handle{Action} = async ({parameters}) => {
  try {
    await {mutationName}({mutation_args});
    {success_handling}
  } catch (error) {
    console.error('Mutation error:', error);
    {error_handling}
  }
};`,

  // Schema definition
  schema: `
export const {tableName} = defineTable({
  {field_definitions}
})
  .index("by_{field}", ["{field}"])
  {additional_indexes};`
};
```

## AI Flows Configuration

### Workflow Automation

#### Component Development Flow
```typescript
const COMPONENT_FLOW = {
  name: "Create SYMLog Component",
  steps: [
    {
      action: "scaffold_component",
      template: "functional_component_with_props",
      location: "components/{category}/{component-name}.tsx"
    },
    {
      action: "add_types",
      template: "typescript_interface",
      strict_mode: true
    },
    {
      action: "apply_styling",
      framework: "tailwind",
      design_system: "shadcn"
    },
    {
      action: "add_tests",
      testing_framework: "jest",
      test_type: "unit"
    },
    {
      action: "update_exports",
      barrel_export: true,
      location: "components/index.ts"
    }
  ]
};
```

#### API Development Flow
```typescript
const API_FLOW = {
  name: "Create Next.js API Route",
  steps: [
    {
      action: "create_route_file",
      location: "app/api/{endpoint}/route.ts",
      template: "nextjs_app_router_api"
    },
    {
      action: "add_validation",
      schema_library: "zod",
      validate_input: true,
      validate_output: true
    },
    {
      action: "add_error_handling",
      pattern: "try_catch_nextresponse",
      logging: "console.error"
    },
    {
      action: "add_types",
      request_types: true,
      response_types: true,
      export_types: true
    },
    {
      action: "create_client_hook",
      location: "hooks/use-{endpoint}.ts",
      pattern: "react_query_or_swr"
    }
  ]
};
```

### Multi-File Operations

#### Refactoring Flows
```typescript
const REFACTORING_FLOWS = {
  // Extract component from JSX
  extract_component: {
    trigger: "selection_with_jsx",
    steps: [
      "analyze_dependencies",
      "extract_to_new_file",
      "update_imports",
      "add_prop_interface",
      "replace_original_code"
    ]
  },
  
  // Move component between directories
  move_component: {
    trigger: "drag_and_drop_or_command",
    steps: [
      "update_file_location",
      "update_all_imports",
      "update_barrel_exports",
      "run_type_check",
      "run_tests"
    ]
  },
  
  // Convert class to functional component
  modernize_component: {
    trigger: "class_component_detected",
    steps: [
      "extract_state_to_hooks",
      "convert_lifecycle_to_effects",
      "update_event_handlers",
      "add_typescript_types",
      "run_tests_and_verify"
    ]
  }
};
```

## Interactive Development Features

### Live Preview Integration
```typescript
const PREVIEW_CONFIG = {
  // Next.js dev server integration
  nextjs: {
    url: "http://localhost:3000",
    auto_refresh: true,
    hot_reload: true,
    error_overlay: true
  },
  
  // Component preview
  storybook: {
    enabled: false, // Not used in SYMLog currently
    url: "http://localhost:6006"
  },
  
  // Desktop preview (Tauri)
  tauri: {
    command: "bun run tauri dev",
    auto_launch: false,
    debug_mode: true
  }
};
```

### Real-time Collaboration
```typescript
const COLLABORATION_CONFIG = {
  // AI pair programming settings
  pair_programming: {
    mode: "collaborative", // collaborative, assistive, autonomous
    review_changes: true,
    suggest_improvements: true,
    auto_format: true
  },
  
  // Code review assistance
  code_review: {
    auto_suggest_improvements: true,
    highlight_potential_issues: true,
    security_analysis: true,
    performance_analysis: true
  }
};
```

## Context Management

### Codebase Indexing
```typescript
const INDEXING_CONFIG = {
  // File inclusion patterns
  include: [
    "src/**/*.{ts,tsx,js,jsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "convex/**/*.ts",
    "src-tauri/src/**/*.rs",
    "*.config.{js,ts,mjs}",
    "package.json",
    "tsconfig.json"
  ],
  
  // File exclusion patterns
  exclude: [
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "target/**",
    ".git/**",
    "*.min.js",
    "coverage/**"
  ],
  
  // Special handling
  priority_files: [
    "src/app/layout.tsx",
    "src/middleware.ts",
    "convex/schema.ts",
    "convex/auth.ts",
    "src-tauri/tauri.conf.json"
  ]
};
```

### Memory Management
```typescript
const MEMORY_CONFIG = {
  // Context window management
  max_context_tokens: 100000,
  context_retention: "session", // session, persistent, temporary
  
  // Intelligent context selection
  context_strategy: "adaptive", // full, selective, adaptive
  relevance_threshold: 0.7,
  
  // Performance optimization
  lazy_loading: true,
  cache_frequent_patterns: true,
  background_indexing: true
};
```

## AI Model Configuration

### Model Selection
```typescript
const MODEL_CONFIG = {
  // Primary models for different tasks
  code_completion: "claude-3.5-sonnet", // Primary for complex reasoning
  quick_suggestions: "gpt-4-turbo", // Fast for simple completions
  code_review: "claude-3.5-sonnet", // Best for analysis
  documentation: "gpt-4", // Good for explanations
  
  // Task-specific routing
  routing: {
    "typescript_analysis": "claude-3.5-sonnet",
    "react_patterns": "claude-3.5-sonnet",
    "tailwind_suggestions": "gpt-4-turbo",
    "rust_tauri": "claude-3.5-sonnet",
    "api_design": "claude-3.5-sonnet"
  }
};
```

### Response Configuration
```typescript
const RESPONSE_CONFIG = {
  // Response preferences
  verbosity: "balanced", // brief, balanced, detailed
  include_explanations: true,
  suggest_alternatives: true,
  highlight_best_practices: true,
  
  // Code style preferences
  typescript_strict: true,
  prefer_functional_components: true,
  use_modern_react_patterns: true,
  tailwind_utility_first: true,
  
  // Error handling
  always_include_error_handling: true,
  suggest_type_safety_improvements: true,
  recommend_performance_optimizations: true
};
```

## Performance Optimization

### Intelligent Caching
```typescript
const CACHING_CONFIG = {
  // AI response caching
  cache_responses: true,
  cache_duration: "1h",
  
  // Context caching
  cache_context: true,
  context_cache_size: "100MB",
  
  // Pattern caching
  cache_patterns: true,
  common_patterns_priority: true
};
```

### Resource Management
```typescript
const RESOURCE_CONFIG = {
  // Concurrent requests
  max_concurrent_requests: 3,
  request_timeout: "30s",
  
  // Background processing
  background_analysis: true,
  preemptive_suggestions: true,
  
  // Performance monitoring
  monitor_response_times: true,
  adaptive_model_selection: true
};
```