"use client"

import { useState } from "react"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { 
  GitBranch, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal,
  Eye,
  Trash2,
  Edit3,
  Bookmark,
  Star
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTreeNavigation, useCurrentTree, useTreeOperations } from "@/contexts/conversation-tree-context"
import { BranchRenameDialog } from "./branch-rename-dialog"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { toast } from "sonner"
import type { Branch } from "@/types/conversation-tree"

interface BranchNavigatorProps {
  className?: string
  compact?: boolean
}

export function BranchNavigator({ className, compact = false }: BranchNavigatorProps) {
  const [showAllBranches, setShowAllBranches] = useState(false)
  const [selectedBranchForRename, setSelectedBranchForRename] = useState<Branch | null>(null)
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null)
  
  const { 
    navigationState, 
    canGoBack, 
    canGoForward, 
    currentBranch, 
    availableBranches,
    breadcrumbs,
    switchToBranch 
  } = useTreeNavigation()
  
  const { branches, tree } = useCurrentTree()
  const { 
    renameBranch, 
    toggleBranchFavorite, 
    deleteBranch 
  } = useTreeOperations()

  if (!tree || branches.length === 0) {
    return null
  }

  const currentBranchData = branches.find(b => b.id === currentBranch)
  const visibleBranches = showAllBranches ? branches : branches.slice(0, 3)

  const handleBranchSwitch = (branchId: string) => {
    switchToBranch(branchId)
  }

  const handleRenameBranch = async (branchId: string, newName: string) => {
    try {
      renameBranch(branchId, newName)
    } catch (error) {
      throw error // Re-throw to let the dialog handle it
    }
  }

  const handleToggleFavorite = async (branchId: string) => {
    try {
      const isFavorited = toggleBranchFavorite(branchId)
      const branch = branches.find(b => b.id === branchId)
      if (branch) {
        toast.success(
          isFavorited 
            ? `"${branch.name}" added to favorites`
            : `"${branch.name}" removed from favorites`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update favorite status')
    }
  }

  const handleDeleteBranch = (branch: Branch) => {
    setBranchToDelete(branch)
  }

  const confirmDeleteBranch = async () => {
    if (!branchToDelete) return
    
    try {
      deleteBranch(branchToDelete.id)
      toast.success(`Branch "${branchToDelete.name}" deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete branch')
      throw error
    }
  }

  const formatMessageCount = (count: number) => {
    return `${count} message${count !== 1 ? 's' : ''}`
  }

  const getBranchPreview = (branch: Branch) => {
    // Get the last few characters of the branch for preview
    const node = Array.from(tree.nodes.values()).find(n => n.id === branch.leafNodeId)
    if (!node) return branch.name
    
    const content = node.message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('')
    
    return content.length > 30 ? content.substring(0, 30) + '...' : content
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {branches.length > 1 && (
          <>
            <Badge 
              variant="outline" 
              className="text-xs gap-1 cursor-pointer hover:bg-white/10"
              onClick={() => setShowAllBranches(!showAllBranches)}
            >
              <GitBranch className="h-3 w-3" />
              {branches.length}
            </Badge>
            
            {currentBranchData && (
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {currentBranchData.name}
              </span>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <GlassCard className={cn("p-3 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-periwinkle" />
          <span className="text-sm font-medium">Conversation Branches</span>
          <Badge variant="secondary" className="text-xs">
            {branches.length}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!canGoBack}
            title="Previous in branch"
          >
            <ChevronLeft className="h-3 w-3" />
          </GlassButton>
          
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!canGoForward}
            title="Next in branch"
          >
            <ChevronRight className="h-3 w-3" />
          </GlassButton>
        </div>
      </div>

      {/* Current Branch Info */}
      {currentBranchData && (
        <div className="p-2 bg-periwinkle/10 rounded-lg border border-periwinkle/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-periwinkle">
              {currentBranchData.name}
            </span>
            {currentBranchData.isFavorite && (
              <Star className="h-3 w-3 text-yellow-400 fill-current" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatMessageCount(currentBranchData.messageCount)} • 
            {" "}Created {new Date(currentBranchData.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}

      {/* Branch List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Available Branches
          </span>
          {branches.length > 3 && (
            <GlassButton
              variant="ghost"
              size="sm"
              className="text-xs h-6"
              onClick={() => setShowAllBranches(!showAllBranches)}
            >
              {showAllBranches ? 'Show Less' : `Show All (${branches.length})`}
            </GlassButton>
          )}
        </div>
        
        {visibleBranches.map((branch) => (
          <div
            key={branch.id}
            className={cn(
              "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
              branch.id === currentBranch
                ? "bg-periwinkle/20 border border-periwinkle/30"
                : "hover:bg-white/5 border border-transparent"
            )}
            onClick={() => handleBranchSwitch(branch.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {branch.name}
                </span>
                {branch.isFavorite && (
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatMessageCount(branch.messageCount)}
              </div>
              <div className="text-xs text-muted-foreground/80 truncate">
                {getBranchPreview(branch)}
              </div>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassButton
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </GlassButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass">
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBranchSwitch(branch.id)
                    }}
                    className="gap-2"
                  >
                    <Eye className="h-3 w-3" />
                    Switch to branch
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedBranchForRename(branch)
                    }}
                    className="gap-2"
                  >
                    <Edit3 className="h-3 w-3" />
                    Rename branch
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(branch.id)
                    }}
                    className="gap-2"
                  >
                    <Bookmark className="h-3 w-3" />
                    {branch.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteBranch(branch)
                    }}
                    className="gap-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete branch
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Current Path
          </span>
          <div className="flex items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.nodeId} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                )}
                <button
                  className="text-muted-foreground hover:text-white transition-colors truncate max-w-[80px]"
                  title={crumb.messagePreview}
                >
                  {crumb.branchName || `Message ${index + 1}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    
      {/* Branch Rename Dialog */}
      <BranchRenameDialog
        branch={selectedBranchForRename}
        isOpen={!!selectedBranchForRename}
        onClose={() => setSelectedBranchForRename(null)}
        onRename={handleRenameBranch}
      />

      {/* Branch Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!branchToDelete}
        onClose={() => setBranchToDelete(null)}
        onConfirm={confirmDeleteBranch}
        title="Delete Branch"
        description={
          branchToDelete 
            ? `Are you sure you want to delete "${branchToDelete.name}"? This will remove ${branchToDelete.messageCount} messages and cannot be undone.`
            : ""
        }
        confirmText="Delete Branch"
        variant="danger"
        requiresTyping={branchToDelete?.name}
      />
    </GlassCard>
  )
}