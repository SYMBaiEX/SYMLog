'use client';

import {
  createOptimizedDynamicImport,
  OptimizedLoader,
} from '@/lib/dynamic-imports';

// Large interactive components that benefit from dynamic loading
export const TreeVisualization = createOptimizedDynamicImport(
  () =>
    import('@/components/chat/tree-visualization').then(
      (mod) => mod.TreeVisualization
    ),
  {
    ssr: false, // Tree visualization is interactive and doesn't need SSR
    loadingSize: 'large',
    preload: true, // Preload since it's commonly used
  }
);

export const ChatSettingsModal = createOptimizedDynamicImport(
  () =>
    import('@/components/chat/chat-settings-modal').then((mod) => ({
      default: mod.ChatSettingsModal,
    })),
  { ssr: false, loadingSize: 'default' }
);

export const BranchMergeWizard = createOptimizedDynamicImport(
  () =>
    import('@/components/chat/branch-merge-wizard').then((mod) => ({
      default: mod.BranchMergeWizard,
    })),
  { ssr: false, loadingSize: 'default' }
);

export const BranchComparisonView = createOptimizedDynamicImport(
  () =>
    import('@/components/chat/branch-comparison-view').then((mod) => ({
      default: mod.BranchComparisonView,
    })),
  { ssr: false, loadingSize: 'default' }
);

export const CodeSandbox = createOptimizedDynamicImport(
  () =>
    import('@/components/artifacts/code-sandbox').then((mod) => ({
      default: mod.CodeSandbox,
    })),
  { ssr: false, loadingSize: 'default' }
);

export const ArtifactViewer = createOptimizedDynamicImport(
  () =>
    import('@/components/artifacts/artifact-viewer').then((mod) => ({
      default: mod.ArtifactViewer,
    })),
  { ssr: false, loadingSize: 'default' }
);

// Heavy authentication components (client-side only)
export const WebAuthFlow = createOptimizedDynamicImport(
  () =>
    import('@/components/web-auth-flow').then((mod) => ({
      default: mod.WebAuthFlow,
    })),
  { ssr: false, loadingSize: 'default' }
);

export const DesktopAuthFallback = createOptimizedDynamicImport(
  () =>
    import('@/components/desktop-auth-fallback').then((mod) => ({
      default: mod.DesktopAuthFallback,
    })),
  { ssr: false, loadingSize: 'default' }
);

export const CrossmintWalletAuth = createOptimizedDynamicImport(
  () =>
    import('@/components/crossmint-wallet-auth').then((mod) => ({
      default: mod.CrossmintWalletAuth,
    })),
  { ssr: false, loadingSize: 'default' }
);

// Export the optimized loader for external use
export { OptimizedLoader } from '@/lib/dynamic-imports';
