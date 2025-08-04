# Windsurf Code Generation Patterns

## Overview

This file defines code generation patterns, templates, and scaffolding rules for Windsurf AI to use when creating code for the SYMLog platform. These patterns ensure consistency, best practices, and alignment with our tech stack.

## Core Generation Principles

### 1. **Type-First Development**
All generated code should prioritize TypeScript strict mode with comprehensive type safety.

### 2. **Framework-Aware Generation**
Code generation must understand and leverage:
- Next.js 15 App Router patterns
- React 19 concurrent features
- Server Components vs Client Components
- Tauri 2 command integration

### 3. **Consistency with Existing Patterns**
Generated code should match existing SYMLog patterns and conventions.

### 4. **Production-Ready Code**
All generated code includes error handling, accessibility, and performance considerations.

## React Component Templates

### Functional Component Template
```typescript
// Template: functional-component
interface {ComponentName}Props {
  {props_with_types}
  className?: string;
  children?: React.ReactNode;
}

export function {ComponentName}({
  {destructured_props},
  className,
  children,
  ...props
}: {ComponentName}Props) {
  return (
    <{html_element}
      className={cn(
        "{base_tailwind_classes}",
        className
      )}
      {...props}
    >
      {jsx_content}
      {children}
    </{html_element}>
  );
}

{ComponentName}.displayName = "{ComponentName}";
```

### Client Component Template
```typescript
// Template: client-component
"use client";

import { {required_imports} } from "react";
import { cn } from "@/lib/utils";

interface {ComponentName}Props {
  {props_with_types}
}

export function {ComponentName}({ {destructured_props} }: {ComponentName}Props) {
  const [{state_name}, set{StateName}] = useState<{StateType}>({initial_value});

  {useEffect_if_needed}

  const handle{EventName} = useCallback(({parameters}) => {
    {event_handler_logic}
  }, [{dependencies}]);

  return (
    <div className={cn("{container_classes}")}>
      {jsx_content}
    </div>
  );
}
```

### Server Component Template
```typescript
// Template: server-component
import { {server_imports} } from "{import_paths}";
import { notFound } from "next/navigation";

interface {ComponentName}Props {
  {server_props_with_types}
}

export default async function {ComponentName}({
  {destructured_props}
}: {ComponentName}Props) {
  const data = await {async_data_fetching};

  if (!data) {
    notFound();
  }

  return (
    <div className="{server_component_classes}">
      {server_rendered_content}
    </div>
  );
}

export async function generateMetadata({
  {metadata_props}
}: {ComponentName}Props): Promise<Metadata> {
  return {
    title: "{dynamic_title}",
    description: "{dynamic_description}",
  };
}
```

### Polymorphic Component Template
```typescript
// Template: polymorphic-component
import React from "react";
import { cn } from "@/lib/utils";

type {ComponentName}Element = React.ElementRef<"div">;

interface {ComponentName}BaseProps {
  {base_props}
}

type {ComponentName}Props<T extends React.ElementType = "div"> = 
  {ComponentName}BaseProps & 
  Omit<React.ComponentPropsWithoutRef<T>, keyof {ComponentName}BaseProps> & {
    as?: T;
  };

const {ComponentName} = React.forwardRef<{ComponentName}Element, {ComponentName}Props>(
  ({ as: Component = "div", className, {other_props}, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn("{base_classes}", className)}
        {...props}
      >
        {content}
      </Component>
    );
  }
);

{ComponentName}.displayName = "{ComponentName}";

export { {ComponentName} };
export type { {ComponentName}Props };
```

## Next.js Templates

### Page Template
```typescript
// Template: nextjs-page
import { Metadata } from "next";
import { {required_components} } from "@/components/{category}";

interface {PageName}PageProps {
  params: { {route_params} };
  searchParams: { {search_params} };
}

export async function generateMetadata({
  params,
  searchParams
}: {PageName}PageProps): Promise<Metadata> {
  return {
    title: "{page_title}",
    description: "{page_description}",
  };
}

export default async function {PageName}Page({
  params,
  searchParams
}: {PageName}PageProps) {
  {async_data_fetching}

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">{page_title}</h1>
        <p className="text-xl text-muted-foreground mt-2">
          {page_description}
        </p>
      </div>
      
      <main>
        {page_content}
      </main>
    </div>
  );
}
```

