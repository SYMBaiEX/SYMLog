"use client"

import { useEffect, useRef, useState } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Square,
  RefreshCw,
  Loader2,
  AlertCircle,
  Terminal,
  Globe,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface CodeSandboxProps {
  code: string
  language: string
  onClose?: () => void
  className?: string
}

export function CodeSandbox({
  code,
  language,
  onClose,
  className,
}: CodeSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // Handle JavaScript/TypeScript execution
  const executeJavaScript = async () => {
    setIsRunning(true)
    setError(null)
    setOutput("")
    setLogs([])

    try {
      // Create a sandboxed iframe for execution
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentWindow) {
        throw new Error("Sandbox not initialized")
      }

      // Inject code into iframe
      const wrappedCode = `
        (function() {
          const logs = [];
          const originalLog = console.log;
          console.log = (...args) => {
            logs.push(args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '));
            originalLog.apply(console, args);
          };

          try {
            ${code}
            return { success: true, logs };
          } catch (error) {
            return { success: false, error: error.message, logs };
          }
        })()
      `

      const result = (iframe.contentWindow as any).eval(wrappedCode)
      
      if (result.success) {
        setLogs(result.logs)
        setOutput("Code executed successfully")
      } else {
        setError(result.error)
        setLogs(result.logs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed")
    } finally {
      setIsRunning(false)
    }
  }

  // Handle React component execution
  const executeReactComponent = async () => {
    setIsRunning(true)
    setError(null)
    setOutput("")

    try {
      // For React components, we'll create a more sophisticated sandbox
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentWindow) {
        throw new Error("Sandbox not initialized")
      }

      // Inject React and the component code
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <style>
              body { 
                margin: 0; 
                padding: 16px; 
                font-family: system-ui, -apple-system, sans-serif;
                background: #0a0a0a;
                color: #ffffff;
              }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel">
              ${code}
              
              // Attempt to render the default export or App component
              const Component = typeof App !== 'undefined' ? App : 
                               typeof Default !== 'undefined' ? Default : 
                               null;
              
              if (Component) {
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(<Component />);
              } else {
                document.getElementById('root').innerHTML = 
                  '<p style="color: #ef4444;">No React component found. Export a component as "App" or default export.</p>';
              }
            </script>
          </body>
        </html>
      `

      iframe.srcdoc = html
      setOutput("React component rendered")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed")
    } finally {
      setIsRunning(false)
    }
  }

  // Handle Python execution (using Pyodide)
  const executePython = async () => {
    setIsRunning(true)
    setError(null)
    setOutput("")
    setLogs([])

    try {
      // Load Pyodide if not already loaded
      if (!window.pyodide) {
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"
        document.body.appendChild(script)

        await new Promise((resolve) => {
          script.onload = async () => {
            window.pyodide = await window.loadPyodide()
            resolve(true)
          }
        })
      }

      // Capture output
      window.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
      `)

      // Execute the code
      window.pyodide.runPython(code)

      // Get the output
      const output = window.pyodide.runPython(`sys.stdout.getvalue()`)
      setOutput(output)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Python execution failed")
    } finally {
      setIsRunning(false)
    }
  }

  const handleExecute = () => {
    switch (language.toLowerCase()) {
      case "javascript":
      case "typescript":
      case "js":
      case "ts":
        executeJavaScript()
        break
      case "react":
      case "jsx":
      case "tsx":
        executeReactComponent()
        break
      case "python":
      case "py":
        executePython()
        break
      default:
        setError(`Execution not supported for ${language}`)
    }
  }

  const handleStop = () => {
    setIsRunning(false)
    // Reload iframe to stop execution
    if (iframeRef.current) {
      iframeRef.current.src = "about:blank"
    }
  }

  const handleReset = () => {
    setOutput("")
    setError(null)
    setLogs([])
    if (iframeRef.current) {
      iframeRef.current.src = "about:blank"
    }
  }

  return (
    <GlassCard className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-periwinkle" />
          <h3 className="font-semibold">Code Sandbox</h3>
          <Badge variant="secondary" className="text-xs">
            {language}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleReset}
            disabled={isRunning}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </GlassButton>

          {isRunning ? (
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="h-8 w-8"
            >
              <Square className="h-4 w-4" />
            </GlassButton>
          ) : (
            <GlassButton
              variant="default"
              size="icon"
              onClick={handleExecute}
              className="h-8 w-8"
            >
              <Play className="h-4 w-4" />
            </GlassButton>
          )}

          {onClose && (
            <GlassButton
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </div>

      {/* Execution Environment */}
      <div className="flex-1 flex flex-col">
        {/* React Component Preview */}
        {(language === "react" || language === "jsx" || language === "tsx") && (
          <div className="flex-1 border-b border-white/10">
            <iframe
              ref={iframeRef}
              className="w-full h-full bg-black/40"
              sandbox="allow-scripts"
              title="React Component Preview"
            />
          </div>
        )}

        {/* Console Output */}
        <div className="flex-1 p-4 bg-black/40 overflow-auto">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Console Output
            </span>
            {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {error ? (
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <pre className="text-sm whitespace-pre-wrap">{error}</pre>
            </div>
          ) : (
            <>
              {logs.length > 0 && (
                <div className="space-y-1 mb-4">
                  {logs.map((log, i) => (
                    <div key={i} className="text-sm text-gray-300">
                      <span className="text-gray-500 mr-2">&gt;</span>
                      {log}
                    </div>
                  ))}
                </div>
              )}
              {output && (
                <pre className="text-sm text-green-400 whitespace-pre-wrap">
                  {output}
                </pre>
              )}
              {!output && !logs.length && !isRunning && (
                <p className="text-sm text-muted-foreground">
                  Click the play button to execute the code
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden iframe for JavaScript execution */}
      {(language === "javascript" || language === "typescript") && (
        <iframe
          ref={iframeRef}
          className="hidden"
          sandbox="allow-scripts"
          title="JavaScript Sandbox"
        />
      )}
    </GlassCard>
  )
}

// Add global types
declare global {
  interface Window {
    pyodide: any
    loadPyodide: any
  }
}