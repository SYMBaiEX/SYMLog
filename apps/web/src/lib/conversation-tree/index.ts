import type { UIMessage } from '@ai-sdk/react';
import type { FileAttachment } from '@/types/attachments';
import type {
  Branch,
  BranchComparison,
  BranchingAction,
  BranchMetadata,
  ConversationNode,
  ConversationTree,
  MessageEdit,
  TreeNavigationState,
  TreeStateChange,
} from '@/types/conversation-tree';
import { BranchOperations } from './branch-operations';
import { NavigationManager } from './navigation';
import { TreeUtils } from './utils';

export class ConversationTreeManager {
  private tree: ConversationTree;
  private listeners: Array<(change: TreeStateChange) => void> = [];
  private navigationManager: NavigationManager;
  private branchOps: BranchOperations;

  constructor(initialTree?: Partial<ConversationTree>) {
    this.tree = {
      id: initialTree?.id || TreeUtils.generateId(),
      nodes: new Map(initialTree?.nodes || []),
      rootId: initialTree?.rootId || '',
      currentPath: initialTree?.currentPath || [],
      currentNodeId: initialTree?.currentNodeId || '',
      branches: initialTree?.branches || [],
      metadata: {
        title: initialTree?.metadata?.title,
        createdAt: initialTree?.metadata?.createdAt || Date.now(),
        updatedAt: Date.now(),
        totalMessages: initialTree?.metadata?.totalMessages || 0,
        totalBranches: initialTree?.metadata?.totalBranches || 0,
      },
    };

    this.navigationManager = new NavigationManager(this.tree);
    this.branchOps = new BranchOperations(
      this.tree,
      this.navigationManager,
      this.emit.bind(this),
      TreeUtils.generateId,
      this.updateMetadata.bind(this),
      TreeUtils.getMessageContent
    );
  }

  // Core tree operations
  addMessage(
    message: UIMessage,
    attachments?: FileAttachment[],
    parentId?: string,
    metadata?: Partial<BranchMetadata>
  ): string {
    const nodeId = TreeUtils.generateId();
    const now = Date.now();

    const node: ConversationNode = {
      id: nodeId,
      message,
      attachments,
      parentId,
      children: [],
      createdAt: now,
      updatedAt: now,
      metadata: {
        createdBy: message.role === 'user' ? 'user' : 'ai',
        ...metadata,
      },
    };

    // Add to parent's children if has parent
    if (parentId && this.tree.nodes.has(parentId)) {
      const parent = this.tree.nodes.get(parentId)!;
      parent.children.push(nodeId);
      parent.updatedAt = now;
    }

    // Set as root if no parent
    if (!(parentId || this.tree.rootId)) {
      this.tree.rootId = nodeId;
    }

    this.tree.nodes.set(nodeId, node);
    this.tree.currentNodeId = nodeId;
    this.navigationManager.updateCurrentPath();
    this.updateMetadata();

    this.emit({
      type: 'node_added',
      nodeId,
      timestamp: now,
    });

    return nodeId;
  }

  editMessage(nodeId: string, newContent: string, createBranch = true): string {
    const node = this.tree.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    if (createBranch && node.children.length > 0) {
      // Create a new branch for the edit
      return this.branchOps.createBranchFromEdit(nodeId, newContent);
    }

    // Direct edit without branching
    if (!node.isEdited) {
      node.originalContent = TreeUtils.getMessageContent(node.message);
      node.isEdited = true;
    }

    // Update message content properly based on structure
    if ('content' in node.message) {
      (node.message as any).content = newContent;
    }
    if ('parts' in node.message) {
      (node.message as any).parts = [{ type: 'text', text: newContent }];
    }
    node.updatedAt = Date.now();

    this.updateMetadata();
    this.emit({
      type: 'node_edited',
      nodeId,
      timestamp: Date.now(),
    });

    return nodeId;
  }

