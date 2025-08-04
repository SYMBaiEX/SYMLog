# SYMLog Platform

<div align="center">
  <h1>Modern Digital Platform</h1>
  <p>Web and desktop application with Web3 integration and advanced UI components</p>
</div>

## 🚀 Overview

SYMLog is a comprehensive digital platform built with modern web technologies, featuring a beautiful UI, Web3 wallet integration, and desktop application capabilities. The platform combines Next.js frontend with Convex backend for real-time data synchronization.

### Key Features

- **🌐 Modern Web App** - Next.js 15 with App Router and Turbopack
- **🖥️ Desktop Application** - Tauri 2 native desktop app for Windows, macOS, and Linux
- **🔐 Web3 Integration** - Solana wallet support with Phantom and Crossmint
- **📱 Progressive Web App** - Install as native app on mobile devices
- **🎨 Beautiful UI** - Tailwind CSS 4 with custom glass morphism components
- **⚡ Real-time Backend** - Convex reactive database with live updates
- **🔧 Type Safety** - Full TypeScript support with strict configuration
- **📦 Monorepo** - Turborepo for optimized builds and development

## 🏗️ Architecture

### Tech Stack

| Component           | Technology           | Version |
| ------------------- | -------------------- | ------- |
| **Frontend**        | Next.js              | 15.3.0  |
| **Backend**         | Convex               | 1.25.4  |
| **Styling**         | Tailwind CSS         | 4.1.10  |
| **UI Components**   | Radix UI + shadcn/ui | Latest  |
| **Desktop**         | Tauri                | 2.4.0   |
| **Language**        | TypeScript           | 5.x     |
| **Package Manager** | Bun                  | 1.2.18  |
| **Build System**    | Turborepo            | 2.5.4   |
| **Linting**         | Biome + Ultracite    | Latest  |

### Project Structure

```
SYMLog/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── components/    # Reusable UI components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   └── lib/           # Utility functions
│   │   ├── src-tauri/         # Tauri desktop app
│   │   └── public/            # Static assets
│   └── fumadocs/              # Documentation site
├── packages/
│   └── backend/               # Convex backend
│       └── convex/            # Database schema & functions
└── .github/                   # CI/CD workflows
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ or **Bun** 1.2.18+
- **Git** for version control
- **Rust** 1.77.2+ (for desktop app)

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repository-url>
   cd SYMLog
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Setup Convex backend**

   ```bash
   bun dev:setup
   ```

   Follow the prompts to create a new Convex project and connect it to your application.

4. **Start development server**

   ```bash
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3001](http://localhost:3001) to see the application.

## 🖥️ Platform Support

### Web Application

- **URL**: http://localhost:3001
- **Features**: PWA support, responsive design, Web3 wallet integration
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest versions)

### Desktop Application

- **Platforms**: Windows, macOS, Linux (including WSL2)
- **Development**: `cd apps/web && bun desktop:dev`
- **Production Build**: `cd apps/web && bun desktop:build`

### Mobile Support

- **PWA**: Install as native app on mobile devices
- **Responsive**: Optimized for all screen sizes

## 🛠️ Development

### Available Scripts

| Command           | Description                                |
| ----------------- | ------------------------------------------ |
| `bun dev`         | Start all applications in development mode |
| `bun dev:web`     | Start only the web application             |
| `bun dev:server`  | Start only the backend server              |
| `bun build`       | Build all applications for production      |
| `bun check-types` | Check TypeScript types across all apps     |
| `bun check`       | Run Biome linter and formatter             |

### Desktop App Commands

| Command                                  | Description                            |
| ---------------------------------------- | -------------------------------------- |
| `cd apps/web && bun desktop:dev`         | Start Tauri desktop app in development |
| `cd apps/web && bun desktop:build`       | Build Tauri desktop app for production |
| `cd apps/web && bun generate-pwa-assets` | Generate PWA assets                    |

### Code Quality

- **Linting**: Biome + Ultracite for consistent code style
- **Type Safety**: Strict TypeScript configuration
- **Git Hooks**: Husky + lint-staged for pre-commit checks
- **Formatting**: Automatic code formatting on save

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Backend Configuration
NEXT_PUBLIC_BACKEND_URL=your_backend_url_here

# Web3 Configuration (Optional)
NEXT_PUBLIC_WEB3_CLIENT_KEY=your_web3_key_here
NEXT_PUBLIC_BLOCKCHAIN_RPC_URL=your_rpc_url_here
```

### Convex Setup

The platform uses Convex as a reactive backend. Key features:

- **Real-time Database**: Automatic reactivity and live updates
- **Type Safety**: Full TypeScript support with generated types
- **Cloud Deployment**: Automatic scaling and global distribution
- **Security**: Built-in authentication and authorization

## 📱 Features

### Core Functionality

- **Modern UI**: Glass morphism design with custom components
- **Web3 Authentication**: Solana wallet integration with Phantom and Crossmint
- **Real-time Updates**: Live data synchronization across all clients
- **Contact Management**: Integrated contact forms and support system
- **Blog Platform**: Content management with search and categorization
- **Research Integration**: Academic paper management and collaboration

### Advanced Features

- **Desktop App**: Native desktop application with Tauri
- **PWA Support**: Install as native app on mobile devices
- **Dark/Light Mode**: Theme switching with system preference detection
- **Keyboard Shortcuts**: Desktop app productivity features
- **Responsive Design**: Optimized for all screen sizes

## 🔒 Security

- **Web3 Authentication**: Decentralized identity management with wallet signatures
- **Environment Variables**: Secure configuration management
- **Type Safety**: Compile-time error prevention
- **Code Quality**: Automated linting and formatting

## 📊 Performance

- **Optimized Builds**: Turborepo for fast incremental builds
- **PWA Caching**: Service worker for offline capabilities
- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic route-based code splitting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `bun check-types && bun check`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: [GitHub Issues](https://github.com/your-org/SYMLog/issues)
- **Email**: hello@symlog.ai

## 🏆 Acknowledgments

- Built with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack)
- Powered by [Convex](https://convex.dev) for reactive backend
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Desktop app framework by [Tauri](https://tauri.app)

---

<div align="center">
  <p>Made with ❤️ by the SYMLog Team</p>
  <p>Experience modern web development with cutting-edge technologies</p>
</div>
