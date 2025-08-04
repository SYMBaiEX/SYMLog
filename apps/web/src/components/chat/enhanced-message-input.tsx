"use client"

import { useState, useRef } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import type { FileAttachment, MessageWithAttachments } from "@/types/attachments"
import { GlassButton } from "@/components/ui/glass-button"  
import { GlassCard } from "@/components/ui/glass-card"
import { 
  Send, 
  Eye, 
  EyeOff,
  Sparkles, 
  Bot,
  Code,
  Palette,
  ChevronDown,
  Type,
  Hash,
  List,
  Quote,
  Link2,
  Bold,
  Italic
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { FileUpload } from "./file-upload"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

interface EnhancedMessageInputProps {
  isLoading: boolean
  onSendMessage: (message: MessageWithAttachments) => void
  onModelChange: (model: string) => void
  onPromptTypeChange: (type: 'default' | 'technical' | 'creative') => void
  currentModel?: string
  currentPromptType: 'default' | 'technical' | 'creative'
}

export function EnhancedMessageInput({
  isLoading,
  onSendMessage,
  onModelChange,
  onPromptTypeChange,
  currentModel,
  currentPromptType,
}: EnhancedMessageInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() || attachments.length > 0) {
        onSendMessage({ text: input.trim(), attachments })
        setInput('')
        setAttachments([])
        setShowPreview(false)
      }
    }
    
    // Handle markdown shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault()
          insertMarkdown('**', '**')
          break
        case 'i':
          e.preventDefault()
          insertMarkdown('*', '*')
          break
        case 'k':
          e.preventDefault()
          insertMarkdown('[', '](url)')
          break
      }
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim() || attachments.length > 0) {
      onSendMessage({ text: input.trim(), attachments })
      setInput('')
      setAttachments([])
      setShowPreview(false)
    }
  }

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = input.substring(start, end)
    const newText = input.substring(0, start) + before + selectedText + after + input.substring(end)
    
    setInput(newText)
    
    // Set cursor position
    setTimeout(() => {
      const newPosition = start + before.length + selectedText.length
      textarea.setSelectionRange(newPosition, newPosition)
      textarea.focus()
    }, 0)
  }

  const insertMarkdownBlock = (syntax: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const newText = input.substring(0, start) + syntax + input.substring(start)
    
    setInput(newText)
    
    setTimeout(() => {
      const newPosition = start + syntax.length
      textarea.setSelectionRange(newPosition, newPosition)
      textarea.focus()
    }, 0)
  }

  const promptTypes = [
    { value: 'default', label: 'General', icon: Bot, description: 'Balanced assistance' },
    { value: 'technical', label: 'Technical', icon: Code, description: 'Code & development' },
    { value: 'creative', label: 'Creative', icon: Palette, description: 'Ideas & innovation' },
  ] as const

  const models = [
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo', provider: 'OpenAI' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
  ]

  const markdownTools = [
    { label: 'Heading', icon: Hash, action: () => insertMarkdownBlock('# ') },
    { label: 'Bold', icon: Bold, action: () => insertMarkdown('**', '**') },
    { label: 'Italic', icon: Italic, action: () => insertMarkdown('*', '*') },
    { label: 'Code', icon: Code, action: () => insertMarkdown('`', '`') },
    { label: 'Link', icon: Link2, action: () => insertMarkdown('[', '](url)') },
    { label: 'List', icon: List, action: () => insertMarkdownBlock('- ') },
    { label: 'Quote', icon: Quote, action: () => insertMarkdownBlock('> ') },
  ]

  const selectedPromptType = promptTypes.find(t => t.value === currentPromptType)

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={cn(
          "glass rounded-2xl transition-all duration-300",
          isFocused && "ring-2 ring-periwinkle/50 glow-periwinkle"
        )}
      >
        {/* Options bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
          {/* Prompt type selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassButton variant="ghost" size="sm" className="gap-2">
                {selectedPromptType && (
                  <>
                    <selectedPromptType.icon className="h-4 w-4" />
                    {selectedPromptType.label}
                  </>
                )}
                <ChevronDown className="h-3 w-3" />
              </GlassButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass">
              <DropdownMenuLabel>Assistant Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {promptTypes.map((type) => {
                const Icon = type.icon
                return (
                  <DropdownMenuItem
                    key={type.value}
                    onClick={() => onPromptTypeChange(type.value)}
                    className={cn(
                      "gap-3",
                      currentPromptType === type.value && "bg-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassButton variant="ghost" size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Model
                <ChevronDown className="h-3 w-3" />
              </GlassButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="glass min-w-[200px]">
              <DropdownMenuLabel>AI Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {models.map((model) => (
                <DropdownMenuItem
                  key={model.value}
                  onClick={() => onModelChange(model.value)}
                  className={cn(
                    "gap-3",
                    currentModel === model.value && "bg-accent"
                  )}
                >
                  <div className="flex-1">
                    <div className="font-medium">{model.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {model.provider}
                    </div>
                  </div>
                  {currentModel === model.value && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          {/* Markdown tools */}
          <div className="flex items-center gap-1">
            {markdownTools.map((tool) => (
              <GlassButton
                key={tool.label}
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={tool.label}
                onClick={tool.action}
              >
                <tool.icon className="h-3 w-3" />
              </GlassButton>
            ))}
          </div>

          {/* Preview toggle */}
          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </GlassButton>

          {/* File attachment */}
          <FileUpload
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            disabled={isLoading}
          />
        </div>

        {/* Input area */}
        <div className="relative">
          {showPreview && input.trim() ? (
            <div className="flex">
              <div className="flex-1 p-4 border-r border-white/10">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Type your message in Markdown..."
                  disabled={isLoading}
                  rows={4}
                  className={cn(
                    "w-full bg-transparent resize-none",
                    "placeholder:text-muted-foreground/50",
                    "focus:outline-none",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "min-h-[120px] font-mono text-sm"
                  )}
                />
              </div>
              <div className="flex-1 p-4 max-h-[300px] overflow-y-auto">
                <div className="text-xs text-muted-foreground mb-2">Preview:</div>
                <MarkdownRenderer content={input} />
              </div>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask me anything... (Markdown supported)"
              disabled={isLoading}
              rows={1}
              className={cn(
                "w-full px-4 py-3 pr-12 bg-transparent resize-none",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "max-h-[200px] min-h-[52px]"
              )}
              style={{
                height: 'auto',
                overflowY: input.split('\n').length > 5 ? 'auto' : 'hidden',
              }}
            />
          )}
          
          <GlassButton
            type="submit"
            size="icon"
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            className={cn(
              "absolute right-2 bottom-2 h-8 w-8",
              (input.trim() || attachments.length > 0) && !isLoading && "glow-primary"
            )}
          >
            <Send className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>
      
      {/* Character/token count and help */}
      <div className="flex justify-between items-center mt-2 px-2">
        <p className="text-xs text-muted-foreground">
          {showPreview ? "Live preview enabled" : "Ctrl+B: Bold, Ctrl+I: Italic, Ctrl+K: Link"}
        </p>
        <p className="text-xs text-muted-foreground">
          {input.length} characters
        </p>
      </div>
    </form>
  )
}