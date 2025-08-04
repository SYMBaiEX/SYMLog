"use client"

import { memo, useEffect } from 'react'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'
import { GlassButton } from './glass-button'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

// Import Prism CSS for syntax highlighting
import 'prismjs/themes/prism-dark.css'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

interface CodeBlockProps {
  children: string
  className?: string
  inline?: boolean
}

function CodeBlock({ children, className, inline }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('language-', '') || 'text'
  
  // Cleanup timeout on unmount
  useEffect(() => {
    if (copied) {
      const timeoutId = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timeoutId)
    }
  }, [copied])
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      toast.success('Code copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy code')
    }
  }

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 text-sm bg-white/10 text-amber-300 rounded font-mono">
        {children}
      </code>
    )
  }

  return (
    <div className="relative group my-4">
      <div className="glass rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <span className="text-sm text-muted-foreground font-medium">
            {language}
          </span>
          <GlassButton
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={copyToClipboard}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </GlassButton>
        </div>
        <pre className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <code className={`language-${language}`}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  )
}

function TableComponent({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse glass rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  )
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-white/5">
      {children}
    </thead>
  )
}

function TableRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-white/10 hover:bg-white/5 transition-colors">
      {children}
    </tr>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-2 text-sm">
      {children}
    </td>
  )
}

function TableHeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
      {children}
    </th>
  )
}

function BlockquoteComponent({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-4 pl-4 py-2 border-l-4 border-periwinkle/50 bg-periwinkle/10 rounded-r">
      <div className="text-muted-foreground italic">
        {children}
      </div>
    </blockquote>
  )
}

function ListComponent({ children, ordered }: { children: React.ReactNode; ordered?: boolean }) {
  const Component = ordered ? 'ol' : 'ul'
  return (
    <Component className={cn(
      "my-2 space-y-1 text-sm",
      ordered ? "list-decimal list-inside" : "list-disc list-inside"
    )}>
      {children}
    </Component>
  )
}

function ListItemComponent({ children }: { children: React.ReactNode }) {
  return (
    <li className="leading-relaxed">
      {children}
    </li>
  )
}

function LinkComponent({ href, children }: { href?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-periwinkle hover:text-periwinkle/80 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  )
}

function HeadingComponent({ level, children }: { level: number; children: React.ReactNode }) {
  const headingClasses = {
    1: "text-2xl font-bold mt-6 mb-4 text-white",
    2: "text-xl font-bold mt-5 mb-3 text-white",
    3: "text-lg font-semibold mt-4 mb-2 text-white",
    4: "text-base font-semibold mt-3 mb-2 text-white",
    5: "text-sm font-semibold mt-2 mb-1 text-white",
    6: "text-xs font-semibold mt-2 mb-1 text-white",
  }

  const className = headingClasses[level as keyof typeof headingClasses] || headingClasses[6]

  switch (level) {
    case 1: return <h1 className={className}>{children}</h1>
    case 2: return <h2 className={className}>{children}</h2>
    case 3: return <h3 className={className}>{children}</h3>
    case 4: return <h4 className={className}>{children}</h4>
    case 5: return <h5 className={className}>{children}</h5>
    case 6: return <h6 className={className}>{children}</h6>
    default: return <h6 className={className}>{children}</h6>
  }
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code: ({ children, className, ...props }) => {
            const isInline = !className
            return (
              <CodeBlock
                className={className}
                inline={isInline}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            )
          },
          table: TableComponent as any,
          thead: TableHead as any,
          tbody: (({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>) as any,
          tr: TableRow as any,
          td: TableCell as any,
          th: TableHeaderCell as any,
          blockquote: BlockquoteComponent as any,
          ul: (({ children }: { children: React.ReactNode }) => <ListComponent>{children}</ListComponent>) as any,
          ol: (({ children }: { children: React.ReactNode }) => <ListComponent ordered>{children}</ListComponent>) as any,
          li: ListItemComponent as any,
          a: (({ href, children }: { href?: string; children: React.ReactNode }) => <LinkComponent href={href}>{children}</LinkComponent>) as any,
          h1: (({ children }: { children: React.ReactNode }) => <HeadingComponent level={1}>{children}</HeadingComponent>) as any,
          h2: (({ children }: { children: React.ReactNode }) => <HeadingComponent level={2}>{children}</HeadingComponent>) as any,
          h3: (({ children }: { children: React.ReactNode }) => <HeadingComponent level={3}>{children}</HeadingComponent>) as any,
          h4: (({ children }: { children: React.ReactNode }) => <HeadingComponent level={4}>{children}</HeadingComponent>) as any,
          h5: (({ children }: { children: React.ReactNode }) => <HeadingComponent level={5}>{children}</HeadingComponent>) as any,
          h6: (({ children }: { children: React.ReactNode }) => <HeadingComponent level={6}>{children}</HeadingComponent>) as any,
          p: (({ children }: { children: React.ReactNode }) => (
            <p className="mb-3 leading-relaxed text-sm text-gray-100">
              {children}
            </p>
          )) as any,
          hr: (() => <hr className="my-6 border-white/20" />) as any,
          em: (({ children }: { children: React.ReactNode }) => <em className="text-periwinkle italic">{children}</em>) as any,
          strong: (({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-white">{children}</strong>) as any,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})