'use client';

import {
  AlertCircle,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

interface CodeSandboxProps {
  code: string;
  language: string;
  onClose?: () => void;
  className?: string;
}

export function CodeSandbox({
  code,
  language,
  onClose,
  className,
}: CodeSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Handle JavaScript/TypeScript execution
  const executeJavaScript = async () => {
    setIsRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);

    try {
      // Create a sandboxed iframe for execution
      const iframe = iframeRef.current;
      if (!(iframe && iframe.contentWindow)) {
        throw new Error('Sandbox not initialized');
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
      `;

      const result = (iframe.contentWindow as any).eval(wrappedCode);

      if (result.success) {
        setLogs(result.logs);
        setOutput('Code executed successfully');
      } else {
        setError(result.error);
        setLogs(result.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Handle React component execution
  const executeReactComponent = async () => {
    setIsRunning(true);
    setError(null);
    setOutput('');

    try {
      // For React components, we'll create a more sophisticated sandbox
      const iframe = iframeRef.current;
      if (!(iframe && iframe.contentWindow)) {
        throw new Error('Sandbox not initialized');
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
      `;

      iframe.srcdoc = html;
      setOutput('React component rendered');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Handle Python execution (using Pyodide)
  const executePython = async () => {
    setIsRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);

    try {
      // Load Pyodide if not already loaded
      if (!window.pyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        document.body.appendChild(script);

        await new Promise((resolve) => {
          script.onload = async () => {
            window.pyodide = await window.loadPyodide();
            resolve(true);
          };
        });
      }

      // Capture output
      window.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
      `);

      // Execute the code
      window.pyodide.runPython(code);

      // Get the output
      const output = window.pyodide.runPython('sys.stdout.getvalue()');
      setOutput(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Python execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleExecute = () => {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'js':
      case 'ts':
        executeJavaScript();
        break;
      case 'react':
      case 'jsx':
      case 'tsx':
        executeReactComponent();
        break;
      case 'python':
      case 'py':
        executePython();
        break;
      default:
        setError(`Execution not supported for ${language}`);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    // Reload iframe to stop execution
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  };

  const handleReset = () => {
    setOutput('');
    setError(null);
    setLogs([]);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  };

  return (
    <GlassCard className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-white/10 border-b p-4">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-periwinkle" />
          <h3 className="font-semibold">Code Sandbox</h3>
          <Badge className="text-xs" variant="secondary">
            {language}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            className="h-8 w-8"
            disabled={isRunning}
            onClick={handleReset}
            size="icon"
            variant="ghost"
          >
            <RefreshCw className="h-4 w-4" />
          </GlassButton>

          {isRunning ? (
            <GlassButton
              className="h-8 w-8"
              onClick={handleStop}
              size="icon"
              variant="ghost"
            >
              <Square className="h-4 w-4" />
            </GlassButton>
          ) : (
            <GlassButton
              className="h-8 w-8"
              onClick={handleExecute}
              size="icon"
              variant="default"
            >
              <Play className="h-4 w-4" />
            </GlassButton>
          )}

          {onClose && (
            <GlassButton
              className="h-8 w-8"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </div>

      {/* Execution Environment */}
      <div className="flex flex-1 flex-col">
        {/* React Component Preview */}
        {(language === 'react' || language === 'jsx' || language === 'tsx') && (
          <div className="flex-1 border-white/10 border-b">
            <iframe
              className="h-full w-full bg-black/40"
              ref={iframeRef}
              sandbox="allow-scripts"
              title="React Component Preview"
            />
          </div>
        )}

        {/* Console Output */}
        <div className="flex-1 overflow-auto bg-black/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground text-sm">
              Console Output
            </span>
            {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {error ? (
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <pre className="whitespace-pre-wrap text-sm">{error}</pre>
            </div>
          ) : (
            <>
              {logs.length > 0 && (
                <div className="mb-4 space-y-1">
                  {logs.map((log, i) => (
                    <div className="text-gray-300 text-sm" key={i}>
                      <span className="mr-2 text-gray-500">&gt;</span>
                      {log}
                    </div>
                  ))}
                </div>
              )}
              {output && (
                <pre className="whitespace-pre-wrap text-green-400 text-sm">
                  {output}
                </pre>
              )}
              {!(output || logs.length || isRunning) && (
                <p className="text-muted-foreground text-sm">
                  Click the play button to execute the code
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden iframe for JavaScript execution */}
      {(language === 'javascript' || language === 'typescript') && (
        <iframe
          className="hidden"
          ref={iframeRef}
          sandbox="allow-scripts"
          title="JavaScript Sandbox"
        />
      )}
    </GlassCard>
  );
}

// Add global types
declare global {
  interface Window {
    pyodide: any;
    loadPyodide: any;
  }
}
