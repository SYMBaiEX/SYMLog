"use client"

import { useState } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import { ArtifactViewer } from "./artifact-viewer"
import type { Artifact } from "@/types/artifacts"
import {
  Code,
  FileText,
  Table,
  Image,
  BarChart3,
  Maximize2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ArtifactPreviewProps {
  artifact: Artifact
  className?: string
}

export function ArtifactPreview({ artifact, className }: ArtifactPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getIcon = () => {
    switch (artifact.type) {
      case "code":
      case "react-component":
      case "python-script":
      case "sql-query":
        return <Code className="h-4 w-4" />
      case "document":
      case "markdown":
      case "html":
        return <FileText className="h-4 w-4" />
      case "spreadsheet":
        return <Table className="h-4 w-4" />
      case "image":
        return <Image className="h-4 w-4" />
      case "chart":
        return <BarChart3 className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getPreviewContent = () => {
    switch (artifact.type) {
      case "code":
      case "react-component":
      case "python-script":
      case "sql-query":
        const lines = artifact.content.split("\n").slice(0, 5)
        return (
          <pre className="text-xs bg-black/40 p-3 rounded-lg overflow-hidden">
            <code className="text-gray-300">
              {lines.join("\n")}
              {artifact.content.split("\n").length > 5 && "\n..."}
            </code>
          </pre>
        )
      case "document":
      case "markdown":
        const preview = artifact.content.slice(0, 200)
        return (
          <p className="text-sm text-gray-300 line-clamp-3">
            {preview}
            {artifact.content.length > 200 && "..."}
          </p>
        )
      case "spreadsheet":
        return (
          <div className="text-sm text-gray-300">
            <p>{artifact.data.length} rows × {artifact.columns.length} columns</p>
          </div>
        )
      case "image":
        return (
          <div className="relative h-32 bg-black/20 rounded-lg overflow-hidden">
            {artifact.url ? (
              <img
                src={artifact.url}
                alt={artifact.title}
                className="w-full h-full object-contain"
              />
            ) : artifact.base64 ? (
              <img
                src={`data:image/${artifact.format};base64,${artifact.base64}`}
                alt={artifact.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Image className="h-8 w-8" />
              </div>
            )}
          </div>
        )
      case "chart":
        return (
          <div className="text-sm text-gray-300">
            <p className="capitalize">{artifact.chartType} chart</p>
          </div>
        )
      case "json":
      case "csv":
        const dataPreview = artifact.content.slice(0, 150)
        return (
          <pre className="text-xs bg-black/40 p-3 rounded-lg overflow-hidden">
            <code className="text-gray-300">
              {dataPreview}
              {artifact.content.length > 150 && "..."}
            </code>
          </pre>
        )
      default:
        return <p className="text-sm text-gray-500">Preview not available</p>
    }
  }

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-6xl h-[90vh]">
          <ArtifactViewer
            artifact={artifact}
            onClose={() => setIsExpanded(false)}
            fullscreen
            editable
          />
        </div>
      </div>
    )
  }

  return (
    <GlassCard className={cn("p-4 hover:bg-white/5 transition-colors", className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getIcon()}
          <h4 className="font-medium">{artifact.title}</h4>
          <Badge variant="secondary" className="text-xs">
            {artifact.type}
          </Badge>
          {artifact.language && (
            <Badge variant="outline" className="text-xs">
              {artifact.language}
            </Badge>
          )}
        </div>
        <GlassButton
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(true)}
          className="h-7 w-7"
        >
          <Maximize2 className="h-3 w-3" />
        </GlassButton>
      </div>
      
      <div className="space-y-2">
        {getPreviewContent()}
      </div>
    </GlassCard>
  )
}