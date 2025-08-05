'use client';

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  GitBranch,
  MoreHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import {
  useCurrentTree,
  useTreeNavigation,
  useTreeOperations,
} from '@/contexts/conversation-tree-context';
import { cn } from '@/lib/utils';
import type { Branch, ConversationNode } from '@/types/conversation-tree';
import { BranchRenameDialog } from './branch-rename-dialog';

interface BranchNavigatorProps {
  className?: string;
  compact?: boolean;
}

export function BranchNavigator({
  className,
  compact = false,
}: BranchNavigatorProps) {
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [selectedBranchForRename, setSelectedBranchForRename] =
    useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  const {
    navigationState,
    canGoBack,
    canGoForward,
    currentBranch,
    availableBranches,
    breadcrumbs,
    switchToBranch,
  } = useTreeNavigation();

  const { branches, tree } = useCurrentTree();
  const { renameBranch, toggleBranchFavorite, deleteBranch } =
    useTreeOperations();

  if (!tree || branches.length === 0) {
    return null;
  }

  const currentBranchData = branches.find((b) => b.id === currentBranch);
  const visibleBranches = showAllBranches ? branches : branches.slice(0, 3);

  const handleBranchSwitch = (branchId: string) => {
    switchToBranch(branchId);
  };

  const handleRenameBranch = async (branchId: string, newName: string) => {
    try {
      renameBranch(branchId, newName);
    } catch (error) {
      throw error; // Re-throw to let the dialog handle it
    }
  };

  const handleToggleFavorite = async (branchId: string) => {
    try {
      const isFavorited = toggleBranchFavorite(branchId);
      const branch = branches.find((b) => b.id === branchId);
      if (branch) {
        toast.success(
          isFavorited
            ? `"${branch.name}" added to favorites`
            : `"${branch.name}" removed from favorites`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update favorite status'
      );
    }
  };

  const handleDeleteBranch = (branch: Branch) => {
    setBranchToDelete(branch);
  };

  const confirmDeleteBranch = async () => {
    if (!branchToDelete) return;

    try {
      deleteBranch(branchToDelete.id);
      toast.success(`Branch "${branchToDelete.name}" deleted`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete branch'
      );
      throw error;
    }
  };

  const formatMessageCount = (count: number) => {
    return `${count} message${count !== 1 ? 's' : ''}`;
  };

  const getBranchPreview = (branch: Branch) => {
    // Get the last few characters of the branch for preview
    const node: ConversationNode | undefined = Array.from(
      tree.nodes.values()
    ).find((n) => n.id === branch.leafNodeId);
    if (!node) return branch.name;

    const content = node.message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');

    return content.length > 30 ? content.substring(0, 30) + '...' : content;
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {branches.length > 1 && (
          <>
            <Badge
              className="cursor-pointer gap-1 text-xs hover:bg-white/10"
              onClick={() => setShowAllBranches(!showAllBranches)}
              variant="outline"
            >
              <GitBranch className="h-3 w-3" />
              {branches.length}
            </Badge>

            {currentBranchData && (
              <span className="max-w-[100px] truncate text-muted-foreground text-xs">
                {currentBranchData.name}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <GlassCard className={cn('space-y-3 p-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-periwinkle" />
          <span className="font-medium text-sm">Conversation Branches</span>
          <Badge className="text-xs" variant="secondary">
            {branches.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <GlassButton
            className="h-6 w-6"
            disabled={!canGoBack}
            size="icon"
            title="Previous in branch"
            variant="ghost"
          >
            <ChevronLeft className="h-3 w-3" />
          </GlassButton>

          <GlassButton
            className="h-6 w-6"
            disabled={!canGoForward}
            size="icon"
            title="Next in branch"
            variant="ghost"
          >
            <ChevronRight className="h-3 w-3" />
          </GlassButton>
        </div>
      </div>

      {/* Current Branch Info */}
      {currentBranchData && (
        <div className="rounded-lg border border-periwinkle/20 bg-periwinkle/10 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium text-periwinkle text-sm">
              {currentBranchData.name}
            </span>
            {currentBranchData.isFavorite && (
              <Star className="h-3 w-3 fill-current text-yellow-400" />
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {formatMessageCount(currentBranchData.messageCount)} • Created{' '}
            {new Date(currentBranchData.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}

      {/* Branch List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground text-xs">
            Available Branches
          </span>
          {branches.length > 3 && (
            <GlassButton
              className="h-6 text-xs"
              onClick={() => setShowAllBranches(!showAllBranches)}
              size="sm"
              variant="ghost"
            >
              {showAllBranches ? 'Show Less' : `Show All (${branches.length})`}
            </GlassButton>
          )}
        </div>

        {visibleBranches.map((branch) => (
          <div
            className={cn(
              'group flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors',
              branch.id === currentBranch
                ? 'border border-periwinkle/30 bg-periwinkle/20'
                : 'border border-transparent hover:bg-white/5'
            )}
            key={branch.id}
            onClick={() => handleBranchSwitch(branch.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-sm">
                  {branch.name}
                </span>
                {branch.isFavorite && (
                  <Star className="h-3 w-3 fill-current text-yellow-400" />
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatMessageCount(branch.messageCount)}
              </div>
              <div className="truncate text-muted-foreground/80 text-xs">
                {getBranchPreview(branch)}
              </div>
            </div>

            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassButton
                    className="h-6 w-6"
                    onClick={(e) => e.stopPropagation()}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </GlassButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass">
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBranchSwitch(branch.id);
                    }}
                  >
                    <Eye className="h-3 w-3" />
                    Switch to branch
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBranchForRename(branch);
                    }}
                  >
                    <Edit3 className="h-3 w-3" />
                    Rename branch
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(branch.id);
                    }}
                  >
                    <Bookmark className="h-3 w-3" />
                    {branch.isFavorite
                      ? 'Remove from favorites'
                      : 'Add to favorites'}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="gap-2 text-red-400 hover:text-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBranch(branch);
                    }}
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
          <span className="font-medium text-muted-foreground text-xs">
            Current Path
          </span>
          <div className="flex items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, index) => (
              <div className="flex items-center gap-1" key={crumb.nodeId}>
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                )}
                <button
                  className="max-w-[80px] truncate text-muted-foreground transition-colors hover:text-white"
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
        confirmText="Delete Branch"
        description={
          branchToDelete
            ? `Are you sure you want to delete "${branchToDelete.name}"? This will remove ${branchToDelete.messageCount} messages and cannot be undone.`
            : ''
        }
        isOpen={!!branchToDelete}
        onClose={() => setBranchToDelete(null)}
        onConfirm={confirmDeleteBranch}
        requiresTyping={branchToDelete?.name}
        title="Delete Branch"
        variant="danger"
      />
    </GlassCard>
  );
}
