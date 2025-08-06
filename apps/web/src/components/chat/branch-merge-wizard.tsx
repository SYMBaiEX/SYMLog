'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  GitMerge,
  Settings,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import type { Branch, BranchComparison } from '@/types/conversation-tree';

interface BranchMergeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBranch: Branch | null;
  targetBranch: Branch | null;
  comparison: BranchComparison | null;
  onMerge: (
    sourceBranchId: string,
    targetBranchId: string,
    strategy: 'append' | 'replace'
  ) => Promise<string>;
  className?: string;
}

type MergeStep =
  | 'select-strategy'
  | 'review'
  | 'confirm'
  | 'processing'
  | 'complete';
type MergeStrategy = 'append' | 'replace';

export function BranchMergeWizard({
  isOpen,
  onClose,
  sourceBranch,
  targetBranch,
  comparison,
  onMerge,
  className,
}: BranchMergeWizardProps) {
  const [currentStep, setCurrentStep] = useState<MergeStep>('select-strategy');
  const [selectedStrategy, setSelectedStrategy] =
    useState<MergeStrategy>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('select-strategy');
      setSelectedStrategy('append');
      setIsProcessing(false);
      setMergeResult(null);
    }
  }, [isOpen]);

  if (!(sourceBranch && targetBranch && comparison)) {
    return null;
  }

  const sourceDifferences = comparison.differences.filter(
    (diff) => diff.branch === 'A'
  );
  const targetDifferences = comparison.differences.filter(
    (diff) => diff.branch === 'B'
  );

  const handleNext = () => {
    switch (currentStep) {
      case 'select-strategy':
        setCurrentStep('review');
        break;
      case 'review':
        setCurrentStep('confirm');
        break;
      case 'confirm':
        handleMerge();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'review':
        setCurrentStep('select-strategy');
        break;
      case 'confirm':
        setCurrentStep('review');
        break;
    }
  };

  const handleMerge = async () => {
    setCurrentStep('processing');
    setIsProcessing(true);

    try {
      const result = await onMerge(
        sourceBranch.id,
        targetBranch.id,
        selectedStrategy
      );
      setMergeResult(result);
      setCurrentStep('complete');
      toast.success(
        `Successfully merged "${sourceBranch.name}" into "${targetBranch.name}"`
      );
    } catch (error) {
      console.error('Merge failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to merge branches'
      );
      setCurrentStep('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (currentStep === 'processing') return; // Prevent closing during merge
    onClose();
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'select-strategy':
        return 'Select Merge Strategy';
      case 'review':
        return 'Review Changes';
      case 'confirm':
        return 'Confirm Merge';
      case 'processing':
        return 'Merging Branches';
      case 'complete':
        return 'Merge Complete';
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 'select-strategy':
        return true;
      case 'review':
        return true;
      case 'confirm':
        return !isProcessing;
      default:
        return false;
    }
  };

  const canGoBack = () => {
    return ['review', 'confirm'].includes(currentStep) && !isProcessing;
  };

  return (
    <Dialog onOpenChange={handleClose} open={isOpen}>
      <DialogContent className={cn('glass max-w-2xl', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-periwinkle" />
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>
            Step{' '}
            {currentStep === 'select-strategy'
              ? '1'
              : currentStep === 'review'
                ? '2'
                : currentStep === 'confirm'
                  ? '3'
                  : '4'}{' '}
            of 4
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          {['select-strategy', 'review', 'confirm', 'processing'].map(
            (step, index) => (
              <div className="flex items-center" key={step}>
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full font-medium text-xs',
                    currentStep === step
                      ? 'bg-periwinkle text-white'
                      : [
                            'review',
                            'confirm',
                            'processing',
                            'complete',
                          ].includes(currentStep) &&
                          index <
                            [
                              'select-strategy',
                              'review',
                              'confirm',
                              'processing',
                            ].indexOf(currentStep)
                        ? 'bg-green-600 text-white'
                        : 'bg-white/10 text-muted-foreground'
                  )}
                >
                  {['review', 'confirm', 'processing', 'complete'].includes(
                    currentStep
                  ) &&
                  index <
                    [
                      'select-strategy',
                      'review',
                      'confirm',
                      'processing',
                    ].indexOf(currentStep) ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 w-12',
                      ['review', 'confirm', 'processing', 'complete'].includes(
                        currentStep
                      ) &&
                        index <
                          [
                            'select-strategy',
                            'review',
                            'confirm',
                            'processing',
                          ].indexOf(currentStep)
                        ? 'bg-green-600'
                        : 'bg-white/10'
                    )}
                  />
                )}
              </div>
            )
          )}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 'select-strategy' && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Choose how you want to merge "{sourceBranch.name}" into "
                {targetBranch.name}":
              </p>

              <div className="space-y-3">
                <GlassCard
                  className={cn(
                    'cursor-pointer border-2 p-4 transition-all',
                    selectedStrategy === 'append'
                      ? 'border-periwinkle/50 bg-periwinkle/10'
                      : 'border-white/10'
                  )}
                  onClick={() => setSelectedStrategy('append')}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded-full border-2',
                        selectedStrategy === 'append'
                          ? 'border-periwinkle bg-periwinkle'
                          : 'border-white/30'
                      )}
                    />
                    <div>
                      <h3 className="mb-1 font-medium">
                        Append Messages (Recommended)
                      </h3>
                      <p className="mb-2 text-muted-foreground text-sm">
                        Add unique messages from source branch to the end of
                        target branch.
                      </p>
                      <div className="text-muted-foreground text-xs">
                        • Safe operation - no data loss • Preserves both branch
                        histories • {sourceDifferences.length} messages will be
                        added
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard
                  className={cn(
                    'cursor-pointer border-2 p-4 transition-all',
                    selectedStrategy === 'replace'
                      ? 'border-yellow-500/50 bg-yellow-500/10'
                      : 'border-white/10'
                  )}
                  onClick={() => setSelectedStrategy('replace')}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded-full border-2',
                        selectedStrategy === 'replace'
                          ? 'border-yellow-500 bg-yellow-500'
                          : 'border-white/30'
                      )}
                    />
                    <div>
                      <h3 className="mb-1 flex items-center gap-2 font-medium">
                        Replace Messages
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </h3>
                      <p className="mb-2 text-muted-foreground text-sm">
                        Replace target branch messages with source branch
                        messages.
                      </p>
                      <div className="text-xs text-yellow-300">
                        • Destructive operation - target messages will be lost •{' '}
                        {targetDifferences.length} messages will be removed •{' '}
                        {sourceDifferences.length} messages will be added
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
                  <h3 className="mb-2 font-medium text-periwinkle">
                    Source: {sourceBranch.name}
                  </h3>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <div>{sourceDifferences.length} unique messages</div>
                    <div>{sourceBranch.messageCount} total messages</div>
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <h3 className="mb-2 font-medium text-light-green">
                    Target: {targetBranch.name}
                  </h3>
                  <div className="space-y-1 text-muted-foreground text-sm">
                    <div>{targetDifferences.length} unique messages</div>
                    <div>{targetBranch.messageCount} total messages</div>
                  </div>
                </GlassCard>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <Settings className="h-4 w-4" />
                  Merge Strategy:{' '}
                  {selectedStrategy === 'append'
                    ? 'Append Messages'
                    : 'Replace Messages'}
                </h4>
                <div className="text-muted-foreground text-sm">
                  {selectedStrategy === 'append' ? (
                    <div>
                      • {sourceDifferences.length} messages will be added to "
                      {targetBranch.name}"
                      <br />• All existing messages in "{targetBranch.name}"
                      will be preserved
                      <br />• New messages will appear at the end of the
                      conversation
                    </div>
                  ) : (
                    <div className="text-yellow-300">
                      • {targetDifferences.length} messages will be removed from
                      "{targetBranch.name}"
                      <br />• {sourceDifferences.length} messages will be added
                      from "{sourceBranch.name}"
                      <br />• This operation cannot be undone
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-500" />
                  <div>
                    <h3 className="mb-2 font-medium text-yellow-300">
                      Final Confirmation
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      You are about to merge "{sourceBranch.name}" into "
                      {targetBranch.name}" using the {selectedStrategy}{' '}
                      strategy.
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
                  <span className="font-medium capitalize">
                    {selectedStrategy}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Messages to transfer:</span>
                  <span className="font-medium">
                    {sourceDifferences.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-periwinkle border-b-2" />
              <h3 className="mb-2 font-medium text-lg">Merging Branches...</h3>
              <p className="text-center text-muted-foreground text-sm">
                Please wait while we merge "{sourceBranch.name}" into "
                {targetBranch.name}".
                <br />
                This may take a few moments.
              </p>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="mb-4 h-12 w-12 text-green-400" />
              <h3 className="mb-2 font-medium text-lg">Merge Successful!</h3>
              <p className="mb-4 text-center text-muted-foreground text-sm">
                Successfully merged "{sourceBranch.name}" into "
                {targetBranch.name}".
                <br />
                {sourceDifferences.length} messages were transferred.
              </p>
              {mergeResult && (
                <Badge className="text-xs" variant="outline">
                  New node: {mergeResult.slice(0, 8)}...
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between border-white/10 border-t pt-4">
          <div>
            {canGoBack() && (
              <GlassButton
                className="gap-1"
                onClick={handleBack}
                variant="ghost"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </GlassButton>
            )}
          </div>

          <div className="flex gap-2">
            {currentStep !== 'processing' && currentStep !== 'complete' && (
              <GlassButton
                disabled={isProcessing}
                onClick={handleClose}
                variant="ghost"
              >
                Cancel
              </GlassButton>
            )}

            {currentStep === 'complete' ? (
              <GlassButton
                className="gap-1"
                onClick={handleClose}
                variant="default"
              >
                <CheckCircle className="h-3 w-3" />
                Done
              </GlassButton>
            ) : (
              canGoNext() && (
                <GlassButton
                  className="gap-1"
                  disabled={isProcessing}
                  onClick={handleNext}
                  variant="default"
                >
                  {currentStep === 'confirm' ? 'Merge Branches' : 'Next'}
                  <ArrowRight className="h-3 w-3" />
                </GlassButton>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
