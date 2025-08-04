# SYMLog Auth Web

A secure authentication portal for the SYMLog desktop application, built with Next.js and designed to be deployed on Vercel.

## Overview

This web application provides a secure authentication flow for the SYMLog Tauri desktop application. Users authenticate with Crossmint on this web app, which generates a temporary authentication code that can be used to sign into the desktop application.

## Authentication Flow

1. User clicks "Sign In" in the SYMLog desktop app
2. Desktop app opens this web authentication portal in the browser
3. User authenticates with Crossmint (email, Google, Apple, Discord, Twitter)
4. Web app generates a unique authentication code
5. User either:
   - Clicks "Open SYMLog App" to automatically transfer the code via deep linking (`symlog://auth?code=...`)
   - Manually copies the code and pastes it into the desktop app's dialog
6. Desktop app validates the code with the Convex database and completes authentication

## Features

- **Multiple Authentication Methods**: Email, Google, Apple, Discord, Twitter via Crossmint
- **Smart Wallet Integration**: Automatic SVM smart wallet creation on Solana
- **Deep Linking**: Seamless return to desktop app with `symlog://` protocol
- **Manual Fallback**: Code copying for cases where deep linking fails
- **Security**: 10-minute code expiration, one-time use codes
- **Real-time Sync**: Convex database for authentication state management

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **Authentication**: Crossmint SDK
- **Database**: Convex (shared with main app)
- **Styling**: TailwindCSS with glass morphism effects
- **Deployment**: Vercel

## Environment Variables

Create a `.env.local` file with:

```bash
# Convex Database
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url

# Crossmint Configuration
NEXT_PUBLIC_CROSSMINT_CLIENT_KEY=your_crossmint_client_key
CROSSMINT_SERVER_KEY=your_crossmint_server_key
NEXT_PUBLIC_CROSSMINT_ENVIRONMENT=production

# Deep Link Configuration
NEXT_PUBLIC_AUTH_REDIRECT_URL=symlog://auth

# App Configuration
NEXT_PUBLIC_APP_ENV=production
```

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

The development server runs on `http://localhost:3002` to avoid conflicts with the main SYMLog app.

## Deployment to Vercel

1. Connect your repository to Vercel
2. Set the root directory to `apps/auth-web`
3. Configure environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_CONVEX_URL`
   - `NEXT_PUBLIC_CROSSMINT_CLIENT_KEY`
   - `CROSSMINT_SERVER_KEY`
   - `NEXT_PUBLIC_AUTH_REDIRECT_URL`
   - `NEXT_PUBLIC_APP_ENV`
   - `NEXT_PUBLIC_CROSSMINT_ENVIRONMENT`

4. Deploy!

## Security Considerations

- Authentication codes expire after 10 minutes
- Codes are single-use only
- All authentication data is stored securely in Convex
- Deep linking uses custom protocol to prevent external interception
- HTTPS enforced in production

## Integration with Desktop App

The desktop app must:

1. Handle the `symlog://` protocol for deep linking
2. Have Convex mutations to validate authentication codes
3. Listen for auth code events from the deep link handler
4. Provide manual code entry as fallback

See the main SYMLog app documentation for desktop integration details.