  deleteNode(nodeId: string): void {
    const node = this.tree.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    // Can't delete root or nodes with children
    if (nodeId === this.tree.rootId) {
      throw new Error('Cannot delete root node');
    }
    if (node.children.length > 0) {
      throw new Error('Cannot delete node with children');
    }

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.tree.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter((id) => id !== nodeId);
      }
    }

    // Delete the node
    this.tree.nodes.delete(nodeId);

    // Update current node if needed
    if (this.tree.currentNodeId === nodeId && node.parentId) {
      this.tree.currentNodeId = node.parentId;
      this.navigationManager.updateCurrentPath();
    }

    this.updateMetadata();
    this.emit({
      type: 'node_deleted',
      nodeId,
      timestamp: Date.now(),
    });
  }

  regenerateResponse(userNodeId: string, existingResponseId?: string): void {
    const userNode = this.tree.nodes.get(userNodeId);
    if (!userNode || userNode.message.role !== 'user') {
      throw new Error('Can only regenerate from user messages');
    }

    // If there's an existing response, create a branch
    if (existingResponseId && this.tree.nodes.has(existingResponseId)) {
      const existingResponse = this.tree.nodes.get(existingResponseId)!;

      // Mark the user node as a branch point
      userNode.isBranchPoint = true;

      // Create a new branch
      const branchId = this.branchOps.createBranch(userNodeId, {
        name: `Regeneration ${userNode.children.length}`,
        reason: 'regenerate_response',
      });

      this.emit({
        type: 'branch_created',
        nodeId: userNodeId,
        branchId,
        timestamp: Date.now(),
      });
    }
  }

  // Navigation methods - delegate to NavigationManager
  getNode(nodeId: string): ConversationNode | undefined {
    return this.navigationManager.getNode(nodeId);
  }

  getCurrentNode(): ConversationNode | undefined {
    return this.navigationManager.getCurrentNode();
  }

  switchToNode(nodeId: string): void {
    this.navigationManager.switchToNode(nodeId);
    this.emit({
      type: 'branch_switched',
      nodeId,
      timestamp: Date.now(),
    });
  }

  getMessages(path?: string[]): ConversationNode[] {
    return this.navigationManager.getMessages(path);
  }

  getAllNodes(): ConversationNode[] {
    return this.navigationManager.getAllNodes();
  }

  hasChildren(nodeId: string): boolean {
    return this.navigationManager.hasChildren(nodeId);
  }

  getPathToNode(nodeId: string): string[] {
    return this.navigationManager.getPathToNode(nodeId);
  }

  // Branch operations - delegate to BranchOperations
  createBranch(nodeId: string, metadata?: Partial<BranchMetadata>): string {
    return this.branchOps.createBranch(nodeId, metadata);
  }

  renameBranch(branchId: string, newName: string): void {
    this.branchOps.renameBranch(branchId, newName);
  }

  toggleBranchFavorite(branchId: string): boolean {
    return this.branchOps.toggleBranchFavorite(branchId);
  }

  setBranchColor(branchId: string, color: string): void {
    this.branchOps.setBranchColor(branchId, color);
  }

  compareBranches(branchAId: string, branchBId: string): BranchComparison {
    return this.branchOps.compareBranches(branchAId, branchBId);
  }

  mergeBranches(
    sourceBranchId: string,
    targetBranchId: string,
    strategy: 'append' | 'replace' | 'interleave' = 'append'
  ): string {
    return this.branchOps.mergeBranches(
      sourceBranchId,
      targetBranchId,
      strategy
    );
  }

  getBranchNames(): Array<{ id: string; name: string; isFavorite: boolean }> {
    return this.branchOps.getBranchNames();
  }

  getBranchPoints(): Array<{
    nodeId: string;
    branchName?: string;
    messagePreview: string;
  }> {
    return this.branchOps.getBranchPoints();
  }

  // Utility methods
  private updateMetadata(): void {
    TreeUtils.updateMetadata(this.tree);
  }

  pruneOldNodes(maxNodes = 1000): void {
    TreeUtils.pruneOldNodes(this.tree, maxNodes);
  }

  // Tree state methods
  getTree(): ConversationTree {
    return this.tree;
  }

  getTreeId(): string {
    return this.tree.id;
  }

  getTreeMetadata(): ConversationTree['metadata'] {
    return { ...this.tree.metadata };
  }

  getNavigationState(): TreeNavigationState {
    return {
      currentBranch: this.getCurrentBranchId() || 'main',
      availableBranches: this.getBranchNames().map((branch) => branch.name),
      canGoBack: this.tree.currentPath.length > 1,
      canGoForward: this.hasChildren(this.tree.currentNodeId),
      breadcrumbs: this.tree.currentPath.map((nodeId) => {
        const node = this.tree.nodes.get(nodeId);
        return {
          nodeId,
          branchName: this.getCurrentBranchId(),
          messagePreview: node
            ? TreeUtils.getMessageContent(node.message).substring(0, 50)
            : '',
        };
      }),
    };
  }

  private getCurrentBranchId(): string | undefined {
    const currentNode = this.getCurrentNode();
    if (!currentNode) return;

    // Find branch that contains current node
    for (const branch of this.tree.branches) {
      const branchPath = this.getPathToNode(branch.leafNodeId);
      if (branchPath.includes(this.tree.currentNodeId)) {
        return branch.id;
      }
    }

    return;
  }

  // Export/Import
  exportTree(): string {
    return TreeUtils.exportTree(this.tree);
  }

  static importTree(jsonData: string): ConversationTreeManager {
    const tree = TreeUtils.importTree(jsonData);
    return new ConversationTreeManager(tree);
  }

  validateTree(): boolean {
    return TreeUtils.validateTree(this.tree);
  }

  // Event management
  private emit(change: TreeStateChange): void {
    this.listeners.forEach((listener) => listener(change));
  }

  subscribe(listener: (change: TreeStateChange) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Search and analysis
  findNodeByMessage(messageId: string): ConversationNode | undefined {
    return TreeUtils.findNodeByMessage(this.tree, messageId);
  }

  searchNodes(query: string): ConversationNode[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllNodes().filter((node) => {
      const content = TreeUtils.getMessageContent(node.message).toLowerCase();
      return content.includes(lowerQuery);
    });
  }

  getStatistics(): {
    totalNodes: number;
    totalBranches: number;
    userMessages: number;
    assistantMessages: number;
    editedMessages: number;
    maxDepth: number;
    avgBranchLength: number;
  } {
    const nodes = this.getAllNodes();
    const userMessages = nodes.filter((n) => n.message.role === 'user').length;
    const assistantMessages = nodes.filter(
      (n) => n.message.role === 'assistant'
    ).length;
    const editedMessages = nodes.filter((n) => n.isEdited).length;

    // Calculate max depth
    let maxDepth = 0;
    for (const node of nodes) {
      const depth = this.getPathToNode(node.id).length;
      maxDepth = Math.max(maxDepth, depth);
    }

    // Calculate average branch length
    const avgBranchLength =
      this.tree.branches.length > 0
        ? this.tree.branches.reduce((sum, branch) => {
            return sum + this.getPathToNode(branch.leafNodeId).length;
          }, 0) / this.tree.branches.length
        : 0;

    return {
      totalNodes: nodes.length,
      totalBranches: this.tree.branches.length,
      userMessages,
      assistantMessages,
      editedMessages,
      maxDepth,
      avgBranchLength,
    };
  }
}

export * from './branch-operations';
// Re-export types and utilities
export * from './navigation';
export * from './utils';
