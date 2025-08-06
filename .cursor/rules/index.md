# SYMLog Cursor Rules Index

This directory contains modular rule files for the SYMLog platform. Each file focuses on specific aspects of development, making it easy to find and update relevant guidelines.

## 📋 Table of Contents

### 🎯 Core Principles
| File | Description | Key Topics |
|------|-------------|------------|
| [global.mdc](./global.mdc) | Project-wide conventions | Naming, structure, workflow |
| [core/architecture.mdc](./core/architecture.mdc) | System design patterns | Clean architecture, DDD, microservices |
| [core/security.mdc](./core/security.mdc) | Security best practices | OWASP, authentication, encryption |
| [core/performance.mdc](./core/performance.mdc) | Performance optimization | Metrics, caching, optimization |
| [core/quality.mdc](./core/quality.mdc) | Code quality standards | SOLID, DRY, clean code |

### 🎨 Frontend Development
| File | Description | Key Topics |
|------|-------------|------------|
| [frontend/react.mdc](./frontend/react.mdc) | React 19 patterns | Hooks, Server Components, RSC |
| [frontend/nextjs.mdc](./frontend/nextjs.mdc) | Next.js 15 conventions | App Router, SSR, ISR |
| [frontend/typescript.mdc](./frontend/typescript.mdc) | TypeScript guidelines | Strict mode, types, generics |
| [frontend/tailwind.mdc](./frontend/tailwind.mdc) | Styling conventions | Utility classes, themes |
| [frontend/ui-components.mdc](./frontend/ui-components.mdc) | Component standards | Accessibility, patterns |

### 🔧 Backend Development
| File | Description | Key Topics |
|------|-------------|------------|
| [backend/api.mdc](./backend/api.mdc) | API design patterns | REST, GraphQL, versioning |
| [backend/convex.mdc](./backend/convex.mdc) | Convex integration | Real-time, queries, mutations |
| [backend/real-time.mdc](./backend/real-time.mdc) | Real-time features | WebSockets, SSE, pub/sub |

### 🖥️ Desktop Development
| File | Description | Key Topics |
|------|-------------|------------|
| [desktop/tauri.mdc](./desktop/tauri.mdc) | Tauri 2 patterns | IPC, security, packaging |

### 🌐 Web3 Integration
| File | Description | Key Topics |
|------|-------------|------------|
| [web3/solana.mdc](./web3/solana.mdc) | Solana blockchain | Wallets, transactions, programs |
| [web3/crossmint.mdc](./web3/crossmint.mdc) | Crossmint integration | NFTs, payments, auth |

### 🧪 Testing Standards
| File | Description | Key Topics |
|------|-------------|------------|
| [testing/unit.mdc](./testing/unit.mdc) | Unit testing | Jest, RTL, coverage |
| [testing/integration.mdc](./testing/integration.mdc) | Integration testing | API, database, mocks |
| [testing/e2e.mdc](./testing/e2e.mdc) | E2E testing | Playwright, scenarios |

### 📊 Quality Assurance
| File | Description | Key Topics |
|------|-------------|------------|
| [quality/code-review.mdc](./quality/code-review.mdc) | Review process | Checklists, standards |
| [quality/documentation.mdc](./quality/documentation.mdc) | Documentation standards | README, API docs, ADRs |
| [quality/metrics.mdc](./quality/metrics.mdc) | Metrics & monitoring | KPIs, dashboards, alerts |

### 🚀 DevOps & Infrastructure
| File | Description | Key Topics |
|------|-------------|------------|
| [devops/ci-cd.mdc](./devops/ci-cd.mdc) | CI/CD pipelines | GitHub Actions, automation |
| [devops/deployment.mdc](./devops/deployment.mdc) | Deployment strategies | Docker, K8s, blue-green |
| [devops/infrastructure.mdc](./devops/infrastructure.mdc) | Infrastructure as Code | Terraform, AWS, monitoring |

## 🔍 Quick Reference

### By Technology
- **React**: [react.mdc](./frontend/react.mdc)
- **Next.js**: [nextjs.mdc](./frontend/nextjs.mdc)
- **TypeScript**: [typescript.mdc](./frontend/typescript.mdc)
- **Tailwind**: [tailwind.mdc](./frontend/tailwind.mdc)
- **Convex**: [convex.mdc](./backend/convex.mdc)
- **Tauri**: [tauri.mdc](./desktop/tauri.mdc)
- **Solana**: [solana.mdc](./web3/solana.mdc)

### By Task
- **Starting a new feature**: [architecture.mdc](./core/architecture.mdc), [typescript.mdc](./frontend/typescript.mdc)
- **Creating components**: [ui-components.mdc](./frontend/ui-components.mdc), [react.mdc](./frontend/react.mdc)
- **API development**: [api.mdc](./backend/api.mdc), [convex.mdc](./backend/convex.mdc)
- **Writing tests**: [unit.mdc](./testing/unit.mdc), [integration.mdc](./testing/integration.mdc)
- **Deployment**: [deployment.mdc](./devops/deployment.mdc), [ci-cd.mdc](./devops/ci-cd.mdc)
- **Code review**: [code-review.mdc](./quality/code-review.mdc)

### By Concern
- **Performance**: [performance.mdc](./core/performance.mdc), [metrics.mdc](./quality/metrics.mdc)
- **Security**: [security.mdc](./core/security.mdc), [tauri.mdc](./desktop/tauri.mdc)
- **Quality**: [quality.mdc](./core/quality.mdc), [code-review.mdc](./quality/code-review.mdc)
- **Real-time**: [real-time.mdc](./backend/real-time.mdc), [convex.mdc](./backend/convex.mdc)

## 📝 Rule File Format

All rule files follow the MDC (Markdown Components) format:

```yaml
---
description: "Brief description of what this file covers"
globs: 
  - "**/*.{ts,tsx}"  # File patterns this rule applies to
alwaysApply: true   # Whether to always apply these rules
---

# Rule Category

## Philosophy
Core principles and reasoning

## Standards
Specific requirements and patterns

## Examples
Code examples and anti-patterns

## References
Links to documentation and resources
```

## 🔄 Maintenance

- Rules are versioned with the project
- Update rules when adopting new patterns
- Remove outdated practices promptly
- Document reasoning for changes
- Review quarterly for relevance

---

Last Updated: August 2025