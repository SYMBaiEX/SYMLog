"use client"

import { useState, useRef, useEffect } from "react"
import { GlassButton } from "@/components/ui/glass-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Edit3, Check, X, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Branch } from "@/types/conversation-tree"

interface BranchRenameDialogProps {
  branch: Branch | null
  isOpen: boolean
  onClose: () => void
  onRename: (branchId: string, newName: string) => void
  className?: string
}

export function BranchRenameDialog({
  branch,
  isOpen,
  onClose,
  onRename,
  className
}: BranchRenameDialogProps) {
  const [newName, setNewName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize name when dialog opens
  useEffect(() => {
    if (isOpen && branch) {
      setNewName(branch.name)
      setError(null)
      setIsSubmitting(false)
      
      // Focus input after a brief delay to ensure dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(0, branch.name.length)
      }, 100)
    }
  }, [isOpen, branch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!branch) return
    
    const trimmedName = newName.trim()
    
    // Validation
    if (!trimmedName) {
      setError('Branch name cannot be empty')
      return
    }
    
    if (trimmedName === branch.name) {
      handleClose()
      return
    }
    
    if (trimmedName.length < 2) {
      setError('Branch name must be at least 2 characters long')
      return
    }
    
    if (trimmedName.length > 100) {
      setError('Branch name must be less than 100 characters')
      return
    }

    setIsSubmitting(true)
    setError(null)
    
    try {
      await onRename(branch.id, trimmedName)
      toast.success(`Branch renamed to "${trimmedName}"`)
      handleClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename branch'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setNewName('')
    setError(null)
    setIsSubmitting(false)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }

  if (!branch) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("glass max-w-md", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-periwinkle" />
            Rename Branch
          </DialogTitle>
          <DialogDescription>
            Change the name of "{branch.name}" to better describe this conversation path.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name</Label>
            <Input
              ref={inputRef}
              id="branch-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter branch name..."
              className={cn(
                "bg-black/20 border-white/20 focus:border-periwinkle/50",
                error && "border-red-500/50 focus:border-red-500"
              )}
              disabled={isSubmitting}
              maxLength={100}
            />
            
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              {newName.length}/100 characters
            </div>
          </div>

          <DialogFooter className="gap-2">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
              className="gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </GlassButton>
            
            <GlassButton
              type="submit"
              variant="default"
              disabled={isSubmitting || !newName.trim() || newName.trim() === branch.name}
              className="gap-1"
            >
              <Check className="h-3 w-3" />
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </GlassButton>
          </DialogFooter>
        </form>

        {/* Branch Info */}
        <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/10">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Messages: {branch.messageCount}</div>
            <div>Created: {new Date(branch.createdAt).toLocaleDateString()}</div>
            {branch.description && (
              <div>Description: {branch.description}</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}