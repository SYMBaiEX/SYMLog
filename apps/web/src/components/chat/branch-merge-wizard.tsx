"use client"

import { useState, useEffect } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { 
  GitMerge, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle,
  ArrowLeft,
  X,
  Settings
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Branch, BranchComparison } from "@/types/conversation-tree"

interface BranchMergeWizardProps {
  isOpen: boolean
  onClose: () => void
  sourceBranch: Branch | null
  targetBranch: Branch | null
  comparison: BranchComparison | null
  onMerge: (sourceBranchId: string, targetBranchId: string, strategy: 'append' | 'replace') => Promise<string>
  className?: string
}

type MergeStep = 'select-strategy' | 'review' | 'confirm' | 'processing' | 'complete'
type MergeStrategy = 'append' | 'replace'

export function BranchMergeWizard({
  isOpen,
  onClose,
  sourceBranch,
  targetBranch,
  comparison,
  onMerge,
  className
}: BranchMergeWizardProps) {
  const [currentStep, setCurrentStep] = useState<MergeStep>('select-strategy')
  const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy>('append')
  const [isProcessing, setIsProcessing] = useState(false)
  const [mergeResult, setMergeResult] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('select-strategy')
      setSelectedStrategy('append')
      setIsProcessing(false)
      setMergeResult(null)
    }
  }, [isOpen])

  if (!sourceBranch || !targetBranch || !comparison) {
    return null
  }

  const sourceDifferences = comparison.differences.filter(diff => diff.branch === 'A')
  const targetDifferences = comparison.differences.filter(diff => diff.branch === 'B')

  const handleNext = () => {
    switch (currentStep) {
      case 'select-strategy':
        setCurrentStep('review')
        break
      case 'review':
        setCurrentStep('confirm')
        break
      case 'confirm':
        handleMerge()
        break
    }
  }

  const handleBack = () => {
    switch (currentStep) {
      case 'review':
        setCurrentStep('select-strategy')
        break
      case 'confirm':
        setCurrentStep('review')
        break
    }
  }

  const handleMerge = async () => {
    setCurrentStep('processing')
    setIsProcessing(true)

    try {
      const result = await onMerge(sourceBranch.id, targetBranch.id, selectedStrategy)
      setMergeResult(result)
      setCurrentStep('complete')
      toast.success(`Successfully merged "${sourceBranch.name}" into "${targetBranch.name}"`)
    } catch (error) {
      console.error('Merge failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to merge branches')
      setCurrentStep('confirm')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (currentStep === 'processing') return // Prevent closing during merge
    onClose()
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select-strategy': return 'Select Merge Strategy'
      case 'review': return 'Review Changes'
      case 'confirm': return 'Confirm Merge'
      case 'processing': return 'Merging Branches'
      case 'complete': return 'Merge Complete'
    }
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 'select-strategy': return true
      case 'review': return true
      case 'confirm': return !isProcessing
      default: return false
    }
  }

  const canGoBack = () => {
    return ['review', 'confirm'].includes(currentStep) && !isProcessing
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("glass max-w-2xl", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-periwinkle" />
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>
            Step {currentStep === 'select-strategy' ? '1' : currentStep === 'review' ? '2' : currentStep === 'confirm' ? '3' : '4'} of 4
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          {['select-strategy', 'review', 'confirm', 'processing'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                currentStep === step ? "bg-periwinkle text-white" :
                ['review', 'confirm', 'processing', 'complete'].includes(currentStep) && index < ['select-strategy', 'review', 'confirm', 'processing'].indexOf(currentStep)
                  ? "bg-green-600 text-white" : "bg-white/10 text-muted-foreground"
              )}>
                {['review', 'confirm', 'processing', 'complete'].includes(currentStep) && index < ['select-strategy', 'review', 'confirm', 'processing'].indexOf(currentStep) ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < 3 && (
                <div className={cn(
                  "w-12 h-0.5 mx-2",
                  ['review', 'confirm', 'processing', 'complete'].includes(currentStep) && index < ['select-strategy', 'review', 'confirm', 'processing'].indexOf(currentStep)
                    ? "bg-green-600" : "bg-white/10"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 'select-strategy' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose how you want to merge "{sourceBranch.name}" into "{targetBranch.name}":
              </p>

              <div className="space-y-3">
                <GlassCard 
                  className={cn(
                    "p-4 cursor-pointer transition-all border-2",
                    selectedStrategy === 'append' ? "border-periwinkle/50 bg-periwinkle/10" : "border-white/10"
                  )}
                  onClick={() => setSelectedStrategy('append')}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 mt-0.5",
                      selectedStrategy === 'append' ? "border-periwinkle bg-periwinkle" : "border-white/30"
                    )} />
                    <div>
                      <h3 className="font-medium mb-1">Append Messages (Recommended)</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Add unique messages from source branch to the end of target branch.
                      </p>
                      <div className="text-xs text-muted-foreground">
                        • Safe operation - no data loss
                        • Preserves both branch histories
                        • {sourceDifferences.length} messages will be added
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard 
                  className={cn(
                    "p-4 cursor-pointer transition-all border-2",
                    selectedStrategy === 'replace' ? "border-yellow-500/50 bg-yellow-500/10" : "border-white/10"
                  )}
                  onClick={() => setSelectedStrategy('replace')}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 mt-0.5",
                      selectedStrategy === 'replace' ? "border-yellow-500 bg-yellow-500" : "border-white/30"
                    )} />
                    <div>
                      <h3 className="font-medium mb-1 flex items-center gap-2">
                        Replace Messages 
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Replace target branch messages with source branch messages.
                      </p>
                      <div className="text-xs text-yellow-300">
                        • Destructive operation - target messages will be lost
                        • {targetDifferences.length} messages will be removed
                        • {sourceDifferences.length} messages will be added
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <GlassCard className="p-4">
                  <h3 className="font-medium mb-2 text-periwinkle">Source: {sourceBranch.name}</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{sourceDifferences.length} unique messages</div>
                    <div>{sourceBranch.messageCount} total messages</div>
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <h3 className="font-medium mb-2 text-light-green">Target: {targetBranch.name}</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{targetDifferences.length} unique messages</div>
                    <div>{targetBranch.messageCount} total messages</div>
                  </div>
                </GlassCard>
              </div>

              <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Merge Strategy: {selectedStrategy === 'append' ? 'Append Messages' : 'Replace Messages'}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {selectedStrategy === 'append' ? (
                    <div>
                      • {sourceDifferences.length} messages will be added to "{targetBranch.name}"
                      <br />
                      • All existing messages in "{targetBranch.name}" will be preserved
                      <br />
                      • New messages will appear at the end of the conversation
                    </div>
                  ) : (
                    <div className="text-yellow-300">
                      • {targetDifferences.length} messages will be removed from "{targetBranch.name}"
                      <br />
                      • {sourceDifferences.length} messages will be added from "{sourceBranch.name}"
                      <br />
                      • This operation cannot be undone
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-yellow-300 mb-2">Final Confirmation</h3>
                    <p className="text-sm text-muted-foreground">
                      You are about to merge "{sourceBranch.name}" into "{targetBranch.name}" using the {selectedStrategy} strategy.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Source Branch:</span>
                  <span className="font-medium">{sourceBranch.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Branch:</span>
                  <span className="font-medium">{targetBranch.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Strategy:</span>
                  <span className="font-medium capitalize">{selectedStrategy}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages to transfer:</span>
                  <span className="font-medium">{sourceDifferences.length}</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-periwinkle mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Merging Branches...</h3>
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we merge "{sourceBranch.name}" into "{targetBranch.name}".
                <br />
                This may take a few moments.
              </p>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-12 w-12 text-green-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Merge Successful!</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Successfully merged "{sourceBranch.name}" into "{targetBranch.name}".
                <br />
                {sourceDifferences.length} messages were transferred.
              </p>
              {mergeResult && (
                <Badge variant="outline" className="text-xs">
                  New node: {mergeResult.slice(0, 8)}...
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-white/10">
          <div>
            {canGoBack() && (
              <GlassButton
                variant="ghost"
                onClick={handleBack}
                className="gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </GlassButton>
            )}
          </div>

          <div className="flex gap-2">
            {currentStep !== 'processing' && currentStep !== 'complete' && (
              <GlassButton
                variant="ghost"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancel
              </GlassButton>
            )}

            {currentStep === 'complete' ? (
              <GlassButton
                variant="default"
                onClick={handleClose}
                className="gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Done
              </GlassButton>
            ) : canGoNext() && (
              <GlassButton
                variant="default"
                onClick={handleNext}
                disabled={isProcessing}
                className="gap-1"
              >
                {currentStep === 'confirm' ? 'Merge Branches' : 'Next'}
                <ArrowRight className="h-3 w-3" />
              </GlassButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}