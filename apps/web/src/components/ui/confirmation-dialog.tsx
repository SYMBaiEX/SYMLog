"use client"

import { useState } from "react"
import { GlassButton } from "@/components/ui/glass-button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { AlertTriangle, Check, X, Trash2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  requiresTyping?: string // If provided, user must type this exact text to confirm
  icon?: React.ReactNode
  className?: string
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  requiresTyping,
  icon,
  className
}: ConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [typedText, setTypedText] = useState('')

  const handleConfirm = async () => {
    if (requiresTyping && typedText !== requiresTyping) {
      return
    }

    setIsSubmitting(true)
    
    try {
      await onConfirm()
      handleClose()
    } catch (error) {
      console.error('Confirmation action failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setTypedText('')
    setIsSubmitting(false)
    onClose()
  }

  const isConfirmDisabled = isSubmitting || (requiresTyping ? typedText !== requiresTyping : false)

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: icon || <Trash2 className="h-4 w-4 text-red-400" />,
          confirmClass: "bg-red-600/80 hover:bg-red-600 border-red-500/50",
          headerClass: "text-red-400"
        }
      case 'warning':
        return {
          icon: icon || <AlertTriangle className="h-4 w-4 text-yellow-400" />,
          confirmClass: "bg-yellow-600/80 hover:bg-yellow-600 border-yellow-500/50",  
          headerClass: "text-yellow-400"
        }
      case 'info':
        return {
          icon: icon || <AlertCircle className="h-4 w-4 text-periwinkle" />,
          confirmClass: "bg-periwinkle/80 hover:bg-periwinkle border-periwinkle/50",
          headerClass: "text-periwinkle"
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("glass max-w-md", className)}>
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", styles.headerClass)}>
            {styles.icon}
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {requiresTyping && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <code className="bg-black/40 px-1 py-0.5 rounded text-white font-mono">
                {requiresTyping}
              </code> to confirm:
            </p>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={requiresTyping}
              className={cn(
                "w-full px-3 py-2 bg-black/20 border border-white/20 rounded-lg",
                "focus:outline-none focus:border-periwinkle/50",
                "text-sm font-mono",
                typedText === requiresTyping && "border-green-500/50"
              )}
              disabled={isSubmitting}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          <GlassButton
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="gap-1"
          >
            <X className="h-3 w-3" />
            {cancelText}
          </GlassButton>
          
          <GlassButton
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn("gap-1", styles.confirmClass)}
          >
            <Check className="h-3 w-3" />
            {isSubmitting ? 'Processing...' : confirmText}
          </GlassButton>
        </DialogFooter>

        {variant === 'danger' && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-300">
                <strong>Warning:</strong> This action cannot be undone. Please make sure you want to proceed.
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}