### Layout Template
```typescript
// Template: nextjs-layout
import { {required_imports} } from "@/components/{category}";

interface {LayoutName}LayoutProps {
  children: React.ReactNode;
  {additional_props}
}

export default function {LayoutName}Layout({
  children,
  {other_props}
}: {LayoutName}LayoutProps) {
  return (
    <div className="{layout_container_classes}">
      {layout_header}
      
      <main className="{main_classes}">
        {children}
      </main>
      
      {layout_footer}
    </div>
  );
}
```

### API Route Template
```typescript
// Template: nextjs-api-route
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { {required_imports} } from "@/lib/{modules}";

// Request validation schema
const {requestName}Schema = z.object({
  {validation_schema}
});

// Response type
interface {ResponseName}Response {
  {response_properties}
}

export async function {HTTP_METHOD}(
  request: NextRequest,
  { params }: { params: { {param_types} } }
) {
  try {
    // Parse and validate request body (for POST/PUT/PATCH)
    {request_parsing}

    // Business logic
    {api_implementation}

    return NextResponse.json<{ResponseName}Response>(
      { {success_response} },
      { status: {success_status} }
    );
  } catch (error) {
    console.error(`${HTTP_METHOD} /{endpoint} error:`, error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Middleware Template
```typescript
// Template: nextjs-middleware
import { NextRequest, NextResponse } from "next/server";
import { {auth_imports} } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // {middleware_description}
  {middleware_logic}
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "{path_patterns}"
  ],
};
```

## Hook Templates

### Custom Hook Template
```typescript
// Template: custom-hook
"use client";

import { {hook_imports} } from "react";
import { {additional_imports} } from "{import_paths}";

interface Use{HookName}Options {
  {hook_options}
}

interface Use{HookName}Return {
  {return_properties}
}

export function use{HookName}({
  {destructured_options}
}: Use{HookName}Options = {}): Use{HookName}Return {
  const [{state_name}, set{StateName}] = useState<{StateType}>({initial_state});
  const [{loading_state}, setLoading] = useState(false);
  const [{error_state}, setError] = useState<Error | null>(null);

  {additional_state}

  const {primary_function} = useCallback(async ({parameters}) => {
    try {
      setLoading(true);
      setError(null);
      
      {hook_implementation}
      
      return {success_return};
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      setError(errorMessage);
      throw errorMessage;
    } finally {
      setLoading(false);
    }
  }, [{dependencies}]);

  useEffect(() => {
    {effect_logic}
  }, [{effect_dependencies}]);

  return {
    {return_object}
  };
}
```

### Data Fetching Hook Template
```typescript
// Template: data-fetching-hook
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { {api_imports} } from "@/lib/api";

interface Use{EntityName}QueryOptions {
  {query_options}
}

export function use{EntityName}Query({
  {destructured_options}
}: Use{EntityName}QueryOptions = {}) {
  return useQuery({
    queryKey: ["{entity_name}", {query_key_parts}],
    queryFn: () => {api_function}({query_params}),
    {additional_query_options}
  });
}

export function use{EntityName}Mutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: {mutation_function},
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({
        queryKey: ["{entity_name}"]
      });
      
      {success_side_effects}
    },
    onError: (error, variables) => {
      console.error("{EntityName} mutation error:", error);
      {error_side_effects}
    }
  });
}
```

## Convex Integration Templates

### Convex Query Hook Template
```typescript
// Template: convex-query-hook
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function use{EntityName}({
  {hook_parameters}
}: {
  {parameter_types}
}) {
  const {entity_name} = useQuery(
    api.{module_name}.{function_name},
    {query_args}
  );

  return {
    {entity_name},
    isLoading: {entity_name} === undefined,
    error: null // Convex handles errors differently
  };
}
```

### Convex Mutation Hook Template
```typescript
// Template: convex-mutation-hook
"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useState } from "react";

