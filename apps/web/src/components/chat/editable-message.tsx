"use client"

import { useState, useRef, useEffect, memo } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { 
  Edit3, 
  Check, 
  X, 
  RefreshCw, 
  GitBranch,
  MoreHorizontal,
  Copy,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTreeOperations } from "@/contexts/conversation-tree-context"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

interface EditableMessageProps {
  nodeId: string
  message: UIMessage
  isEditing?: boolean
  canEdit?: boolean
  canRegenerate?: boolean
  onEdit?: (nodeId: string, newContent: string, createBranch: boolean) => void
  onRegenerate?: (nodeId: string) => void
  onCopy?: (content: string) => void
  className?: string
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
  className
}: EditableMessageProps) {
  const [isEditing, setIsEditing] = useState(initialEditing)
  const [editContent, setEditContent] = useState('')
  const [showBranchOption, setShowBranchOption] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { 
    editMessage, 
    regenerateMessage, 
    createBranchFromMessage, 
    deleteMessage 
  } = useTreeOperations()

  const messageContent = message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')

  // Initialize edit content when entering edit mode
  useEffect(() => {
    if (isEditing && editContent === '') {
      setEditContent(messageContent)
    }
  }, [isEditing, messageContent, editContent])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(0, textareaRef.current.value.length)
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (!canEdit) return
    setIsEditing(true)
    setEditContent(messageContent)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
    setShowBranchOption(false)
  }

  const handleSaveEdit = (createBranch: boolean) => {
    if (editContent.trim() === messageContent.trim()) {
      handleCancelEdit()
      return
    }

    try {
      if (onEdit) {
        onEdit(nodeId, editContent.trim(), createBranch)
      } else {
        editMessage(nodeId, editContent.trim(), createBranch)
      }
      
      setIsEditing(false)
      setEditContent('')
      setShowBranchOption(false)
      
      toast.success(createBranch ? 'Message edited and branch created' : 'Message updated')
    } catch (error) {
      toast.error('Failed to edit message')
      console.error('Edit error:', error)
    }
  }

  const handleRegenerate = () => {
    if (!canRegenerate) return
    
    try {
      if (onRegenerate) {
        onRegenerate(nodeId)
      } else {
        regenerateMessage(nodeId)
      }
      toast.success('Regenerating response...')
    } catch (error) {
      toast.error('Failed to regenerate message')
      console.error('Regenerate error:', error)
    }
  }

  const handleCopy = () => {
    const content = isEditing ? editContent : messageContent
    navigator.clipboard.writeText(content)
    if (onCopy) {
      onCopy(content)
    }
    toast.success('Copied to clipboard')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setShowBranchOption(true)
    }
  }

  const handleCreateBranch = () => {
    try {
      const branchId = createBranchFromMessage(nodeId)
      toast.success('Branch created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create branch')
    }
  }

  const handleDeleteMessage = () => {
    setShowDeleteConfirmation(true)
  }

  const confirmDeleteMessage = async () => {
    try {
      deleteMessage(nodeId, false)
      toast.success('Message deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete message')
      throw error
    }
  }

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  if (isEditing) {
    return (
      <GlassCard className={cn("p-4 border-periwinkle/50", className)}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Edit3 className="h-4 w-4" />
            Editing message
          </div>
          
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[100px] p-3 bg-black/20 border border-white/10 rounded-lg resize-y focus:outline-none focus:border-periwinkle/50 text-sm"
            placeholder="Edit your message..."
          />
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Ctrl+Enter to show branch options, Escape to cancel
            </div>
            
            <div className="flex items-center gap-2">
              {showBranchOption ? (
                <>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSaveEdit(false)}
                    className="gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Update
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSaveEdit(true)}
                    className="gap-1 text-periwinkle"
                  >
                    <GitBranch className="h-3 w-3" />
                    Branch
                  </GlassButton>
                </>
              ) : (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBranchOption(true)}
                  className="gap-1"
                >
                  <Check className="h-3 w-3" />
                  Save
                </GlassButton>
              )}
              
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="gap-1"
              >
                <X className="h-3 w-3" />
                Cancel
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassCard>
    )
  }

  return (
    <div className={cn("group relative", className)}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <MarkdownRenderer content={messageContent} />
        </div>
        
        {/* Action buttons - show on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {canEdit && isUser && (
            <GlassButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleStartEdit}
              title="Edit message"
            >
              <Edit3 className="h-3 w-3" />
            </GlassButton>
          )}
          
          {canRegenerate && isAssistant && (
            <GlassButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRegenerate}
              title="Regenerate response"
            >
              <RefreshCw className="h-3 w-3" />
            </GlassButton>
          )}
          
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            title="Copy message"
          >
            <Copy className="h-3 w-3" />
          </GlassButton>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassButton
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="More options"
              >
                <MoreHorizontal className="h-3 w-3" />
              </GlassButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass">
              {isUser && (
                <>
                  <DropdownMenuItem onClick={handleStartEdit} className="gap-2">
                    <Edit3 className="h-3 w-3" />
                    Edit message
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {isAssistant && (
                <>
                  <DropdownMenuItem onClick={handleRegenerate} className="gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={handleCopy} className="gap-2">
                <Copy className="h-3 w-3" />
                Copy message
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => {
                  handleCreateBranch()
                }}
                className="gap-2"
              >
                <GitBranch className="h-3 w-3" />
                Create branch
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => {
                  handleDeleteMessage()
                }}
                className="gap-2 text-red-400 hover:text-red-300"
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
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={confirmDeleteMessage}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action cannot be undone and may affect conversation branches."
        confirmText="Delete Message"
        variant="danger"
      />
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const EditableMessage = memo(EditableMessageComponent, (prevProps, nextProps) => {
  return (
    prevProps.nodeId === nextProps.nodeId &&
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.canRegenerate === nextProps.canRegenerate
  )
})