'use client';

import { useEffect } from 'react';
import type { TauriWindow } from '@/types/tauri';

// Helper function to safely access Tauri window API
const getTauriWindow = (): TauriWindow | null => {
  if (typeof window !== 'undefined' && window.__TAURI__?.window) {
    return window.__TAURI__.window.getCurrent();
  }
  return null;
};

export function TauriKeyboardShortcuts() {
  useEffect(() => {
    // Only run in Tauri environment
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
      return;
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd/Ctrl + Q to quit
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
        e.preventDefault();
        const tauriWindow = getTauriWindow();
        if (tauriWindow) {
          await tauriWindow.close();
        }
      }

      // Cmd/Ctrl + W to close window
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        const tauriWindow = getTauriWindow();
        if (tauriWindow) {
          await tauriWindow.close();
        }
      }

      // Cmd/Ctrl + M to minimize
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        const tauriWindow = getTauriWindow();
        if (tauriWindow) {
          await tauriWindow.minimize();
        }
      }

      // F11 for fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault();
        const tauriWindow = getTauriWindow();
        if (tauriWindow) {
          const isFullscreen = await tauriWindow.isFullscreen();
          await tauriWindow.setFullscreen(!isFullscreen);
        }
      }

      // Escape to exit fullscreen
      if (e.key === 'Escape') {
        const tauriWindow = getTauriWindow();
        if (tauriWindow) {
          const isFullscreen = await tauriWindow.isFullscreen();
          if (isFullscreen) {
            await tauriWindow.setFullscreen(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