export function use{EntityName}Mutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {mutation_name} = useMutation(api.{module_name}.{function_name});

  const {action_name} = useCallback(async ({parameters}) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await {mutation_name}({mutation_args});
      
      {success_handling}
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [{dependencies}]);

  return {
    {action_name},
    isLoading,
    error
  };
}
```

### Convex Schema Template
```typescript
// Template: convex-schema
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  {table_name}: defineTable({
    {field_definitions}
  })
    {indexes}
    {search_indexes},
});
```

### Convex Function Template
```typescript
// Template: convex-function
import { v } from "convex/values";
import { {function_type} } from "./_generated/server";

export const {function_name} = {function_type}({
  args: {
    {argument_definitions}
  },
  handler: async (ctx, args) => {
    {function_implementation}
  }
});
```

## Tauri Integration Templates

### Tauri Command Template (Rust)
```rust
// Template: tauri-command
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct {CommandName}Request {
    {request_fields}
}

#[derive(Debug, Serialize)]
pub struct {CommandName}Response {
    {response_fields}
}

#[command]
pub async fn {command_name}(
    {parameters}: {CommandName}Request
) -> Result<{CommandName}Response, String> {
    {command_implementation}
    
    Ok({CommandName}Response {
        {response_construction}
    })
}
```

### Tauri Hook Template (TypeScript)
```typescript
// Template: tauri-hook
"use client";

import { invoke } from "@tauri-apps/api/tauri";
import { useState, useCallback } from "react";

interface {CommandName}Request {
  {request_interface}
}

interface {CommandName}Response {
  {response_interface}
}

export function use{CommandName}() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {command_name} = useCallback(async (
    {parameters}: {CommandName}Request
  ): Promise<{CommandName}Response> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await invoke<{CommandName}Response>(
        "{command_name}",
        { {invoke_parameters} }
      );
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    {command_name},
    isLoading,
    error
  };
}
```

## UI Component Templates

### shadcn/ui Component Template
```typescript
// Template: shadcn-component
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const {component_name}Variants = cva(
  "{base_classes}",
  {
    variants: {
      variant: {
        {variant_definitions}
      },
      size: {
        {size_definitions}
      },
    },
    defaultVariants: {
      variant: "{default_variant}",
      size: "{default_size}",
    },
  }
);

export interface {ComponentName}Props
  extends React.{HTMLElement}Attributes<HTML{Element}Element>,
    VariantProps<typeof {component_name}Variants> {
  asChild?: boolean;
}

