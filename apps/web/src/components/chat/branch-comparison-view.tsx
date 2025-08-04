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
  GitCompare, 
  ArrowRight, 
  Plus, 
  Minus, 
  Edit3, 
  User, 
  Bot,
  X,
  Maximize2,
  Minimize2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import type { BranchComparison } from "@/types/conversation-tree"

interface BranchComparisonViewProps {
  comparison: BranchComparison | null
  isOpen: boolean
  onClose: () => void
  onMergeBranches?: (sourceBranchId: string, targetBranchId: string) => void
  className?: string
}

export function BranchComparisonView({
  comparison,
  isOpen,
  onClose,
  onMergeBranches,
  className
}: BranchComparisonViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false)
      setSelectedDiff(null)
    }
  }, [isOpen])

  if (!comparison) return null

  const { branchA, branchB, differences } = comparison
  
  const branchADifferences = differences.filter(diff => diff.branch === 'A')
  const branchBDifferences = differences.filter(diff => diff.branch === 'B')
  
  const commonMessages = Math.min(branchA.messageCount, branchB.messageCount) - Math.max(branchADifferences.length, branchBDifferences.length)

  const handleMerge = (direction: 'AtoB' | 'BtoA') => {
    if (!onMergeBranches) return
    
    if (direction === 'AtoB') {
      onMergeBranches(branchA.id, branchB.id)
    } else {
      onMergeBranches(branchB.id, branchA.id)
    }
  }

  const getDiffIcon = (type: string, branch?: string) => {
    if (type === 'added') {
      return <Plus className="h-3 w-3 text-green-400" />
    }
    if (type === 'removed') {
      return <Minus className="h-3 w-3 text-red-400" />
    }
    if (type === 'modified') {
      return <Edit3 className="h-3 w-3 text-yellow-400" />
    }
    return null
  }

  const getRoleIcon = (content: string) => {
    // Simple heuristic to determine if content is from user or AI
    // In a real implementation, you'd have this information from the node
    const isLikelyUser = content.length < 200 && !content.includes('\n\n')
    return isLikelyUser ? (
      <User className="h-3 w-3 text-periwinkle" />
    ) : (
      <Bot className="h-3 w-3 text-light-green" />
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "glass max-w-6xl",
        isFullscreen ? "fixed inset-4 max-w-none h-[calc(100vh-2rem)]" : "max-h-[80vh]",
        className
      )}>
        <DialogHeader className="border-b border-white/10 pb-4">
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
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </GlassButton>
              
              <GlassButton
                variant="ghost"
                size="icon"
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>
          </div>
        </DialogHeader>

        {/* Branch Headers */}
        <div className="grid grid-cols-2 gap-4 py-4 border-b border-white/10">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-periwinkle">{branchA.name}</h3>
              <Badge variant="outline" className="text-xs">
                Branch A
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>{branchA.messageCount} messages</div>
              <div>Created {new Date(branchA.createdAt).toLocaleDateString()}</div>
              {branchA.isFavorite && (
                <div className="text-yellow-400">★ Favorite</div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-light-green">{branchB.name}</h3>
              <Badge variant="outline" className="text-xs">
                Branch B
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>{branchB.messageCount} messages</div>
              <div>Created {new Date(branchB.createdAt).toLocaleDateString()}</div>
              {branchB.isFavorite && (
                <div className="text-yellow-400">★ Favorite</div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Summary */}
        <div className="py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div>Common messages: {commonMessages}</div>
              <div>Differences: {differences.length}</div>
            </div>
            
            {onMergeBranches && differences.length > 0 && (
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMerge('AtoB')}
                  className="gap-1 text-xs"
                >
                  Merge A → B
                  <ArrowRight className="h-3 w-3" />
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMerge('BtoA')}
                  className="gap-1 text-xs"
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
              <GitCompare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Differences Found</h3>
              <p className="text-muted-foreground">
                These branches are identical or share the same conversation path.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Branch A Differences */}
              <div className="space-y-3">
                <h4 className="font-medium text-periwinkle flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Messages in {branchA.name} ({branchADifferences.length})
                </h4>
                
                {branchADifferences.map((diff, index) => (
                  <GlassCard 
                    key={`${diff.nodeId}-${index}`}
                    className={cn(
                      "p-3 cursor-pointer transition-all",
                      selectedDiff === diff.nodeId && "ring-2 ring-periwinkle/50"
                    )}
                    onClick={() => setSelectedDiff(selectedDiff === diff.nodeId ? null : diff.nodeId)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {getDiffIcon(diff.type, diff.branch)}
                      {getRoleIcon(diff.content)}
                      <Badge variant="outline" className="text-xs">
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
                            : diff.content
                          }
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Branch B Differences */}
              <div className="space-y-3">
                <h4 className="font-medium text-light-green flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Messages in {branchB.name} ({branchBDifferences.length})
                </h4>
                
                {branchBDifferences.map((diff, index) => (
                  <GlassCard 
                    key={`${diff.nodeId}-${index}`}
                    className={cn(
                      "p-3 cursor-pointer transition-all",
                      selectedDiff === diff.nodeId && "ring-2 ring-light-green/50"
                    )}
                    onClick={() => setSelectedDiff(selectedDiff === diff.nodeId ? null : diff.nodeId)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {getDiffIcon(diff.type, diff.branch)}
                      {getRoleIcon(diff.content)}
                      <Badge variant="outline" className="text-xs">
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
                            : diff.content
                          }
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
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-muted-foreground">
            Click on any message to expand/collapse full content. Use merge buttons to combine unique messages from one branch into another.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}