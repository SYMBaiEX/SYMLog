'use client';

import { AlertCircle, Check, Edit3, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassButton } from '@/components/ui/glass-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Branch } from '@/types/conversation-tree';

interface BranchRenameDialogProps {
  branch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (branchId: string, newName: string) => void;
  className?: string;
}

export function BranchRenameDialog({
  branch,
  isOpen,
  onClose,
  onRename,
  className,
}: BranchRenameDialogProps) {
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize name when dialog opens
  useEffect(() => {
    if (isOpen && branch) {
      setNewName(branch.name);
      setError(null);
      setIsSubmitting(false);

      // Focus input after a brief delay to ensure dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(0, branch.name.length);
      }, 100);
    }
  }, [isOpen, branch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branch) return;

    const trimmedName = newName.trim();

    // Validation
    if (!trimmedName) {
      setError('Branch name cannot be empty');
      return;
    }

    if (trimmedName === branch.name) {
      handleClose();
      return;
    }

    if (trimmedName.length < 2) {
      setError('Branch name must be at least 2 characters long');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Branch name must be less than 100 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onRename(branch.id, trimmedName);
      toast.success(`Branch renamed to "${trimmedName}"`);
      handleClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to rename branch';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewName('');
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!branch) return null;

  return (
    <Dialog onOpenChange={handleClose} open={isOpen}>
      <DialogContent className={cn('glass max-w-md', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-periwinkle" />
            Rename Branch
          </DialogTitle>
          <DialogDescription>
            Change the name of "{branch.name}" to better describe this
            conversation path.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name</Label>
            <Input
              className={cn(
                'border-white/20 bg-black/20 focus:border-periwinkle/50',
                error && 'border-red-500/50 focus:border-red-500'
              )}
              disabled={isSubmitting}
              id="branch-name"
              maxLength={100}
              onChange={(e) => {
                setNewName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter branch name..."
              ref={inputRef}
              value={newName}
            />

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}

            <div className="text-muted-foreground text-xs">
              {newName.length}/100 characters
            </div>
          </div>

          <DialogFooter className="gap-2">
            <GlassButton
              className="gap-1"
              disabled={isSubmitting}
              onClick={handleClose}
              type="button"
              variant="ghost"
            >
              <X className="h-3 w-3" />
              Cancel
            </GlassButton>

            <GlassButton
              className="gap-1"
              disabled={
                isSubmitting ||
                !newName.trim() ||
                newName.trim() === branch.name
              }
              type="submit"
              variant="default"
            >
              <Check className="h-3 w-3" />
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </GlassButton>
          </DialogFooter>
        </form>

        {/* Branch Info */}
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="space-y-1 text-muted-foreground text-xs">
            <div>Messages: {branch.messageCount}</div>
            <div>
              Created: {new Date(branch.createdAt).toLocaleDateString()}
            </div>
            {branch.description && <div>Description: {branch.description}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
