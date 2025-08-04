# SYMLog Platform Rules System

## Overview

This directory contains comprehensive rules for the SYMLog platform, organized by domain and technology. Each rule file is designed to be focused, linked, and efficient for AI context.

## Structure

```
.cursor/rules/
├── README.md                    # This file - rules overview
├── index.mdc                    # Main entry point with cross-references
├── core/                        # Core development patterns
│   ├── architecture.mdc         # Platform architecture patterns
│   ├── coding-standards.mdc     # General coding standards
│   ├── naming-conventions.mdc   # Naming and organization
│   └── security.mdc            # Security best practices
├── frameworks/                  # Framework-specific rules
│   ├── nextjs.mdc              # Next.js 15 App Router patterns
│   ├── react.mdc               # React 19 patterns and hooks
│   ├── typescript.mdc          # TypeScript strict patterns
│   └── tailwind.mdc            # Tailwind CSS 4 utility patterns
├── tools/                       # Development tools
│   ├── turbo.mdc               # Turborepo monorepo patterns
│   ├── biome.mdc               # Biome linting/formatting
│   ├── ultracite.mdc           # Ultracite code quality
│   └── testing.mdc             # Testing patterns and practices
├── features/                    # Feature-specific rules
│   ├── auth.mdc                # Authentication patterns
│   ├── ui-components.mdc       # UI component patterns
│   ├── data-fetching.mdc       # Data fetching patterns
│   └── desktop.mdc             # Tauri desktop patterns
└── quality/                     # Quality assurance
    ├── kluster-verify.mdc      # Kluster verification
    ├── accessibility.mdc        # Accessibility standards
    └── performance.mdc         # Performance patterns
```

## Platform Overview

SYMLog is a modern monorepo platform with:

- **Next.js 15** web applications (App Router)
- **React 19** with latest features and Server Components
- **TypeScript** strict configuration
- **Tailwind CSS 4** utility-first styling
- **Turborepo** monorepo management
- **Convex** reactive backend
- **Tauri 2** desktop applications
- **Biome + Ultracite** code quality tools

## Rule Application Strategy

### File-Based Application

Rules are applied based on file patterns:

- `**/*.{ts,tsx}` - TypeScript files
- `**/*.{js,jsx}` - JavaScript files
- `**/*.css` - Stylesheet files
- `**/*.md` - Documentation files

### Context-Based Application

Rules are applied based on:

- Directory structure (apps/, packages/)
- File content (imports, patterns)
- Project stage (development, production)

### Cross-Referencing

Use `@filename` syntax to reference related rules:

```markdown
See @frameworks/nextjs.mdc for App Router patterns
Refer to @core/security.mdc for authentication guidelines
```

## Development Workflow

### 1. Code Generation

- Follow **@core/coding-standards.mdc** for general patterns
- Apply **@frameworks/typescript.mdc** for type safety
- Use **@frameworks/react.mdc** for component patterns
- Reference **@frameworks/nextjs.mdc** for App Router patterns

### 2. Component Development

- Follow **@features/ui-components.mdc** for component design
- Apply **@quality/accessibility.mdc** for a11y compliance
- Use **@frameworks/tailwind.mdc** for styling patterns
- Reference **@core/naming-conventions.mdc** for naming

### 3. Data Management

- Follow **@features/data-fetching.mdc** for data patterns
- Apply **@core/security.mdc** for data security
- Use **@frameworks/react.mdc** for state management
- Reference **@quality/performance.mdc** for optimization

### 4. Testing & Quality

- Follow **@tools/testing.mdc** for testing patterns
- Apply **@quality/kluster-verify.mdc** for verification
- Use **@tools/biome.mdc** for linting
- Reference **@tools/ultracite.mdc** for code quality

## Common Patterns

### Component Structure

```tsx
// Follow @features/ui-components.mdc
interface ComponentProps {
  // Follow @frameworks/typescript.mdc
}

export function Component({ ...props }: ComponentProps) {
  // Follow @frameworks/react.mdc
  return (
    // Follow @frameworks/tailwind.mdc
  );
}
```

### Data Fetching

```tsx
// Follow @features/data-fetching.mdc
// Apply @core/security.mdc
// Reference @quality/performance.mdc
```

### File Organization

```
// Follow @core/naming-conventions.mdc
// Reference @core/architecture.mdc
```

## Quality Gates

### Pre-Development

1. Review relevant rule files
2. Understand cross-dependencies
3. Plan implementation approach

### During Development

1. Apply appropriate rules
2. Cross-reference related patterns
3. Maintain consistency

### Post-Development

1. Run **@quality/kluster-verify.mdc**
2. Apply **@tools/biome.mdc** formatting
3. Validate against **@tools/ultracite.mdc**

## Rule Maintenance

### Monthly Reviews

- Update rules based on new best practices
- Remove obsolete patterns
- Add new framework features
- Validate rule effectiveness

### Rule Updates

- Test rules with real code
- Validate cross-references
- Update examples and patterns
- Maintain backward compatibility

## Emergency Overrides

When rules conflict or need temporary override:

1. Document the override reason
2. Create a temporary rule file
3. Plan permanent rule update
4. Remove temporary rule after resolution

## Support

For rule-related questions:

1. Check the specific rule file first
2. Review cross-references
3. Consult the README.md
4. Update rules if gaps are found

## Version History

- **v2.0.0**: Complete rewrite with modern patterns
- **v2.1.0**: Added React 19 and Next.js 15 patterns
- **v2.2.0**: Enhanced cross-referencing system
- **v2.3.0**: Added quality assurance rules
- **v2.4.0**: Updated for 2024/2025 best practices
