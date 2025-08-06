'use client';

import {
  Bot,
  ChevronDown,
  Code,
  Palette,
  Paperclip,
  Send,
  Sparkles,
} from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import type {
  FileAttachment,
  MessageWithAttachments,
} from '@/types/attachments';
import { FileUpload } from './file-upload';

interface MessageInputProps {
  isLoading: boolean;
  onSendMessage: (message: MessageWithAttachments) => void;
  onModelChange: (model: string) => void;
  onPromptTypeChange: (type: 'default' | 'technical' | 'creative') => void;
  currentModel?: string;
  currentPromptType: 'default' | 'technical' | 'creative';
}

export function MessageInput({
  isLoading,
  onSendMessage,
  onModelChange,
  onPromptTypeChange,
  currentModel,
  currentPromptType,
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachments.length > 0) {
        onSendMessage({ text: input.trim(), attachments });
        setInput('');
        setAttachments([]);
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() || attachments.length > 0) {
      onSendMessage({ text: input.trim(), attachments });
      setInput('');
      setAttachments([]);
    }
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

  const models = [
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo', provider: 'OpenAI' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI' },
    {
      value: 'claude-3-sonnet-20240229',
      label: 'Claude 3 Sonnet',
      provider: 'Anthropic',
    },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassButton className="gap-2" size="sm" variant="ghost">
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
                  className={cn(
                    'gap-3',
                    currentModel === model.value && 'bg-accent'
                  )}
                  key={model.value}
                  onClick={() => onModelChange(model.value)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{model.label}</div>
                    <div className="text-muted-foreground text-xs">
                      {model.provider}
                    </div>
                  </div>
                  {currentModel === model.value && (
                    <Badge className="text-xs" variant="secondary">
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
            disabled={isLoading}
            onAttachmentsChange={setAttachments}
          />
        </div>

        {/* Input area */}
        <div className="relative">
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
            placeholder="Ask me anything..."
            rows={1}
            style={{
              height: 'auto',
              overflowY: input.split('\n').length > 5 ? 'auto' : 'hidden',
            }}
            value={input}
          />

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

      {/* Character/token count */}
      <div className="mt-2 flex items-center justify-between px-2">
        <p className="text-muted-foreground text-xs">
          Press Enter to send, Shift+Enter for new line
        </p>
        <p className="text-muted-foreground text-xs">
          {input.length} characters
        </p>
      </div>
    </form>
  );
}
