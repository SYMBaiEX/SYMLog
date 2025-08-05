'use client';

import { AlertCircle, AlertTriangle, Check, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassButton } from '@/components/ui/glass-button';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  requiresTyping?: string; // If provided, user must type this exact text to confirm
  icon?: React.ReactNode;
  className?: string;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  requiresTyping,
  icon,
  className,
}: ConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typedText, setTypedText] = useState('');

  const handleConfirm = async () => {
    if (requiresTyping && typedText !== requiresTyping) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTypedText('');
    setIsSubmitting(false);
    onClose();
  };

  const isConfirmDisabled =
    isSubmitting || Boolean(requiresTyping && typedText !== requiresTyping);

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: icon || <Trash2 className="h-4 w-4 text-red-400" />,
          confirmClass: 'bg-red-600/80 hover:bg-red-600 border-red-500/50',
          headerClass: 'text-red-400',
        };
      case 'warning':
        return {
          icon: icon || <AlertTriangle className="h-4 w-4 text-yellow-400" />,
          confirmClass:
            'bg-yellow-600/80 hover:bg-yellow-600 border-yellow-500/50',
          headerClass: 'text-yellow-400',
        };
      case 'info':
        return {
          icon: icon || <AlertCircle className="h-4 w-4 text-periwinkle" />,
          confirmClass:
            'bg-periwinkle/80 hover:bg-periwinkle border-periwinkle/50',
          headerClass: 'text-periwinkle',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Dialog onOpenChange={handleClose} open={isOpen}>
      <DialogContent className={cn('glass max-w-md', className)}>
        <DialogHeader>
          <DialogTitle
            className={cn('flex items-center gap-2', styles.headerClass)}
          >
            {styles.icon}
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {requiresTyping && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Type{' '}
              <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white">
                {requiresTyping}
              </code>{' '}
              to confirm:
            </p>
            <input
              className={cn(
                'w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2',
                'focus:border-periwinkle/50 focus:outline-none',
                'font-mono text-sm',
                typedText === requiresTyping && 'border-green-500/50'
              )}
              disabled={isSubmitting}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={requiresTyping}
              type="text"
              value={typedText}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <GlassButton
            className="gap-1"
            disabled={isSubmitting}
            onClick={handleClose}
            type="button"
            variant="ghost"
          >
            <X className="h-3 w-3" />
            {cancelText}
          </GlassButton>

          <GlassButton
            className={cn('gap-1', styles.confirmClass)}
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
            type="button"
          >
            <Check className="h-3 w-3" />
            {isSubmitting ? 'Processing...' : confirmText}
          </GlassButton>
        </DialogFooter>

        {variant === 'danger' && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <div className="text-red-300 text-xs">
                <strong>Warning:</strong> This action cannot be undone. Please
                make sure you want to proceed.
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
