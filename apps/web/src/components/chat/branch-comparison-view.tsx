'use client';

import {
  ArrowRight,
  Bot,
  Edit3,
  GitCompare,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';
import type { BranchComparison } from '@/types/conversation-tree';

interface BranchComparisonViewProps {
  comparison: BranchComparison | null;
  isOpen: boolean;
  onClose: () => void;
  onMergeBranches?: (sourceBranchId: string, targetBranchId: string) => void;
  className?: string;
}

export function BranchComparisonView({
  comparison,
  isOpen,
  onClose,
  onMergeBranches,
  className,
}: BranchComparisonViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      setSelectedDiff(null);
    }
  }, [isOpen]);

  if (!comparison) return null;

  const { branchA, branchB, differences } = comparison;

  const branchADifferences = differences.filter((diff) => diff.branch === 'A');
  const branchBDifferences = differences.filter((diff) => diff.branch === 'B');

  const commonMessages =
    Math.min(branchA.messageCount, branchB.messageCount) -
    Math.max(branchADifferences.length, branchBDifferences.length);

  const handleMerge = (direction: 'AtoB' | 'BtoA') => {
    if (!onMergeBranches) return;

    if (direction === 'AtoB') {
      onMergeBranches(branchA.id, branchB.id);
    } else {
      onMergeBranches(branchB.id, branchA.id);
    }
  };

  const getDiffIcon = (type: string, branch?: string) => {
    if (type === 'added') {
      return <Plus className="h-3 w-3 text-green-400" />;
    }
    if (type === 'removed') {
      return <Minus className="h-3 w-3 text-red-400" />;
    }
    if (type === 'modified') {
      return <Edit3 className="h-3 w-3 text-yellow-400" />;
    }
    return null;
  };

  const getRoleIcon = (content: string) => {
    // Simple heuristic to determine if content is from user or AI
    // In a real implementation, you'd have this information from the node
    const isLikelyUser = content.length < 200 && !content.includes('\n\n');
    return isLikelyUser ? (
      <User className="h-3 w-3 text-periwinkle" />
    ) : (
      <Bot className="h-3 w-3 text-light-green" />
    );
  };

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent
        className={cn(
          'glass max-w-6xl',
          isFullscreen
            ? 'fixed inset-4 h-[calc(100vh-2rem)] max-w-none'
            : 'max-h-[80vh]',
          className
        )}
      >
        <DialogHeader className="border-white/10 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="h-5 w-5 text-periwinkle" />
              <div>
                <DialogTitle>Branch Comparison</DialogTitle>
                <DialogDescription>
                  Comparing differences between two conversation branches
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GlassButton
                onClick={() => setIsFullscreen(!isFullscreen)}
                size="icon"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                variant="ghost"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </GlassButton>

              <GlassButton
                onClick={onClose}
                size="icon"
                title="Close"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>
          </div>
        </DialogHeader>

        {/* Branch Headers */}
        <div className="grid grid-cols-2 gap-4 border-white/10 border-b py-4">
          <GlassCard className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-periwinkle">{branchA.name}</h3>
              <Badge className="text-xs" variant="outline">
                Branch A
              </Badge>
            </div>
            <div className="space-y-1 text-muted-foreground text-sm">
              <div>{branchA.messageCount} messages</div>
              <div>
                Created {new Date(branchA.createdAt).toLocaleDateString()}
              </div>
              {branchA.isFavorite && (
                <div className="text-yellow-400">★ Favorite</div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-light-green">{branchB.name}</h3>
              <Badge className="text-xs" variant="outline">
                Branch B
              </Badge>
            </div>
            <div className="space-y-1 text-muted-foreground text-sm">
              <div>{branchB.messageCount} messages</div>
              <div>
                Created {new Date(branchB.createdAt).toLocaleDateString()}
              </div>
              {branchB.isFavorite && (
                <div className="text-yellow-400">★ Favorite</div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Summary */}
        <div className="border-white/10 border-b py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-muted-foreground text-sm">
              <div>Common messages: {commonMessages}</div>
              <div>Differences: {differences.length}</div>
            </div>

            {onMergeBranches && differences.length > 0 && (
              <div className="flex items-center gap-2">
                <GlassButton
                  className="gap-1 text-xs"
                  onClick={() => handleMerge('AtoB')}
                  size="sm"
                  variant="ghost"
                >
                  Merge A → B
                  <ArrowRight className="h-3 w-3" />
                </GlassButton>
                <GlassButton
                  className="gap-1 text-xs"
                  onClick={() => handleMerge('BtoA')}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" />
                  Merge B → A
                </GlassButton>
              </div>
            )}
          </div>
        </div>

        {/* Differences */}
        <div className="flex-1 overflow-auto">
          {differences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <GitCompare className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 font-semibold text-lg">
                No Differences Found
              </h3>
              <p className="text-muted-foreground">
                These branches are identical or share the same conversation
                path.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Branch A Differences */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-medium text-periwinkle">
                  <Plus className="h-4 w-4" />
                  Messages in {branchA.name} ({branchADifferences.length})
                </h4>

                {branchADifferences.map((diff, index) => (
                  <GlassCard
                    className={cn(
                      'cursor-pointer p-3 transition-all',
                      selectedDiff === diff.nodeId &&
                        'ring-2 ring-periwinkle/50'
                    )}
                    key={`${diff.nodeId}-${index}`}
                    onClick={() =>
                      setSelectedDiff(
                        selectedDiff === diff.nodeId ? null : diff.nodeId
                      )
                    }
                  >
                    <div className="mb-2 flex items-start gap-2">
                      {getDiffIcon(diff.type, diff.branch)}
                      {getRoleIcon(diff.content)}
                      <Badge className="text-xs" variant="outline">
                        {diff.type}
                      </Badge>
                    </div>

                    <div className="text-sm">
                      {selectedDiff === diff.nodeId ? (
                        <MarkdownRenderer content={diff.content} />
                      ) : (
                        <div className="text-muted-foreground">
                          {diff.content.length > 150
                            ? diff.content.substring(0, 150) + '...'
                            : diff.content}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Branch B Differences */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-medium text-light-green">
                  <Plus className="h-4 w-4" />
                  Messages in {branchB.name} ({branchBDifferences.length})
                </h4>

                {branchBDifferences.map((diff, index) => (
                  <GlassCard
                    className={cn(
                      'cursor-pointer p-3 transition-all',
                      selectedDiff === diff.nodeId &&
                        'ring-2 ring-light-green/50'
                    )}
                    key={`${diff.nodeId}-${index}`}
                    onClick={() =>
                      setSelectedDiff(
                        selectedDiff === diff.nodeId ? null : diff.nodeId
                      )
                    }
                  >
                    <div className="mb-2 flex items-start gap-2">
                      {getDiffIcon(diff.type, diff.branch)}
                      {getRoleIcon(diff.content)}
                      <Badge className="text-xs" variant="outline">
                        {diff.type}
                      </Badge>
                    </div>

                    <div className="text-sm">
                      {selectedDiff === diff.nodeId ? (
                        <MarkdownRenderer content={diff.content} />
                      ) : (
                        <div className="text-muted-foreground">
                          {diff.content.length > 150
                            ? diff.content.substring(0, 150) + '...'
                            : diff.content}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="border-white/10 border-t pt-4">
          <p className="text-muted-foreground text-xs">
            Click on any message to expand/collapse full content. Use merge
            buttons to combine unique messages from one branch into another.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
