"use client"

import { useEffect } from 'react'

export function TauriKeyboardShortcuts() {
  useEffect(() => {
    // Only run in Tauri environment
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
      return
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd/Ctrl + Q to quit
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
        e.preventDefault()
        if (window.__TAURI__) {
          await window.__TAURI__.window.getCurrent().close()
        }
      }

      // Cmd/Ctrl + W to close window
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        if (window.__TAURI__) {
          await window.__TAURI__.window.getCurrent().close()
        }
      }

      // Cmd/Ctrl + M to minimize
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault()
        if (window.__TAURI__) {
          await window.__TAURI__.window.getCurrent().minimize()
        }
      }

      // F11 for fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault()
        if (window.__TAURI__) {
          const window = window.__TAURI__.window.getCurrent()
          const isFullscreen = await window.isFullscreen()
          await window.setFullscreen(!isFullscreen)
        }
      }

      // Escape to exit fullscreen
      if (e.key === 'Escape') {
        if (window.__TAURI__) {
          const window = window.__TAURI__.window.getCurrent()
          const isFullscreen = await window.isFullscreen()
          if (isFullscreen) {
            await window.setFullscreen(false)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}

// Type declaration for Tauri window API
declare global {
  interface Window {
    __TAURI__?: {
      window: {
        getCurrent(): {
          minimize(): Promise<void>
          maximize(): Promise<void>
          unmaximize(): Promise<void>
          close(): Promise<void>
          isMaximized(): Promise<boolean>
          setFullscreen(fullscreen: boolean): Promise<void>
          isFullscreen(): Promise<boolean>
        }
      }
    }
  }
}