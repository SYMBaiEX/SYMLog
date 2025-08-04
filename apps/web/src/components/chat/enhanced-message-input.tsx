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
import { MODEL_CONFIGS } from "@/lib/ai/model-orchestration"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

  // Get models from orchestration config with proper capabilities
  const models = Object.values(MODEL_CONFIGS).map(config => ({
    value: config.id,
    label: config.displayName,
    provider: 'OpenAI',
    tier: config.capabilities.costTier,
    description: config.description,
    useCase: config.useCase,
    requiresExplicitSelection: config.requiresExplicitSelection,
    benchmarks: config.benchmarks,
    pricing: config.pricing
  })).sort((a, b) => {
    // Sort: regular models first, then expensive reasoning models
    if (a.requiresExplicitSelection && !b.requiresExplicitSelection) return 1
    if (!a.requiresExplicitSelection && b.requiresExplicitSelection) return -1
    // Then by cost (nano -> mini -> premium)
    const tierOrder = { nano: 1, mini: 2, standard: 3, premium: 4 }
    return tierOrder[a.tier] - tierOrder[b.tier]
  })

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
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassButton variant="ghost" size="sm" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {currentModel ? models.find(m => m.value === currentModel)?.label?.replace(/^gpt-/, 'GPT-').replace(/^o(\d)/, 'o$1') || 'Model' : 'Select Model'}
                  <ChevronDown className="h-3 w-3" />
                </GlassButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass min-w-[400px] max-h-[500px] overflow-y-auto">
                <DropdownMenuLabel>AI Model Selection</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Regular Models */}
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Recommended Models
                </div>
                {models.filter(model => !model.requiresExplicitSelection).map((model) => (
                  <Tooltip key={model.value}>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem
                        onClick={() => onModelChange(model.value)}
                        className={cn(
                          "gap-3 min-h-[70px] items-start cursor-pointer",
                          currentModel === model.value && "bg-accent"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-medium text-sm">{model.label}</div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                model.tier === 'nano' && "border-green-500/50 text-green-400",
                                model.tier === 'mini' && "border-yellow-500/50 text-yellow-400",
                                model.tier === 'standard' && "border-blue-500/50 text-blue-400",
                                model.tier === 'premium' && "border-red-500/50 text-red-400"
                              )}
                            >
                              {model.tier}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              ${model.pricing.input}/1M + ${model.pricing.output}/1M
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {model.useCase}
                          </div>
                        </div>
                        {currentModel === model.value && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Active
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="glass max-w-xs">
                      <div className="space-y-2">
                        <div className="font-medium">{model.label}</div>
                        <div className="text-sm">{model.description}</div>
                        <div className="flex gap-4 text-xs">
                          <span>Input: ${model.pricing.input}/1M</span>
                          <span>Output: ${model.pricing.output}/1M</span>
                          {model.pricing.cached && <span>Cached: ${model.pricing.cached}/1M</span>}
                        </div>
                        {model.benchmarks && Object.keys(model.benchmarks).length > 0 && (
                          <div className="text-xs">
                            <strong>Benchmarks:</strong> {Object.entries(model.benchmarks).map(([key, value]) => `${key}: ${value}`).join(', ')}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                <DropdownMenuSeparator />
                
                {/* Expensive Reasoning Models */}
                <div className="px-2 py-1 text-xs font-medium text-orange-400 flex items-center gap-1">
                  <span>⚠️</span> Advanced Reasoning Models (Expensive)
                </div>
                {models.filter(model => model.requiresExplicitSelection).map((model) => (
                  <Tooltip key={model.value}>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem
                        onClick={() => onModelChange(model.value)}
                        className={cn(
                          "gap-3 min-h-[70px] items-start cursor-pointer border-l-2 border-orange-500/50",
                          currentModel === model.value && "bg-accent"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-medium text-sm">{model.label}</div>
                            <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                              PREMIUM
                            </Badge>
                            <div className="text-xs text-orange-400 font-medium">
                              ~10x cost
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {model.useCase}
                          </div>
                          <div className="text-xs text-orange-400">
                            Requires explicit selection • ${model.pricing.input}/1M + ${model.pricing.output}/1M
                          </div>
                        </div>
                        {currentModel === model.value && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Active
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="glass max-w-xs">
                      <div className="space-y-2">
                        <div className="font-medium text-orange-400">{model.label}</div>
                        <div className="text-sm">{model.description}</div>
                        <div className="text-xs text-orange-300">
                          <strong>⚠️ High Cost:</strong> This model is significantly more expensive than standard models. Use only when advanced reasoning is required.
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span>Input: ${model.pricing.input}/1M</span>
                          <span>Output: ${model.pricing.output}/1M</span>
                          {model.pricing.cached && <span>Cached: ${model.pricing.cached}/1M</span>}
                        </div>
                        {model.benchmarks && Object.keys(model.benchmarks).length > 0 && (
                          <div className="text-xs">
                            <strong>Benchmarks:</strong> {Object.entries(model.benchmarks).map(([key, value]) => `${key}: ${value}`).join(', ')}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>

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

      {/* Model selection help */}
      {!currentModel && (
        <div className="px-4 pb-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            <span>Select a model above to start chatting. Use GPT-4.1 Nano for general tasks, or reasoning models for complex problems.</span>
          </div>
        </div>
      )}
      
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