const {ComponentName} = React.forwardRef<
  HTML{Element}Element,
  {ComponentName}Props
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "{html_element}";
  
  return (
    <Comp
      className={cn({component_name}Variants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});

{ComponentName}.displayName = "{ComponentName}";

export { {ComponentName}, {component_name}Variants };
```

### Form Component Template
```typescript
// Template: form-component
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { {form_controls} } from "@/components/ui/{form_control_imports}";

const {form_name}Schema = z.object({
  {schema_fields}
});

type {FormName}Values = z.infer<typeof {form_name}Schema>;

interface {FormName}Props {
  {form_props}
  onSubmit: (values: {FormName}Values) => Promise<void> | void;
}

export function {FormName}({ {destructured_props}, onSubmit }: {FormName}Props) {
  const form = useForm<{FormName}Values>({
    resolver: zodResolver({form_name}Schema),
    defaultValues: {
      {default_values}
    },
  });

  const handleSubmit = async (values: {FormName}Values) => {
    try {
      await onSubmit(values);
      form.reset();
    } catch (error) {
      console.error("Form submission error:", error);
      // Handle error (show toast, set form error, etc.)
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {form_fields}
        
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Submitting..." : "{submit_label}"}
        </Button>
      </form>
    </Form>
  );
}
```

## Testing Templates

### Component Test Template
```typescript
// Template: component-test
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { {ComponentName} } from "./{component-name}";

describe("{ComponentName}", () => {
  const defaultProps = {
    {default_test_props}
  };

  it("renders correctly", () => {
    render(<{ComponentName} {...defaultProps} />);
    
    expect(screen.getByRole("{primary_role}")).toBeInTheDocument();
    {additional_render_assertions}
  });

  it("handles user interactions", async () => {
    const mockHandler = jest.fn();
    render(<{ComponentName} {...defaultProps} {event_prop}={mockHandler} />);
    
    fireEvent.{event_type}(screen.getByRole("{interactive_element}"));
    
    await waitFor(() => {
      expect(mockHandler).toHaveBeenCalledWith({expected_args});
    });
  });

  it("displays error states correctly", () => {
    render(<{ComponentName} {...defaultProps} error="{test_error}" />);
    
    expect(screen.getByText("{test_error}")).toBeInTheDocument();
    {error_state_assertions}
  });

  it("handles loading states", () => {
    render(<{ComponentName} {...defaultProps} isLoading={true} />);
    
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    {loading_state_assertions}
  });
});
```

### API Route Test Template
```typescript
// Template: api-route-test
import { NextRequest } from "next/server";
import { {HTTP_METHOD} } from "./route";

describe("/api/{endpoint}", () => {
  describe("{HTTP_METHOD}", () => {
    it("returns success response with valid data", async () => {
      const request = new NextRequest("http://localhost:3000/api/{endpoint}", {
        method: "{HTTP_METHOD}",
        {request_options}
      });

      const response = await {HTTP_METHOD}(request, {
        params: { {test_params} }
      });

      expect(response.status).toBe({success_status});
      
      const data = await response.json();
      expect(data).toEqual({
        {expected_response}
      });
    });

    it("returns error response with invalid data", async () => {
      const request = new NextRequest("http://localhost:3000/api/{endpoint}", {
        method: "{HTTP_METHOD}",
        {invalid_request_options}
      });

      const response = await {HTTP_METHOD}(request, {
        params: { {test_params} }
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});
```

## Documentation Templates

### Component Documentation Template
```markdown
# {ComponentName}

{Component description and purpose}

## Usage

\`\`\`tsx
import { {ComponentName} } from "@/components/{category}/{component-name}";

function Example() {
  return (
    <{ComponentName}
      {example_props}
    />
  );
}
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
{props_table}

## Variants

{variant_descriptions}

## Examples

### Basic Usage
\`\`\`tsx
{basic_example}
\`\`\`

### Advanced Usage
\`\`\`tsx
{advanced_example}
\`\`\`

## Accessibility

{accessibility_notes}

## Styling

{styling_information}
```

### API Documentation Template
```markdown
# {API_NAME} API

{API description and purpose}

## Endpoint

\`{HTTP_METHOD} /api/{endpoint}\`

## Request

### Parameters

{parameter_documentation}

### Body

\`\`\`typescript
{request_interface}
\`\`\`

## Response

### Success Response

\`\`\`typescript
{success_response_interface}
\`\`\`

### Error Response

\`\`\`typescript
{error_response_interface}
\`\`\`

## Examples

### Success Example

\`\`\`bash
{curl_success_example}
\`\`\`

\`\`\`json
{success_response_example}
\`\`\`

### Error Example

\`\`\`bash
{curl_error_example}
\`\`\`

\`\`\`json
{error_response_example}
\`\`\`

## Client Usage

\`\`\`typescript
{client_usage_example}
\`\`\`
```

## Configuration Generation

### TypeScript Config Template
```json
// Template: tsconfig
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

### Package.json Template
```json
// Template: package-json
{
  "name": "@symlog/{package_name}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    {package_scripts}
  },
  "dependencies": {
    {production_dependencies}
  },
  "devDependencies": {
    {development_dependencies}
  },
  "peerDependencies": {
    {peer_dependencies}
  }
}
```

## Generation Rules

### Context-Aware Generation
1. **File Location Analysis**: Generate appropriate imports based on file location
2. **Existing Pattern Detection**: Match existing code patterns in the project
3. **Dependency Analysis**: Include necessary dependencies and imports
4. **Type Safety**: Ensure all generated code is type-safe
5. **Accessibility**: Include ARIA attributes and semantic HTML
6. **Performance**: Generate optimized code with proper memoization
7. **Error Handling**: Include comprehensive error handling
8. **Testing**: Generate corresponding test files when requested

### Quality Standards
1. **Consistency**: Match existing code style and patterns
2. **Maintainability**: Generate readable and maintainable code
3. **Documentation**: Include JSDoc comments for complex functions
4. **Security**: Implement secure coding practices
5. **Performance**: Optimize for performance and bundle size