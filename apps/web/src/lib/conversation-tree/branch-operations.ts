import type { UIMessage } from '@ai-sdk/react';
import type { FileAttachment } from '@/types/attachments';
import type {
  Branch,
  BranchComparison,
  BranchMetadata,
  ConversationNode,
  ConversationTree,
  TreeStateChange,
} from '@/types/conversation-tree';

export class BranchOperations {
  constructor(
    private tree: ConversationTree,
    private navigationManager: any, // Avoid circular dependency
    private emit: (change: TreeStateChange) => void,
    private generateId: () => string,
    private updateMetadata: () => void,
    private getMessageContent: (message: UIMessage) => string
  ) {}

  createBranch(nodeId: string, metadata?: Partial<BranchMetadata>): string {
    const node = this.tree.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const branchId = this.generateId();
    const branch: Branch = {
      id: branchId,
      rootNodeId: nodeId,
      leafNodeId: nodeId,
      name: metadata?.name || `Branch ${this.tree.branches.length + 1}`,
      messageCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        createdBy: 'user',
        ...metadata,
      },
      isActive: true,
      isFavorite: false,
      color: metadata?.color,
    };

    this.tree.branches.push(branch);
    node.isBranchPoint = true;
    node.branchName = branch.name;

    this.updateMetadata();
    this.emit({
      type: 'branch_created',
      nodeId,
      branchId,
      timestamp: Date.now(),
    });

