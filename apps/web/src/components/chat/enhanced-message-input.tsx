'use client';

import {
  Bold,
  Bot,
  ChevronDown,
  Code,
  Eye,
  EyeOff,
  Hash,
  Italic,
  Link2,
  List,
  Palette,
  Quote,
  Send,
  Sparkles,
  Type,
} from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MODEL_CONFIGS } from '@/lib/ai/intelligence';
import { cn } from '@/lib/utils';
import type {
  FileAttachment,
  MessageWithAttachments,
} from '@/types/attachments';
import { FileUpload } from './file-upload';

interface EnhancedMessageInputProps {
  isLoading: boolean;
  onSendMessage: (message: MessageWithAttachments) => void;
  onModelChange: (model: string) => void;
  onPromptTypeChange: (type: 'default' | 'technical' | 'creative') => void;
  currentModel?: string;
  currentPromptType: 'default' | 'technical' | 'creative';
}

export function EnhancedMessageInput({
  isLoading,
  onSendMessage,
  onModelChange,
  onPromptTypeChange,
  currentModel,
  currentPromptType,
}: EnhancedMessageInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachments.length > 0) {
        onSendMessage({ text: input.trim(), attachments });
        setInput('');
        setAttachments([]);
        setShowPreview(false);
      }
    }

    // Handle markdown shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          insertMarkdown('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertMarkdown('*', '*');
          break;
        case 'k':
          e.preventDefault();
          insertMarkdown('[', '](url)');
          break;
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() || attachments.length > 0) {
      onSendMessage({ text: input.trim(), attachments });
      setInput('');
      setAttachments([]);
      setShowPreview(false);
    }
  };

  const insertMarkdown = (before: string, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);
    const newText =
      input.substring(0, start) +
      before +
      selectedText +
      after +
      input.substring(end);

    setInput(newText);

    // Set cursor position
    setTimeout(() => {
      const newPosition = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
  };

  const insertMarkdownBlock = (syntax: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText = input.substring(0, start) + syntax + input.substring(start);

    setInput(newText);

    setTimeout(() => {
      const newPosition = start + syntax.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
  };

  const promptTypes = [
    {
      value: 'default',
      label: 'General',
      icon: Bot,
      description: 'Balanced assistance',
    },
    {
      value: 'technical',
      label: 'Technical',
      icon: Code,
      description: 'Code & development',
    },
    {
      value: 'creative',
      label: 'Creative',
      icon: Palette,
      description: 'Ideas & innovation',
    },
  ] as const;

  // Get models from orchestration config with proper capabilities
  const models = Object.values(MODEL_CONFIGS)
    .map((config) => ({
      value: config.id,
      label: config.displayName,
      provider: 'OpenAI',
      tier: config.capabilities.costTier,
      description: config.description,
      useCase: config.useCase,
      requiresExplicitSelection: config.requiresExplicitSelection,
      benchmarks: config.benchmarks,
      pricing: config.pricing,
    }))
    .sort((a, b) => {
      // Sort: regular models first, then expensive reasoning models
      if (a.requiresExplicitSelection && !b.requiresExplicitSelection) return 1;
      if (!a.requiresExplicitSelection && b.requiresExplicitSelection)
        return -1;
      // Then by cost (nano -> mini -> premium)
      const tierOrder = { nano: 1, mini: 2, standard: 3, premium: 4 };
      return tierOrder[a.tier] - tierOrder[b.tier];
    });

  const markdownTools = [
    { label: 'Heading', icon: Hash, action: () => insertMarkdownBlock('# ') },
    { label: 'Bold', icon: Bold, action: () => insertMarkdown('**', '**') },
    { label: 'Italic', icon: Italic, action: () => insertMarkdown('*', '*') },
    { label: 'Code', icon: Code, action: () => insertMarkdown('`', '`') },
    { label: 'Link', icon: Link2, action: () => insertMarkdown('[', '](url)') },
    { label: 'List', icon: List, action: () => insertMarkdownBlock('- ') },
    { label: 'Quote', icon: Quote, action: () => insertMarkdownBlock('> ') },
  ];

  const selectedPromptType = promptTypes.find(
    (t) => t.value === currentPromptType
  );

  return (
    <form className="relative" onSubmit={handleSubmit}>
      <div
        className={cn(
          'glass rounded-2xl transition-all duration-300',
          isFocused && 'glow-periwinkle ring-2 ring-periwinkle/50'
        )}
      >
        {/* Options bar */}
        <div className="flex items-center gap-2 border-white/10 border-b px-4 py-2">
          {/* Prompt type selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassButton className="gap-2" size="sm" variant="ghost">
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
                const Icon = type.icon;
                return (
                  <DropdownMenuItem
                    className={cn(
                      'gap-3',
                      currentPromptType === type.value && 'bg-accent'
                    )}
                    key={type.value}
                    onClick={() => onPromptTypeChange(type.value)}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{type.label}</div>
                      <div className="text-muted-foreground text-xs">
                        {type.description}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model selector */}
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassButton className="gap-2" size="sm" variant="ghost">
                  <Sparkles className="h-4 w-4" />
                  {currentModel
                    ? models
                        .find((m) => m.value === currentModel)
                        ?.label?.replace(/^gpt-/, 'GPT-')
                        .replace(/^o(\d)/, 'o$1') || 'Model'
                    : 'Select Model'}
                  <ChevronDown className="h-3 w-3" />
                </GlassButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="glass max-h-[500px] min-w-[400px] overflow-y-auto"
              >
                <DropdownMenuLabel>AI Model Selection</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Regular Models */}
                <div className="px-2 py-1 font-medium text-muted-foreground text-xs">
                  Recommended Models
                </div>
                {models
                  .filter((model) => !model.requiresExplicitSelection)
                  .map((model) => (
                    <Tooltip key={model.value}>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem
                          className={cn(
                            'min-h-[70px] cursor-pointer items-start gap-3',
                            currentModel === model.value && 'bg-accent'
                          )}
                          onClick={() => onModelChange(model.value)}
                        >
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="font-medium text-sm">
                                {model.label}
                              </div>
                              <Badge
                                className={cn(
                                  'text-xs',
                                  model.tier === 'nano' &&
                                    'border-green-500/50 text-green-400',
                                  model.tier === 'mini' &&
                                    'border-yellow-500/50 text-yellow-400',
                                  model.tier === 'standard' &&
                                    'border-blue-500/50 text-blue-400',
                                  model.tier === 'premium' &&
                                    'border-red-500/50 text-red-400'
                                )}
                                variant="outline"
                              >
                                {model.tier}
                              </Badge>
                              <div className="text-muted-foreground text-xs">
                                ${model.pricing.input}/1M + $
                                {model.pricing.output}/1M
                              </div>
                            </div>
                            <div className="mb-1 text-muted-foreground text-xs">
                              {model.useCase}
                            </div>
                          </div>
                          {currentModel === model.value && (
                            <Badge className="mt-1 text-xs" variant="secondary">
                              Active
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent className="glass max-w-xs" side="left">
                        <div className="space-y-2">
                          <div className="font-medium">{model.label}</div>
                          <div className="text-sm">{model.description}</div>
                          <div className="flex gap-4 text-xs">
                            <span>Input: ${model.pricing.input}/1M</span>
                            <span>Output: ${model.pricing.output}/1M</span>
                            {model.pricing.cached && (
                              <span>Cached: ${model.pricing.cached}/1M</span>
                            )}
                          </div>
                          {model.benchmarks &&
                            Object.keys(model.benchmarks).length > 0 && (
                              <div className="text-xs">
                                <strong>Benchmarks:</strong>{' '}
                                {Object.entries(model.benchmarks)
                                  .map(([key, value]) => `${key}: ${value}`)
                                  .join(', ')}
                              </div>
                            )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}

                <DropdownMenuSeparator />

                {/* Expensive Reasoning Models */}
                <div className="flex items-center gap-1 px-2 py-1 font-medium text-orange-400 text-xs">
                  <span>⚠️</span> Advanced Reasoning Models (Expensive)
                </div>
                {models
                  .filter((model) => model.requiresExplicitSelection)
                  .map((model) => (
                    <Tooltip key={model.value}>
                      <TooltipTrigger asChild>
                        <DropdownMenuItem
                          className={cn(
                            'min-h-[70px] cursor-pointer items-start gap-3 border-orange-500/50 border-l-2',
                            currentModel === model.value && 'bg-accent'
                          )}
                          onClick={() => onModelChange(model.value)}
                        >
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <div className="font-medium text-sm">
                                {model.label}
                              </div>
                              <Badge
                                className="border-red-500/50 text-red-400 text-xs"
                                variant="outline"
                              >
                                PREMIUM
                              </Badge>
                              <div className="font-medium text-orange-400 text-xs">
                                ~10x cost
                              </div>
                            </div>
                            <div className="mb-1 text-muted-foreground text-xs">
                              {model.useCase}
                            </div>
                            <div className="text-orange-400 text-xs">
                              Requires explicit selection • $
                              {model.pricing.input}/1M + ${model.pricing.output}
                              /1M
                            </div>
                          </div>
                          {currentModel === model.value && (
                            <Badge className="mt-1 text-xs" variant="secondary">
                              Active
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      </TooltipTrigger>
                      <TooltipContent className="glass max-w-xs" side="left">
                        <div className="space-y-2">
                          <div className="font-medium text-orange-400">
                            {model.label}
                          </div>
                          <div className="text-sm">{model.description}</div>
                          <div className="text-orange-300 text-xs">
                            <strong>⚠️ High Cost:</strong> This model is
                            significantly more expensive than standard models.
                            Use only when advanced reasoning is required.
                          </div>
                          <div className="flex gap-4 text-xs">
                            <span>Input: ${model.pricing.input}/1M</span>
                            <span>Output: ${model.pricing.output}/1M</span>
                            {model.pricing.cached && (
                              <span>Cached: ${model.pricing.cached}/1M</span>
                            )}
                          </div>
                          {model.benchmarks &&
                            Object.keys(model.benchmarks).length > 0 && (
                              <div className="text-xs">
                                <strong>Benchmarks:</strong>{' '}
                                {Object.entries(model.benchmarks)
                                  .map(([key, value]) => `${key}: ${value}`)
                                  .join(', ')}
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
                className="h-8 w-8"
                key={tool.label}
                onClick={tool.action}
                size="icon"
                title={tool.label}
                type="button"
                variant="ghost"
              >
                <tool.icon className="h-3 w-3" />
              </GlassButton>
            ))}
          </div>

          {/* Preview toggle */}
          <GlassButton
            className="h-8 w-8"
            onClick={() => setShowPreview(!showPreview)}
            size="icon"
            title={showPreview ? 'Hide preview' : 'Show preview'}
            type="button"
            variant="ghost"
          >
            {showPreview ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </GlassButton>

          {/* File attachment */}
          <FileUpload
            attachments={attachments}
            disabled={isLoading}
            onAttachmentsChange={setAttachments}
          />
        </div>

        {/* Input area */}
        <div className="relative">
          {showPreview && input.trim() ? (
            <div className="flex">
              <div className="flex-1 border-white/10 border-r p-4">
                <textarea
                  className={cn(
                    'w-full resize-none bg-transparent',
                    'placeholder:text-muted-foreground/50',
                    'focus:outline-none',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'min-h-[120px] font-mono text-sm'
                  )}
                  disabled={isLoading}
                  onBlur={() => setIsFocused(false)}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message in Markdown..."
                  ref={textareaRef}
                  rows={4}
                  value={input}
                />
              </div>
              <div className="max-h-[300px] flex-1 overflow-y-auto p-4">
                <div className="mb-2 text-muted-foreground text-xs">
                  Preview:
                </div>
                <MarkdownRenderer content={input} />
              </div>
            </div>
          ) : (
            <textarea
              className={cn(
                'w-full resize-none bg-transparent px-4 py-3 pr-12',
                'placeholder:text-muted-foreground/50',
                'focus:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'max-h-[200px] min-h-[52px]'
              )}
              disabled={isLoading}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything... (Markdown supported)"
              ref={textareaRef}
              rows={1}
              style={{
                height: 'auto',
                overflowY: input.split('\n').length > 5 ? 'auto' : 'hidden',
              }}
              value={input}
            />
          )}

          <GlassButton
            className={cn(
              'absolute right-2 bottom-2 h-8 w-8',
              (input.trim() || attachments.length > 0) &&
                !isLoading &&
                'glow-primary'
            )}
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            size="icon"
            type="submit"
          >
            <Send className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Model selection help */}
      {!currentModel && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Sparkles className="h-3 w-3" />
            <span>
              Select a model above to start chatting. Use GPT-4.1 Nano for
              general tasks, or reasoning models for complex problems.
            </span>
          </div>
        </div>
      )}

      {/* Character/token count and help */}
      <div className="mt-2 flex items-center justify-between px-2">
        <p className="text-muted-foreground text-xs">
          {showPreview
            ? 'Live preview enabled'
            : 'Ctrl+B: Bold, Ctrl+I: Italic, Ctrl+K: Link'}
        </p>
        <p className="text-muted-foreground text-xs">
          {input.length} characters
        </p>
      </div>
    </form>
  );
}
