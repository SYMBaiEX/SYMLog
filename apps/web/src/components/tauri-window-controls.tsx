"use client"

import * as React from "react"
import { X, Minus, Square, Maximize2, Brain } from "lucide-react"
import { cn } from "@/lib/utils"

export function TauriWindowControls() {
  const [isMaximized, setIsMaximized] = React.useState(false)
  const [isTauri, setIsTauri] = React.useState(false)

  React.useEffect(() => {
    // Check if running in Tauri
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window)
    
    // Check if window is maximized on load
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      window.__TAURI__.window.getCurrent().isMaximized().then(setIsMaximized)
    }
  }, [])

  const handleMinimize = async () => {
    if (window.__TAURI__) {
      await window.__TAURI__.window.getCurrent().minimize()
    }
  }

  const handleMaximize = async () => {
    if (window.__TAURI__) {
      const window = window.__TAURI__.window.getCurrent()
      if (isMaximized) {
        await window.unmaximize()
        setIsMaximized(false)
      } else {
        await window.maximize()
        setIsMaximized(true)
      }
    }
  }

  const handleClose = async () => {
    if (window.__TAURI__) {
      await window.__TAURI__.window.getCurrent().close()
    }
  }

  // Only show in Tauri environment
  if (!isTauri) return null

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-10 z-[100] flex items-center justify-between select-none"
      style={{ 
        background: "linear-gradient(to bottom, rgba(10, 10, 10, 0.95), rgba(10, 10, 10, 0.8))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        borderTopLeftRadius: "12px",
        borderTopRightRadius: "12px"
      }}
    >
      {/* Left side - App icon and title (draggable) */}
      <div 
        className="flex items-center gap-3 px-4 h-full flex-1"
        data-tauri-drag-region
      >
        <Brain className="h-5 w-5 text-periwinkle animate-pulse" />
        <span className="text-sm font-semibold gradient-text from-periwinkle to-light-green">
          SYMLog - AI Platform
        </span>
        <div className="flex items-center gap-2 ml-4">
          <div className="h-2 w-2 rounded-full bg-light-green pulse-indicator" />
          <span className="text-xs text-muted-foreground">System Ready</span>
        </div>
      </div>

      {/* Center - Futuristic decorative element (draggable) */}
      <div 
        className="flex-1 flex items-center justify-center h-full"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-periwinkle/30 to-transparent" />
          <div className="h-1.5 w-1.5 rounded-full bg-periwinkle/50" />
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-light-green/30 to-transparent" />
        </div>
      </div>

      {/* Right side - Window controls */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className={cn(
            "h-full px-4 flex items-center justify-center transition-all",
            "hover:bg-white/10 active:bg-white/20"
          )}
          aria-label="Minimize"
        >
          <Minus className="h-4 w-4 text-white/70" />
        </button>
        <button
          onClick={handleMaximize}
          className={cn(
            "h-full px-4 flex items-center justify-center transition-all",
            "hover:bg-white/10 active:bg-white/20"
          )}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Square className="h-3.5 w-3.5 text-white/70" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-white/70" />
          )}
        </button>
        <button
          onClick={handleClose}
          className={cn(
            "h-full px-4 flex items-center justify-center transition-all",
            "hover:bg-red-500/90 active:bg-red-600"
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </div>
  )
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
        }
      }
    }
  }
}