    return branchId;
  }

  createBranchFromEdit(nodeId: string, newContent: string): string {
    const originalNode = this.tree.nodes.get(nodeId);
    if (!originalNode) throw new Error(`Node ${nodeId} not found`);

    // Create branch point
    const branchId = this.createBranch(nodeId);

    // Create new node with edited content
    const editedMessage: UIMessage = {
      ...originalNode.message,
      parts: [{ type: 'text', text: newContent }],
    };

    const newNodeId = this.generateId();
    const newNode: ConversationNode = {
      id: newNodeId,
      message: editedMessage,
      parentId: originalNode.parentId,
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isEdited: true,
      originalContent: this.getMessageContent(originalNode.message),
      metadata: {
        createdBy: 'user_edit',
        branchId,
      } as BranchMetadata,
    };

    // Update parent to point to new node
    if (originalNode.parentId) {
      const parent = this.tree.nodes.get(originalNode.parentId);
      if (parent) {
        const childIndex = parent.children.indexOf(nodeId);
        if (childIndex !== -1) {
          parent.children[childIndex] = newNodeId;
        }
      }
    }

    this.tree.nodes.set(newNodeId, newNode);
    this.tree.currentNodeId = newNodeId;

    // Update branch metadata
    const branch = this.tree.branches.find((b) => b.id === branchId);
    if (branch && branch.metadata) {
      branch.leafNodeId = newNodeId;
      branch.name = 'Edited Branch';
      branch.metadata.editedFrom = nodeId;
    }

    this.navigationManager.updateCurrentPath();
    this.updateMetadata();

    this.emit({
      type: 'message_edited',
      nodeId: newNodeId,
      timestamp: Date.now(),
    });

    return newNodeId;
  }

  renameBranch(branchId: string, newName: string): void {
    const branch = this.tree.branches.find((b) => b.id === branchId);
    if (!branch) throw new Error(`Branch ${branchId} not found`);

    if (!newName.trim()) throw new Error('Branch name cannot be empty');

    const oldName = branch.name;
    branch.name = newName.trim();
    this.updateMetadata();

    this.emit({
      type: 'branch_edited',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now(),
      data: { oldName, newName },
    });
  }

  toggleBranchFavorite(branchId: string): boolean {
    const branch = this.tree.branches.find((b) => b.id === branchId);
    if (!branch) throw new Error(`Branch ${branchId} not found`);

    branch.isFavorite = !branch.isFavorite;
    this.updateMetadata();

    this.emit({
      type: 'branch_edited',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now(),
      data: { favorited: branch.isFavorite },
    });

    return branch.isFavorite;
  }

  setBranchColor(branchId: string, color: string): void {
    const branch = this.tree.branches.find((b) => b.id === branchId);
    if (!branch) throw new Error(`Branch ${branchId} not found`);

    branch.color = color;
    this.updateMetadata();

    this.emit({
      type: 'branch_edited',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now(),
      data: { color },
    });
  }

  compareBranches(branchAId: string, branchBId: string): BranchComparison {
    const branchA = this.tree.branches.find((b) => b.id === branchAId);
    const branchB = this.tree.branches.find((b) => b.id === branchBId);

    if (!branchA) throw new Error(`Branch ${branchAId} not found`);
    if (!branchB) throw new Error(`Branch ${branchBId} not found`);

    const pathA = this.navigationManager.getPathToNode(branchA.leafNodeId);
    const pathB = this.navigationManager.getPathToNode(branchB.leafNodeId);

    const differences: BranchComparison['differences'] = [];

    // Find common ancestor
    let commonAncestorIndex = 0;
    while (
      commonAncestorIndex < Math.min(pathA.length, pathB.length) &&
      pathA[commonAncestorIndex] === pathB[commonAncestorIndex]
    ) {
      commonAncestorIndex++;
    }

    // Nodes unique to branch A
    for (let i = commonAncestorIndex; i < pathA.length; i++) {
      const node = this.tree.nodes.get(pathA[i])!;
      differences.push({
        nodeId: pathA[i],
        type: 'added',
        content: this.getMessageContent(node.message),
        branch: 'A',
      });
    }

    // Nodes unique to branch B
    for (let i = commonAncestorIndex; i < pathB.length; i++) {
      const node = this.tree.nodes.get(pathB[i])!;
      differences.push({
        nodeId: pathB[i],
        type: 'added',
        content: this.getMessageContent(node.message),
        branch: 'B',
      });
    }

    const commonAncestorId =
      commonAncestorIndex > 0 ? pathA[commonAncestorIndex - 1] : undefined;

    return {
      branches: [branchA, branchB],
      branchA,
      branchB,
      differences,
      commonAncestor: commonAncestorId,
      metrics: {
        totalDifferences: differences.length,
        messagesInA: pathA.length - commonAncestorIndex,
        messagesInB: pathB.length - commonAncestorIndex,
        divergencePoint: commonAncestorIndex,
      },
    };
  }

  mergeBranches(
    sourceBranchId: string,
    targetBranchId: string,
    strategy: 'append' | 'replace' | 'interleave' = 'append'
  ): string {
    const sourceBranch = this.tree.branches.find(
      (b) => b.id === sourceBranchId
    );
    const targetBranch = this.tree.branches.find(
      (b) => b.id === targetBranchId
    );

    if (!sourceBranch)
      throw new Error(`Source branch ${sourceBranchId} not found`);
    if (!targetBranch)
      throw new Error(`Target branch ${targetBranchId} not found`);

    const newBranchId = this.generateId();
    const timestamp = Date.now();

    // Create new branch for merge result
    const mergeBranch: Branch = {
      id: newBranchId,
      rootNodeId: targetBranch.rootNodeId,
      leafNodeId: '',
      name: `Merge: ${sourceBranch.name} → ${targetBranch.name}`,
      messageCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        createdBy: 'system',
        mergedFrom: [sourceBranchId, targetBranchId],
        mergeStrategy: strategy,
      },
      isActive: true,
      isFavorite: false,
    };

    // Implementation would depend on merge strategy
    // For now, just append messages from source to target
    if (strategy === 'append') {
      const sourcePath = this.navigationManager.getPathToNode(
        sourceBranch.leafNodeId
      );
      const targetPath = this.navigationManager.getPathToNode(
        targetBranch.leafNodeId
      );

      // Find divergence point
      let divergenceIndex = 0;
      while (
        divergenceIndex < Math.min(sourcePath.length, targetPath.length) &&
        sourcePath[divergenceIndex] === targetPath[divergenceIndex]
      ) {
        divergenceIndex++;
      }

      // Start from target branch leaf
      let currentNodeId = targetBranch.leafNodeId;

      // Append source branch messages after divergence
      for (let i = divergenceIndex; i < sourcePath.length; i++) {
        const sourceNode = this.tree.nodes.get(sourcePath[i]);
        if (sourceNode) {
          const newNodeId = this.generateId();
          const newNode: ConversationNode = {
            ...sourceNode,
            id: newNodeId,
            parentId: currentNodeId,
            children: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            metadata: {
              ...sourceNode.metadata,
              mergedFrom: sourcePath[i],
            },
          };

          this.tree.nodes.set(newNodeId, newNode);

          // Update parent's children
          const parent = this.tree.nodes.get(currentNodeId);
          if (parent) {
            parent.children.push(newNodeId);
          }

          currentNodeId = newNodeId;
        }
      }

      mergeBranch.leafNodeId = currentNodeId;
    }

    this.tree.branches.push(mergeBranch);
    this.updateMetadata();

    this.emit({
      type: 'branch_merged',
      nodeId: mergeBranch.leafNodeId,
      branchId: newBranchId,
      timestamp,
      data: {
        sourceBranchId,
        targetBranchId,
        strategy,
      },
    });

    return newBranchId;
  }

  getBranchNames(): Array<{ id: string; name: string; isFavorite: boolean }> {
    return this.tree.branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      isFavorite: branch.isFavorite ?? false,
    }));
  }

  getBranchPoints(): Array<{
    nodeId: string;
    branchName?: string;
    messagePreview: string;
  }> {
    return Array.from(this.tree.nodes.values())
      .filter((node) => node.isBranchPoint)
      .map((node) => ({
        nodeId: node.id,
        branchName: node.branchName,
        messagePreview: this.getMessagePreview(node.message),
      }));
  }

  private getMessagePreview(message: UIMessage): string {
    const content = this.getMessageContent(message);
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }
}
