"use client"

import { useEffect, useState } from "react"
import type { DocumentArtifact } from "@/types/artifacts"
import { cn } from "@/lib/utils"
import { marked } from "marked"
import DOMPurify from "dompurify"

interface DocumentViewerProps {
  artifact: DocumentArtifact
  className?: string
}

export function DocumentViewer({ artifact, className }: DocumentViewerProps) {
  const [renderedContent, setRenderedContent] = useState("")

  useEffect(() => {
    const renderContent = async () => {
      if (artifact.format === "markdown") {
        // Configure marked options
        marked.setOptions({
          breaks: true,
          gfm: true,
        })

        // Render markdown to HTML
        const rawHtml = await marked(artifact.content)
        
        // Sanitize HTML to prevent XSS
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
          ADD_ATTR: ["target"],
        })
        
        setRenderedContent(cleanHtml)
      } else if (artifact.format === "html") {
        // Sanitize HTML content
        const cleanHtml = DOMPurify.sanitize(artifact.content, {
          ADD_ATTR: ["target"],
        })
        setRenderedContent(cleanHtml)
      } else {
        // Plain text - convert newlines to <br> tags
        const escaped = artifact.content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
          .replace(/\n/g, "<br>")
        setRenderedContent(escaped)
      }
    }

    renderContent()
  }, [artifact.content, artifact.format])

  return (
    <div
      className={cn(
        "prose prose-invert max-w-none p-6 overflow-auto",
        "prose-headings:text-white prose-p:text-gray-300",
        "prose-a:text-periwinkle prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-white prose-code:text-light-green",
        "prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10",
        "prose-blockquote:border-l-periwinkle prose-blockquote:text-gray-400",
        "prose-ul:text-gray-300 prose-ol:text-gray-300",
        "prose-table:border-collapse prose-th:border prose-th:border-white/20",
        "prose-td:border prose-td:border-white/20 prose-th:bg-black/40",
        "scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent",
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}