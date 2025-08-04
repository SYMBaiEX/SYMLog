# Windsurf Workspace Configuration

## Overview

This file defines workspace settings, IDE preferences, and development environment configuration optimized for the SYMLog platform in Windsurf IDE.

## Workspace Structure

### Monorepo Organization
```
SYMLog/
├── .windsurf/                  # Windsurf IDE configuration
│   ├── cascade                 # Main Windsurf config
│   └── rules/                  # Rule definitions
├── apps/                       # Applications
│   ├── auth-web/              # Authentication service (Next.js)
│   ├── fumadocs/              # Documentation (Fumadocs)
│   └── web/                   # Main app (Next.js + Tauri)
├── packages/                   # Shared packages
└── node_modules/              # Dependencies (workspace root)
```

### Workspace Detection
Windsurf should detect this as a monorepo with:
- **Package Manager**: Bun (primary), npm (fallback)
- **Workspace Manager**: Turborepo
- **Language**: TypeScript (strict mode)
- **Framework**: Next.js 15 + React 19

## Editor Settings

### Core Editor Configuration
```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false,
  "editor.trimAutoWhitespace": true,
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.organizeImports": true
  },
  "editor.defaultFormatter": "biomejs.biome",
  "editor.rulers": [80, 120],
  "editor.wordWrap": "bounded",
  "editor.wordWrapColumn": 120,
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": true,
  "editor.minimap.enabled": true,
  "editor.minimap.maxColumn": 120,
  "editor.renderWhitespace": "boundary",
  "editor.showFoldingControls": "always",
  "editor.foldingStrategy": "indentation",
  "editor.linkedEditing": true,
  "editor.suggest.insertMode": "replace",
  "editor.acceptSuggestionOnCommitCharacter": false,
  "editor.acceptSuggestionOnEnter": "on",
  "editor.suggestSelection": "first",
  "editor.quickSuggestions": {
    "other": true,
    "comments": false,
    "strings": true
  }
}
```

### File Association Configuration
```json
{
  "files.associations": {
    "*.mdx": "markdown",
    "*.mdc": "markdown",
    "*.css": "tailwindcss",
    "cascade": "yaml",
    ".env*": "dotenv",
    ".cursorrules": "yaml",
    "turbo.json": "jsonc",
    "biome.json": "jsonc",
    "bts.jsonc": "jsonc"
  },
  "files.exclude": {
    "**/.git": true,
    "**/.svn": true,
    "**/.hg": true,
    "**/CVS": true,
    "**/.DS_Store": true,
    "**/Thumbs.db": true,
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/build": true,
    "**/target": true,
    "**/.turbo": true,
    "**/*.tsbuildinfo": true
  },
  "files.watcherExclude": {
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/node_modules/**": true,
    "**/.next/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/target/**": true,
    "**/.turbo/**": true
  },
  "files.autoSave": "onFocusChange",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "files.trimFinalNewlines": true
}
```

## Language-Specific Settings

### TypeScript Configuration
```json
{
  "typescript.preferences.noSemicolons": "off",
  "typescript.preferences.quoteStyle": "double",
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "typescript.suggest.includeAutomaticOptionalChainCompletions": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.implementationsCodeLens.enabled": true,
  "typescript.referencesCodeLens.enabled": true,
  "typescript.preferences.useAliasesForRenames": false,
  "typescript.suggest.objectLiteralMethodSnippets.enabled": false,
  "typescript.inlayHints.enumMemberValues.enabled": true,
  "typescript.inlayHints.functionLikeReturnTypes.enabled": true,
  "typescript.inlayHints.parameterNames.enabled": "literals",
  "typescript.inlayHints.parameterTypes.enabled": true,
  "typescript.inlayHints.propertyDeclarationTypes.enabled": true,
  "typescript.inlayHints.variableTypes.enabled": false,
  "typescript.workspaceSymbols.scope": "currentProject"
}
```

### JavaScript Configuration
```json
{
  "javascript.preferences.noSemicolons": "off",
  "javascript.preferences.quoteStyle": "double",
  "javascript.suggest.autoImports": true,
  "javascript.updateImportsOnFileMove.enabled": "always",
  "javascript.validate.enable": true,
  "javascript.inlayHints.enumMemberValues.enabled": true,
  "javascript.inlayHints.functionLikeReturnTypes.enabled": true,
  "javascript.inlayHints.parameterNames.enabled": "literals",
  "javascript.inlayHints.parameterTypes.enabled": true,
  "javascript.inlayHints.propertyDeclarationTypes.enabled": true,
  "javascript.inlayHints.variableTypes.enabled": false
}
```

