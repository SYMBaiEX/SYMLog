"use client"

import { useState, useMemo } from "react"
import type { DataArtifact } from "@/types/artifacts"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { GlassButton } from "@/components/ui/glass-button"
import { Input } from "@/components/ui/input"
import {
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Download,
} from "lucide-react"
import { toast } from "sonner"

interface DataViewerProps {
  artifact: DataArtifact
  className?: string
}

export function DataViewer({ artifact, className }: DataViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [copied, setCopied] = useState(false)

  const parsedData = useMemo(() => {
    try {
      if (artifact.type === "json") {
        return JSON.parse(artifact.content)
      } else if (artifact.type === "csv") {
        // Simple CSV parser
        const lines = artifact.content.trim().split("\n")
        const headers = lines[0].split(",").map(h => h.trim())
        const data = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim())
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index]
            return obj
          }, {} as Record<string, string>)
        })
        return data
      }
      return null
    } catch (error) {
      console.error("Failed to parse data:", error)
      return null
    }
  }, [artifact.content, artifact.type])

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const renderValue = (value: any, path: string = "", depth: number = 0): React.ReactElement => {
    if (value === null) {
      return <span className="text-gray-500">null</span>
    }

    if (value === undefined) {
      return <span className="text-gray-500">undefined</span>
    }

    if (typeof value === "boolean") {
      return <span className="text-blue-400">{value.toString()}</span>
    }

    if (typeof value === "number") {
      return <span className="text-green-400">{value}</span>
    }

    if (typeof value === "string") {
      const highlighted = searchTerm
        ? value.replace(
            new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"),
            '<mark class="bg-yellow-400/30 text-yellow-300">$1</mark>'
          )
        : value
      return (
        <span
          className="text-orange-400"
          dangerouslySetInnerHTML={{ __html: `&quot;${highlighted}&quot;` }}
        />
      )
    }

    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path)
      return (
        <div className="inline-block">
          <button
            onClick={() => togglePath(path)}
            className="inline-flex items-center hover:bg-white/5 rounded px-1 -ml-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="text-gray-400 ml-1">
              [{value.length}]
            </span>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1">
              {value.map((item, index) => (
                <div key={index} className="my-1">
                  <span className="text-gray-500 mr-2">{index}:</span>
                  {renderValue(item, `${path}[${index}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (typeof value === "object") {
      const isExpanded = expandedPaths.has(path)
      const keys = Object.keys(value)
      return (
        <div className="inline-block">
          <button
            onClick={() => togglePath(path)}
            className="inline-flex items-center hover:bg-white/5 rounded px-1 -ml-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="text-gray-400 ml-1">
              {"{"}
              {!isExpanded && keys.length > 0 && "..."}
              {!isExpanded && "}"}
            </span>
          </button>
          {isExpanded && (
            <>
              <div className="ml-4 mt-1">
                {keys.map((key) => (
                  <div key={key} className="my-1">
                    <span className="text-purple-400">&quot;{key}&quot;</span>
                    <span className="text-gray-400 mx-1">:</span>
                    {renderValue(value[key], `${path}.${key}`, depth + 1)}
                  </div>
                ))}
              </div>
              <div className="text-gray-400">{"}"}</div>
            </>
          )}
        </div>
      )
    }

    return <span className="text-gray-400">{String(value)}</span>
  }

  const handleCopy = async () => {
    try {
      const formatted = artifact.type === "json"
        ? JSON.stringify(parsedData, null, 2)
        : artifact.content
      await navigator.clipboard.writeText(formatted)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  const handleDownload = () => {
    const blob = new Blob([artifact.content], {
      type: artifact.type === "json" ? "application/json" : "text/csv",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${artifact.title}.${artifact.type}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b border-white/10">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-black/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {artifact.type.toUpperCase()}
          </Badge>
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            {copied ? (
              <Copy className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 font-mono text-sm scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {parsedData ? (
          renderValue(parsedData)
        ) : (
          <pre className="whitespace-pre-wrap">{artifact.content}</pre>
        )}
      </div>
    </div>
  )
}