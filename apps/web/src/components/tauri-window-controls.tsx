'use client';

import { Brain, Maximize2, Minus, Square, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import type { TauriWindow } from '@/types/tauri';

// Helper function to safely access Tauri window API
const getTauriWindow = (): TauriWindow | null => {
  if (typeof window !== 'undefined' && window.__TAURI__?.window) {
    return window.__TAURI__.window.getCurrent();
  }
  return null;
};

export function TauriWindowControls() {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isTauri, setIsTauri] = React.useState(false);

  React.useEffect(() => {
    // Check if running in Tauri with multiple attempts
    const checkTauri = () => {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        setIsTauri(true);

        // Check if window is maximized on load
        const tauriWindow = getTauriWindow();
        if (tauriWindow) {
          tauriWindow
            .isMaximized()
            .then(setIsMaximized)
            .catch(() => {
              // Ignore errors
            });
        }
        return true;
      }
      return false;
    };

    // Try immediately
    if (!checkTauri()) {
      // Try again after DOM is ready
      const attempts = [50, 100, 200, 500];
      attempts.forEach((delay) => {
        setTimeout(checkTauri, delay);
      });
    }
  }, []);

  const handleMinimize = async () => {
    const tauriWindow = getTauriWindow();
    if (tauriWindow) {
      await tauriWindow.minimize();
    }
  };

  const handleMaximize = async () => {
    const tauriWindow = getTauriWindow();
    if (tauriWindow) {
      if (isMaximized) {
        await tauriWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await tauriWindow.maximize();
        setIsMaximized(true);
      }
    }
  };

  const handleClose = async () => {
    const tauriWindow = getTauriWindow();
    if (tauriWindow) {
      await tauriWindow.close();
    }
  };

  // Debug logging
  React.useEffect(() => {
    console.log(
      'TauriWindowControls render - isTauri:',
      isTauri,
      'window.__TAURI__:',
      typeof window !== 'undefined' && !!window.__TAURI__
    );
  });

  // Only show in Tauri environment
  if (typeof window === 'undefined') return null;
  if (!isTauri) return null;

  return (
    <div
      className="fixed top-0 right-0 left-0 z-[9999] flex h-10 select-none items-center justify-between"
      style={{
        background:
          'linear-gradient(to bottom, rgba(10, 10, 10, 0.98), rgba(10, 10, 10, 0.95))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        isolation: 'isolate',
      }}
    >
      {/* Left side - App icon and title (draggable) */}
      <div
        className="flex h-full flex-1 items-center gap-3 px-4"
        data-tauri-drag-region
      >
        <Brain className="h-5 w-5 animate-pulse text-periwinkle" />
        <span className="gradient-text from-periwinkle to-light-green font-semibold text-sm">
          SYMLog - AI Platform
        </span>
        <div className="ml-4 flex items-center gap-2">
          <div className="pulse-indicator h-2 w-2 rounded-full bg-light-green" />
          <span className="text-muted-foreground text-xs">System Ready</span>
        </div>
      </div>

      {/* Center - Futuristic decorative element (draggable) */}
      <div
        className="flex h-full flex-1 items-center justify-center"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-periwinkle/30 to-transparent" />
          <div className="h-1.5 w-1.5 rounded-full bg-periwinkle/50" />
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-light-green/30 to-transparent" />
        </div>
      </div>

      {/* Right side - Window controls */}
      <div className="flex h-full items-center">
        <button
          aria-label="Minimize"
          className={cn(
            'flex h-full items-center justify-center px-4 transition-all',
            'hover:bg-white/10 active:bg-white/20'
          )}
          onClick={handleMinimize}
        >
          <Minus className="h-4 w-4 text-white/70" />
        </button>
        <button
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          className={cn(
            'flex h-full items-center justify-center px-4 transition-all',
            'hover:bg-white/10 active:bg-white/20'
          )}
          onClick={handleMaximize}
        >
          {isMaximized ? (
            <Square className="h-3.5 w-3.5 text-white/70" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-white/70" />
          )}
        </button>
        <button
          aria-label="Close"
          className={cn(
            'flex h-full items-center justify-center px-4 transition-all',
            'hover:bg-red-500/90 active:bg-red-600'
          )}
          onClick={handleClose}
        >
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </div>
  );
}
