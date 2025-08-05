'use client';

import type { UIMessage } from '@ai-sdk/react';
import {
  Check,
  Copy,
  Edit3,
  GitBranch,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useTreeOperations } from '@/contexts/conversation-tree-context';
import { cn } from '@/lib/utils';

interface EditableMessageProps {
  nodeId: string;
  message: UIMessage;
  isEditing?: boolean;
  canEdit?: boolean;
  canRegenerate?: boolean;
  onEdit?: (nodeId: string, newContent: string, createBranch: boolean) => void;
  onRegenerate?: (nodeId: string) => void;
  onCopy?: (content: string) => void;
  className?: string;
}

function EditableMessageComponent({
  nodeId,
  message,
  isEditing: initialEditing = false,
  canEdit = true,
  canRegenerate = false,
  onEdit,
  onRegenerate,
  onCopy,
  className,
}: EditableMessageProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editContent, setEditContent] = useState('');
  const [showBranchOption, setShowBranchOption] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    editMessage,
    regenerateMessage,
    createBranchFromMessage,
    deleteMessage,
  } = useTreeOperations();

  const messageContent = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');

  // Initialize edit content when entering edit mode
  useEffect(() => {
    if (isEditing && editContent === '') {
      setEditContent(messageContent);
    }
  }, [isEditing, messageContent, editContent]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        0,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (!canEdit) return;
    setIsEditing(true);
    setEditContent(messageContent);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
    setShowBranchOption(false);
  };

  const handleSaveEdit = (createBranch: boolean) => {
    if (editContent.trim() === messageContent.trim()) {
      handleCancelEdit();
      return;
    }

    try {
      if (onEdit) {
        onEdit(nodeId, editContent.trim(), createBranch);
      } else {
        editMessage(nodeId, editContent.trim(), createBranch);
      }

      setIsEditing(false);
      setEditContent('');
      setShowBranchOption(false);

      toast.success(
        createBranch ? 'Message edited and branch created' : 'Message updated'
      );
    } catch (error) {
      toast.error('Failed to edit message');
      console.error('Edit error:', error);
    }
  };

  const handleRegenerate = () => {
    if (!canRegenerate) return;

    try {
      if (onRegenerate) {
        onRegenerate(nodeId);
      } else {
        regenerateMessage(nodeId);
      }
      toast.success('Regenerating response...');
    } catch (error) {
      toast.error('Failed to regenerate message');
      console.error('Regenerate error:', error);
    }
  };

  const handleCopy = () => {
    const content = isEditing ? editContent : messageContent;
    navigator.clipboard.writeText(content);
    if (onCopy) {
      onCopy(content);
    }
    toast.success('Copied to clipboard');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowBranchOption(true);
    }
  };

  const handleCreateBranch = () => {
    try {
      const branchId = createBranchFromMessage(nodeId);
      toast.success('Branch created successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create branch'
      );
    }
  };

  const handleDeleteMessage = () => {
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteMessage = async () => {
    try {
      deleteMessage(nodeId, false);
      toast.success('Message deleted');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete message'
      );
      throw error;
    }
  };

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (isEditing) {
    return (
      <GlassCard className={cn('border-periwinkle/50 p-4', className)}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Edit3 className="h-4 w-4" />
            Editing message
          </div>

          <textarea
            className="min-h-[100px] w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm focus:border-periwinkle/50 focus:outline-none"
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Edit your message..."
            ref={textareaRef}
            value={editContent}
          />

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              Ctrl+Enter to show branch options, Escape to cancel
            </div>

            <div className="flex items-center gap-2">
              {showBranchOption ? (
                <>
                  <GlassButton
                    className="gap-1"
                    onClick={() => handleSaveEdit(false)}
                    size="sm"
                    variant="ghost"
                  >
                    <Check className="h-3 w-3" />
                    Update
                  </GlassButton>
                  <GlassButton
                    className="gap-1 text-periwinkle"
                    onClick={() => handleSaveEdit(true)}
                    size="sm"
                    variant="ghost"
                  >
                    <GitBranch className="h-3 w-3" />
                    Branch
                  </GlassButton>
                </>
              ) : (
                <GlassButton
                  className="gap-1"
                  onClick={() => setShowBranchOption(true)}
                  size="sm"
                  variant="ghost"
                >
                  <Check className="h-3 w-3" />
                  Save
                </GlassButton>
              )}

              <GlassButton
                className="gap-1"
                onClick={handleCancelEdit}
                size="sm"
                variant="ghost"
              >
                <X className="h-3 w-3" />
                Cancel
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className={cn('group relative', className)}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <MarkdownRenderer content={messageContent} />
        </div>

        {/* Action buttons - show on hover */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canEdit && isUser && (
            <GlassButton
              className="h-7 w-7"
              onClick={handleStartEdit}
              size="icon"
              title="Edit message"
              variant="ghost"
            >
              <Edit3 className="h-3 w-3" />
            </GlassButton>
          )}

          {canRegenerate && isAssistant && (
            <GlassButton
              className="h-7 w-7"
              onClick={handleRegenerate}
              size="icon"
              title="Regenerate response"
              variant="ghost"
            >
              <RefreshCw className="h-3 w-3" />
            </GlassButton>
          )}

          <GlassButton
            className="h-7 w-7"
            onClick={handleCopy}
            size="icon"
            title="Copy message"
            variant="ghost"
          >
            <Copy className="h-3 w-3" />
          </GlassButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassButton
                className="h-7 w-7"
                size="icon"
                title="More options"
                variant="ghost"
              >
                <MoreHorizontal className="h-3 w-3" />
              </GlassButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass">
              {isUser && (
                <>
                  <DropdownMenuItem className="gap-2" onClick={handleStartEdit}>
                    <Edit3 className="h-3 w-3" />
                    Edit message
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {isAssistant && (
                <>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={handleRegenerate}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem className="gap-2" onClick={handleCopy}>
                <Copy className="h-3 w-3" />
                Copy message
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2"
                onClick={() => {
                  handleCreateBranch();
                }}
              >
                <GitBranch className="h-3 w-3" />
                Create branch
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2 text-red-400 hover:text-red-300"
                onClick={() => {
                  handleDeleteMessage();
                }}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        confirmText="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone and may affect conversation branches."
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={confirmDeleteMessage}
        title="Delete Message"
        variant="danger"
      />
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const EditableMessage = memo(
  EditableMessageComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.nodeId === nextProps.nodeId &&
      prevProps.message.id === nextProps.message.id &&
      JSON.stringify(prevProps.message.parts) ===
        JSON.stringify(nextProps.message.parts) &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.canEdit === nextProps.canEdit &&
      prevProps.canRegenerate === nextProps.canRegenerate
    );
  }
);