### CSS/Tailwind Configuration
```json
{
  "css.validate": true,
  "css.lint.unknownAtRules": "ignore",
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "tailwindCSS.classAttributes": [
    "class",
    "className",
    "classList",
    "containerClassName",
    "panelClassName",
    "contentClassName",
    "headerClassName",
    "sidebarClassName"
  ]
}
```

### Markdown Configuration
```json
{
  "markdown.preview.breaks": true,
  "markdown.preview.linkify": true,
  "markdown.preview.typographer": true,
  "markdown.extension.toc.levels": "2..6",
  "markdown.extension.toc.orderedList": false,
  "markdown.extension.toc.updateOnSave": true,
  "markdown.extension.preview.autoShowPreviewToSide": false
}
```

## Development Tools Integration

### Biome Integration
```json
{
  "biome.enabled": true,
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

### Git Integration
```json
{
  "git.enableSmartCommit": true,
  "git.confirmSync": false,
  "git.autofetch": true,
  "git.autofetchPeriod": 180,
  "git.decorations.enabled": true,
  "git.showPushSuccessNotification": true,
  "scm.diffDecorations": "all",
  "scm.diffDecorationsGutterVisibility": "hover",
  "gitlens.codeLens.enabled": true,
  "gitlens.currentLine.enabled": true,
  "gitlens.hovers.enabled": true,
  "gitlens.blame.highlight.enabled": true,
  "gitlens.changes.locations": ["gutter", "line", "overview"]
}
```

### Search Configuration
```json
{
  "search.exclude": {
    "**/node_modules": true,
    "**/bower_components": true,
    "**/*.code-search": true,
    "**/.next": true,
    "**/dist": true,
    "**/build": true,
    "**/target": true,
    "**/.turbo": true,
    "**/_generated": true,
    "**/*.tsbuildinfo": true,
    "**/coverage": true,
    "**/.nyc_output": true
  },
  "search.followSymlinks": false,
  "search.smartCase": true,
  "search.globalFindClipboard": false,
  "search.seedOnFocus": true,
  "search.seedWithNearestWord": false,
  "search.useGlobalIgnoreFiles": true,
  "search.useIgnoreFiles": true
}
```

## Debugging Configuration

### Next.js Debugging
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/apps/web/src"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/apps/web",
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

### Tauri Debugging
```json
{
  "configurations": [
    {
      "name": "Tauri Development Debug",
      "type": "lldb",
      "request": "launch",
      "program": "${workspaceFolder}/apps/web/src-tauri/target/debug/symlog-web",
      "args": [],
      "cwd": "${workspaceFolder}/apps/web",
      "environment": [
        {
          "name": "RUST_LOG",
          "value": "debug"
        }
      ]
    },
    {
      "name": "Tauri Frontend Debug",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:1420",
      "webRoot": "${workspaceFolder}/apps/web/src"
    }
  ]
}
```

### Convex Debugging
```json
{
  "configurations": [
    {
      "name": "Debug Convex Functions",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/convex",
      "args": ["dev", "--debug"],
      "cwd": "${workspaceFolder}/apps/web",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

## Terminal Configuration

### Integrated Terminal Settings
```json
{
  "terminal.integrated.defaultProfile.linux": "bash",
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "terminal.integrated.fontSize": 14,
  "terminal.integrated.fontFamily": "JetBrains Mono, Fira Code, Monaco, 'Courier New', monospace",
  "terminal.integrated.cursorBlinking": true,
  "terminal.integrated.cursorStyle": "line",
  "terminal.integrated.scrollback": 10000,
  "terminal.integrated.shell.linux": "/bin/bash",
  "terminal.integrated.cwd": "${workspaceFolder}",
  "terminal.integrated.env.linux": {
    "NODE_ENV": "development"
  },
  "terminal.integrated.profiles.linux": {
    "bash": {
      "path": "/bin/bash",
      "args": ["-l"]
    },
    "zsh": {
      "path": "/bin/zsh",
      "args": ["-l"]
    }
  }
}
```

### Task Configuration
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Install Dependencies",
      "type": "shell",
      "command": "bun",
      "args": ["install"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "Dev: All",
      "type": "shell",
      "command": "bun",
      "args": ["run", "dev"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "Dev: Web App",
      "type": "shell",
      "command": "bun",
      "args": ["run", "dev:web"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "Dev: Desktop (Tauri)",
      "type": "shell",
      "command": "bun",
      "args": ["run", "tauri", "dev"],
      "options": {
        "cwd": "${workspaceFolder}/apps/web"
      },
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    },
    {
      "label": "Build: All",
      "type": "shell",
      "command": "bun",
      "args": ["run", "build"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "Type Check",
      "type": "shell",
      "command": "bun",
      "args": ["run", "check-types"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "Lint & Format",
      "type": "shell",
      "command": "bun",
      "args": ["run", "check"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": []
    }
  ]
}
```

## Extensions and Plugins

### Recommended Extensions
```json
{
  "recommendations": [
    "biomejs.biome",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "eamodio.gitlens",
    "ms-vscode.vscode-json",
    "yzhang.markdown-all-in-one",
    "rust-lang.rust-analyzer",
    "tauri-apps.tauri-vscode",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-eslint",
    "streetsidesoftware.code-spell-checker",
    "gruntfuggly.todo-tree",
    "aaron-bond.better-comments",
    "PKief.material-icon-theme",
    "zhuangtongfa.Material-theme",
    "usernamehw.errorlens",
    "ms-vscode.vscode-thunder-client",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### Extension-Specific Settings
```json
{
  "errorLens.enabledDiagnosticLevels": ["error", "warning", "info"],
  "errorLens.messageMaxChars": 200,
  "errorLens.delay": 1000,
  "errorLens.onSave": true,
  "todo-tree.general.tags": [
    "BUG",
    "HACK",
    "FIXME",
    "TODO",
    "XXX",
    "[ ]",
    "[x]"
  ],
  "todo-tree.highlights.defaultHighlight": {
    "icon": "alert",
    "type": "tag",
    "foreground": "red",
    "background": "white",
    "opacity": 50,
    "iconColour": "blue"
  },
  "better-comments.multilineComments": true,
  "better-comments.highlightPlainText": false,
  "better-comments.tags": [
    {
      "tag": "!",
      "color": "#FF2D00",
      "strikethrough": false,
      "underline": false,
      "backgroundColor": "transparent",
      "bold": false,
      "italic": false
    },
    {
      "tag": "?",
      "color": "#3498DB",
      "strikethrough": false,
      "underline": false,
      "backgroundColor": "transparent",
      "bold": false,
      "italic": false
    },
    {
      "tag": "//",
      "color": "#474747",
      "strikethrough": true,
      "underline": false,
      "backgroundColor": "transparent",
      "bold": false,
      "italic": false
    },
    {
      "tag": "todo",
      "color": "#FF8C00",
      "strikethrough": false,
      "underline": false,
      "backgroundColor": "transparent",
      "bold": false,
      "italic": false
    },
    {
      "tag": "*",
      "color": "#98C379",
      "strikethrough": false,
      "underline": false,
      "backgroundColor": "transparent",
      "bold": false,
      "italic": false
    }
  ]
}
```

## Theme and Appearance

### UI Theme Configuration
```json
{
  "workbench.colorTheme": "Material Theme Darker High Contrast",
  "workbench.iconTheme": "material-icon-theme",
  "workbench.productIconTheme": "material-product-icons",
  "workbench.colorCustomizations": {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    "editorLineNumber.foreground": "#858585",
    "editorLineNumber.activeForeground": "#c6c6c6",
    "editor.selectionBackground": "#264f78",
    "editor.selectionHighlightBackground": "#264f7840",
    "editor.findMatchBackground": "#515c6a",
    "editor.findMatchHighlightBackground": "#ea5c0055",
    "editor.hoverHighlightBackground": "#264f7840",
    "editorHoverWidget.background": "#252526",
    "editorHoverWidget.border": "#454545"
  },
  "workbench.tree.indent": 20,
  "workbench.tree.renderIndentGuides": "always",
  "workbench.startupEditor": "welcomePage",
  "workbench.editor.enablePreview": false,
  "workbench.editor.enablePreviewFromQuickOpen": false,
  "workbench.editor.revealIfOpen": true,
  "workbench.activityBar.visible": true,
  "workbench.statusBar.visible": true,
  "workbench.sideBar.location": "left",
  "workbench.panel.defaultLocation": "bottom"
}
```

### Font Configuration
```json
{
  "editor.fontFamily": "JetBrains Mono, Fira Code, SF Mono, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
  "editor.fontSize": 14,
  "editor.fontWeight": "400",
  "editor.lineHeight": 1.5,
  "editor.fontLigatures": true,
  "terminal.integrated.fontFamily": "JetBrains Mono, Fira Code, Monaco, 'Courier New', monospace",
  "terminal.integrated.fontSize": 14,
  "debug.console.fontFamily": "JetBrains Mono, Monaco, 'Courier New', monospace",
  "debug.console.fontSize": 14
}
```

## Performance Optimization

### Performance Settings
```json
{
  "typescript.disableAutomaticTypeAcquisition": false,
  "typescript.suggest.includeCompletionsForModuleExports": true,
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.quickSuggestions": {
    "other": true,
    "comments": false,
    "strings": true
  },
  "editor.quickSuggestionsDelay": 10,
  "editor.suggest.snippetsPreventQuickSuggestions": false,
  "editor.parameterHints.enabled": true,
  "editor.parameterHints.cycle": true,
  "files.hotExit": "onExitAndWindowClose",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "workbench.settings.enableNaturalLanguageSearch": false,
  "search.maintainFileSearchCache": true,
  "search.collapseResults": "auto"
}
```

### Memory Management
```json
{
  "typescript.preferences.maxInlayHintLength": 30,
  "typescript.surveys.enabled": false,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.workspaceSymbols.scope": "currentProject",
  "files.watcherExclude": {
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/node_modules/**": true,
    "**/.next/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/target/**": true,
    "**/.turbo/**": true,
    "**/coverage/**": true,
    "**/.nyc_output/**": true
  }
}
```

## Windsurf-Specific Configuration

### AI Features Settings
```json
{
  "windsurf.cascade.enabled": true,
  "windsurf.cascade.mode": "intelligent",
  "windsurf.cascade.autoExecution": true,
  "windsurf.cascade.contextDepth": "deep",
  "windsurf.supercomplete.enabled": true,
  "windsurf.supercomplete.multiCursor": true,
  "windsurf.flows.enabled": true,
  "windsurf.flows.autoSuggest": true,
  "windsurf.indexing.enabled": true,
  "windsurf.indexing.includePatterns": [
    "src/**/*.{ts,tsx,js,jsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "convex/**/*.ts",
    "src-tauri/src/**/*.rs"
  ],
  "windsurf.indexing.excludePatterns": [
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "target/**",
    ".git/**"
  ]
}
```

### Context Management
```json
{
  "windsurf.context.maxTokens": 100000,
  "windsurf.context.retentionMode": "session",
  "windsurf.context.strategy": "adaptive",
  "windsurf.context.relevanceThreshold": 0.7,
  "windsurf.context.lazyLoading": true,
  "windsurf.context.cacheFrequentPatterns": true,
  "windsurf.context.backgroundIndexing": true
}
```

### Preview Integration
```json
{
  "windsurf.preview.nextjs.enabled": true,
  "windsurf.preview.nextjs.url": "http://localhost:3000",
  "windsurf.preview.nextjs.autoRefresh": true,
  "windsurf.preview.tauri.enabled": true,
  "windsurf.preview.tauri.autoLaunch": false,
  "windsurf.preview.tauri.debugMode": true
}
```

## Project-Specific Overrides

### Per-App Configuration
Different apps in the monorepo may need specific settings:

#### auth-web app
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "css.customData": [".vscode/tailwind.json"]
}
```

#### fumadocs app
```json
{
  "markdown.extension.toc.updateOnSave": true,
  "markdown.extension.preview.autoShowPreviewToSide": true
}
```

#### web app (main + Tauri)
```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.cargo.allFeatures": true,
  "tauri.dev.openDevtools": true
}
```

## Keybindings

### Custom Keybindings
```json
[
  {
    "key": "ctrl+shift+`",
    "command": "workbench.action.terminal.new"
  },
  {
    "key": "ctrl+shift+e",
    "command": "workbench.view.explorer"
  },
  {
    "key": "ctrl+shift+f",
    "command": "workbench.view.search"
  },
  {
    "key": "ctrl+shift+g",
    "command": "workbench.view.scm"
  },
  {
    "key": "ctrl+shift+d",
    "command": "workbench.view.debug"
  },
  {
    "key": "ctrl+shift+x",
    "command": "workbench.view.extensions"
  },
  {
    "key": "alt+up",
    "command": "editor.action.moveLinesUpAction",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "alt+down",
    "command": "editor.action.moveLinesDownAction",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "shift+alt+down",
    "command": "editor.action.copyLinesDownAction",
    "when": "editorTextFocus && !editorReadonly"
  },
  {
    "key": "shift+alt+up",
    "command": "editor.action.copyLinesUpAction",
    "when": "editorTextFocus && !editorReadonly"
  }
]
```

## Troubleshooting

### Common Issues and Solutions

#### TypeScript Performance Issues
```json
{
  "typescript.preferences.maxTsServerMemory": 4096,
  "typescript.workspaceSymbols.scope": "currentProject",
  "typescript.preferences.includePackageJsonAutoImports": "off"
}
```

#### Large File Handling
```json
{
  "editor.largeFileOptimizations": true,
  "diffEditor.maxComputationTime": 5000,
  "diffEditor.maxFileSize": 50
}
```

#### Extension Conflicts
- Disable conflicting extensions (Prettier if using Biome)
- Check extension compatibility with Windsurf
- Use extension-specific disable commands for specific file types

### Performance Monitoring
```json
{
  "developer.reload.action": "workbench.action.reloadWindow",
  "extensions.autoUpdate": false,
  "telemetry.telemetryLevel": "off"
}
```

This workspace configuration ensures optimal development experience for the SYMLog platform in Windsurf IDE, with specific attention to monorepo structure, TypeScript development, and integration with our chosen tech stack.