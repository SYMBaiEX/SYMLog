# SYMLog Zed Editor Configuration

This directory contains comprehensive Zed editor configuration optimized for the SYMLog project's tech stack including TypeScript, React, Next.js, Tauri, and Rust.

## Overview

[Zed](https://zed.dev) is a high-performance, multiplayer code editor built by the team behind Atom and Tree-sitter. It features:

- **Native Performance**: Built in Rust with GPU acceleration
- **Real-time Collaboration**: CRDT-based multiplayer editing
- **Advanced Language Support**: Powered by Tree-sitter and Language Server Protocol
- **AI Integration**: Built-in AI assistant and edit predictions
- **Extensible**: Plugin system and customizable configurations

## Configuration Files

### `.zed/settings.json`
Main configuration file containing:
- **Editor Settings**: Font, theme, line numbers, formatting
- **Language-Specific Configs**: TypeScript, React, Rust optimizations
- **LSP Configuration**: Language server settings for enhanced development
- **AI Integration**: Copilot and Claude integration
- **Performance Tuning**: Optimized for SYMLog's monorepo structure

### `.zed/tasks.json`
Task runner configuration with predefined tasks for:
- Development servers (`bun run dev`, `bun run dev:web`)
- Build processes (`bun run build`)
- Type checking (`bun run check-types`)
- Code quality (`bun run check`)
- Testing workflows
- Git operations

### `.zed/keymap.json`
Custom keybindings optimized for productivity:
- **File Navigation**: Quick file finder, project search
- **Code Editing**: Multi-cursor, line manipulation, syntax node selection
- **Project Management**: File/folder operations in project panel
- **AI Features**: Edit prediction acceptance shortcuts

## Key Features

### Language Server Protocol (LSP) Integration

**TypeScript/JavaScript**:
- Enhanced inlay hints for parameters and types
- Auto-imports and unused import removal
- Advanced code actions on save

**Rust** (for Tauri development):
- Clippy integration for enhanced linting
- Comprehensive inlay hints
- Cargo integration with all targets

**Tailwind CSS**:
- Emmet completions
- Custom class regex patterns for `cva()` and `cx()`
- Enhanced IntelliSense

### Performance Optimizations

- **GPU Acceleration**: Leverages native rendering for smooth scrolling
- **Efficient File Watching**: Optimized for monorepo structures
- **Parallel Processing**: Multiple language servers running concurrently
- **Smart Caching**: Reduces startup time and improves responsiveness

### Collaboration Features

- **Multiplayer Editing**: Real-time collaborative editing with CRDT technology
- **Voice Calls**: Integrated voice chat for pair programming
- **Screen Sharing**: Share your screen during collaboration sessions

## Getting Started

### Installation

1. **Download Zed**: Visit [zed.dev](https://zed.dev) and download for your platform
2. **Install via Package Manager**:
   ```bash
   # macOS (Homebrew)
   brew install zed
   
   # Linux (AppImage or package manager)
   # Follow platform-specific instructions on zed.dev
   ```

### Opening the SYMLog Project

1. Launch Zed
2. Open the SYMLog project folder
3. Zed will automatically detect the `.zed` configuration and apply settings
4. Install recommended extensions when prompted

### First-Time Setup

1. **Configure Git**: Ensure Git is configured for collaboration features
2. **Install Language Servers**: Zed will auto-install TypeScript, Rust, and other LSPs
3. **Set Up AI Features**: Configure Copilot or Claude API keys in settings
4. **Customize Theme**: Choose from built-in themes or create custom ones

## Workflow Integration

### Development Tasks

Use `Cmd+Shift+P` (Command Palette) → "task: spawn" or `Alt+F` to run tasks:

- **Start Development**: `Development Server` - Starts the main dev server
- **Web App**: `Web App Dev` - Specifically for the web application
- **Desktop App**: `Tauri Desktop Dev` - For desktop development
- **Type Checking**: `Type Check` - Run TypeScript compiler
- **Code Quality**: `Lint & Format` - Run Biome checks

### Git Integration

- **Inline Git Blame**: See commit info inline
- **Git Gutter**: Visual diff indicators
- **Branch Switching**: Integrated branch management

### AI-Powered Development

- **Edit Predictions**: AI-suggested code completions (Tab to accept)
- **Inline Assistant**: `Cmd+Shift+Enter` for AI assistance
- **Code Generation**: Context-aware code suggestions

## Customization

### Themes

Zed includes multiple built-in themes. Current config uses:
- **Light Mode**: `cave-light` 
- **Auto-switching**: Based on system preferences

### Fonts

Recommended fonts (install separately):
- **JetBrains Mono**: Primary coding font
- **Fira Code**: Alternative with ligatures
- **SF Mono**: macOS system font

### Extensions

Auto-installed extensions for SYMLog:
- TypeScript
- Rust
- Tailwind CSS
- HTML/CSS
- JSON/YAML
- Docker
- Prisma

## Performance Tips

1. **GPU Acceleration**: Ensure hardware acceleration is enabled
2. **File Exclusions**: Configure `.gitignore` to exclude `node_modules`
3. **LSP Tuning**: Adjust language server settings for large projects
4. **Terminal Performance**: Use system shell for better integration

## Collaboration Workflow

### Starting a Collaboration Session

1. **Share Project**: Use "Share Project" from command palette
2. **Invite Collaborators**: Send invite links to team members
3. **Voice Chat**: Enable voice for real-time communication
4. **Code Review**: Use built-in commenting and review features

### Best Practices

- **Sync Settings**: Share configuration across team
- **Code Standards**: Use consistent formatting (configured automatically)
- **Branch Strategy**: Integrate with Git workflow
- **Communication**: Use voice chat for complex discussions

## Troubleshooting

### Common Issues

**Language Server Not Starting**:
- Check if TypeScript is installed globally: `bun add -g typescript`
- Restart Zed and check LSP status in command palette

**Performance Issues**:
- Disable unused extensions
- Check GPU acceleration settings
- Restart language servers from command palette

**Collaboration Problems**:
- Verify internet connection
- Check firewall settings
- Update to latest Zed version

### Debug Information

Access debug information via:
- **Command Palette**: "zed: open log file"
- **Developer Tools**: "zed: open developer console"
- **LSP Status**: "lsp: show status"

## Advanced Configuration

### Custom Language Support

Add new languages by configuring:
```json
{
  "languages": {
    "CustomLanguage": {
      "tab_size": 4,
      "formatter": "external",
      "format_on_save": "on"
    }
  }
}
```

### Environment Variables

Configure development environment:
```json
{
  "terminal": {
    "env": {
      "NODE_ENV": "development",
      "CUSTOM_VAR": "value"
    }
  }
}
```

### Project-Specific Settings

Override global settings by modifying `.zed/settings.json`:
- Language-specific configurations
- Custom themes and fonts
- Project-specific LSP settings

## Resources

- **Official Documentation**: [zed.dev/docs](https://zed.dev/docs)
- **Community**: [Zed Discord](https://discord.gg/zed)
- **GitHub**: [zed-industries/zed](https://github.com/zed-industries/zed)
- **Extensions**: [Zed Extension Gallery](https://zed.dev/extensions)

## Contributing

To contribute to this Zed configuration:

1. **Test Changes**: Verify configurations work across team
2. **Document Updates**: Update this README with changes
3. **Share Improvements**: Contribute back to team configuration
4. **Maintain Compatibility**: Ensure settings work across platforms

---

*This configuration is optimized for the SYMLog project's TypeScript, React, Next.js, Tauri, and Rust tech stack. Adjust settings as needed for your specific workflow.*