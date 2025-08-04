"use client"

import { useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import type { FileAttachment, MessageWithAttachments } from "@/types/attachments"
import { GlassButton } from "@/components/ui/glass-button"
import { 
  Send, 
  Paperclip, 
  Sparkles, 
  Bot,
  Code,
  Palette,
  ChevronDown
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

interface MessageInputProps {
  isLoading: boolean
  onSendMessage: (message: MessageWithAttachments) => void
  onModelChange: (model: string) => void
  onPromptTypeChange: (type: 'default' | 'technical' | 'creative') => void
  currentModel?: string
  currentPromptType: 'default' | 'technical' | 'creative'
}

export function MessageInput({
  isLoading,
  onSendMessage,
  onModelChange,
  onPromptTypeChange,
  currentModel,
  currentPromptType,
}: MessageInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() || attachments.length > 0) {
        onSendMessage({ text: input.trim(), attachments })
        setInput('')
        setAttachments([])
      }
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim() || attachments.length > 0) {
      onSendMessage({ text: input.trim(), attachments })
      setInput('')
      setAttachments([])
    }
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

          {/* File attachment */}
          <FileUpload
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            disabled={isLoading}
          />
        </div>

        {/* Input area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask me anything..."
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
      
      {/* Character/token count */}
      <div className="flex justify-between items-center mt-2 px-2">
        <p className="text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
        <p className="text-xs text-muted-foreground">
          {input.length} characters
        </p>
      </div>
    </form>
  )
}