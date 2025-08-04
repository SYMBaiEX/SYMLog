"use client"

import { useEffect, useState } from "react"
import type { CodeArtifact } from "@/types/artifacts"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface CodeViewerProps {
  artifact: CodeArtifact
  editable?: boolean
  onChange?: (content: string) => void
  className?: string
}

export function CodeViewer({
  artifact,
  editable = false,
  onChange,
  className,
}: CodeViewerProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load Prism.js for syntax highlighting
    const loadPrism = async () => {
      if (typeof window !== "undefined" && !window.Prism) {
        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"
        script.async = true
        
        const link = document.createElement("link")
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"
        link.rel = "stylesheet"
        
        document.head.appendChild(link)
        document.body.appendChild(script)
        
        script.onload = async () => {
          // Load language-specific components
          const langMap: Record<string, string> = {
            javascript: "javascript",
            typescript: "typescript",
            python: "python",
            java: "java",
            cpp: "cpp",
            c: "c",
            csharp: "csharp",
            go: "go",
            rust: "rust",
            ruby: "ruby",
            php: "php",
            swift: "swift",
            kotlin: "kotlin",
            sql: "sql",
            html: "markup",
            css: "css",
            json: "json",
            yaml: "yaml",
            markdown: "markdown",
            bash: "bash",
            shell: "bash",
          }
          
          const prismLang = langMap[artifact.language.toLowerCase()] || "javascript"
          
          if (!window.Prism.languages[prismLang] && prismLang !== "javascript") {
            const langScript = document.createElement("script")
            langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${prismLang}.min.js`
            langScript.async = true
            document.body.appendChild(langScript)
            
            await new Promise(resolve => {
              langScript.onload = resolve
            })
          }
          
          highlightCode()
        }
      } else if (window.Prism) {
        highlightCode()
      }
    }
    
    const highlightCode = () => {
      if (window.Prism) {
        const langMap: Record<string, string> = {
          javascript: "javascript",
          typescript: "typescript",
          python: "python",
          java: "java",
          cpp: "cpp",
          c: "c",
          csharp: "csharp",
          go: "go",
          rust: "rust",
          ruby: "ruby",
          php: "php",
          swift: "swift",
          kotlin: "kotlin",
          sql: "sql",
          html: "markup",
          css: "css",
          json: "json",
          yaml: "yaml",
          markdown: "markdown",
          bash: "bash",
          shell: "bash",
        }
        
        const prismLang = langMap[artifact.language.toLowerCase()] || "javascript"
        const highlighted = window.Prism.highlight(
          artifact.content,
          window.Prism.languages[prismLang] || window.Prism.languages.javascript,
          prismLang
        )
        setHighlightedCode(highlighted)
        setIsLoading(false)
      }
    }
    
    loadPrism()
  }, [artifact.content, artifact.language])

  if (editable) {
    return (
      <div className={cn("relative h-full", className)}>
        <textarea
          value={artifact.content}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "w-full h-full p-4 bg-black/40 text-white font-mono text-sm",
            "resize-none focus:outline-none focus:ring-2 focus:ring-periwinkle/50",
            "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          )}
          spellCheck={false}
        />
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 text-xs"
        >
          {artifact.language}
        </Badge>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn("relative h-full overflow-auto", className)}>
      <pre className="p-4 text-sm">
        <code
          className={`language-${artifact.language}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
      {artifact.dependencies && artifact.dependencies.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1">
          {artifact.dependencies.map((dep) => (
            <Badge key={dep} variant="outline" className="text-xs">
              {dep}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// Add global Prism type
declare global {
  interface Window {
    Prism: typeof import('prismjs')
  }
}