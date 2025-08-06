import type { UIMessage } from '@ai-sdk/react';
import { logError } from '@/lib/logger';
import { generateSecureId } from '@/lib/utils/id-generator';
import type {
  ConversationNode,
  ConversationTree,
  TreeStateChange,
} from '@/types/conversation-tree';

// Define TreeMetadata as it's used but not exported
type TreeMetadata = ConversationTree['metadata'];

export class TreeUtils {
  static generateId(): string {
    return generateSecureId('node');
  }

  static getMessageContent(message: UIMessage): string {
    // Handle different content formats from UIMessage
    if ('content' in message && typeof message.content === 'string') {
      return message.content;
    }

    // Handle array content format
    if ('content' in message && Array.isArray(message.content)) {
      return message.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text || '')
        .join('\n');
    }

    // Handle parts format
    if ('parts' in message && Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text || '')
        .join('\n');
    }

    return '';
  }

  static findNodeByMessage(
    tree: ConversationTree,
    messageId: string
  ): ConversationNode | undefined {
    return Array.from(tree.nodes.values()).find(
      (node) => node.message.id === messageId
    );
  }

  static updateMetadata(tree: ConversationTree): void {
    tree.metadata.updatedAt = Date.now();
    tree.metadata.totalMessages = tree.nodes.size;
    tree.metadata.totalBranches = tree.branches.length;

    // Set title from first user message if not set
    if (!tree.metadata.title && tree.nodes.size > 0) {
      const firstUserNode = Array.from(tree.nodes.values()).find(
        (node): node is ConversationNode => node.message.role === 'user'
      );

      if (firstUserNode) {
        const content = TreeUtils.getMessageContent(firstUserNode.message);
        tree.metadata.title =
          content.length > 50 ? content.substring(0, 50) + '...' : content;
      }
    }
  }

  static pruneOldNodes(tree: ConversationTree, maxNodes = 1000): void {
    if (tree.nodes.size <= maxNodes) return;

    // Keep most recent nodes and those in current path
    const nodesToKeep = new Set(tree.currentPath);
    const sortedNodes = Array.from(tree.nodes.entries())
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, maxNodes - nodesToKeep.size);

    sortedNodes.forEach(([id]) => nodesToKeep.add(id));

    // Remove old nodes
    tree.nodes = new Map(
      Array.from(tree.nodes.entries()).filter(([id]) => nodesToKeep.has(id))
    );
  }

  static exportTree(tree: ConversationTree): string {
    const exportData = {
      id: tree.id,
      rootId: tree.rootId,
      currentNodeId: tree.currentNodeId,
      currentPath: tree.currentPath,
      branches: tree.branches,
      metadata: tree.metadata,
      nodes: Array.from(tree.nodes.entries()).map(([id, node]) => ({
        ...node,
        id, // Explicitly set id to override any id from node spread
        // Ensure message is serializable
        message: {
          ...node.message,
          parts: node.message.parts || [],
        },
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  static importTree(jsonData: string): ConversationTree {
    const data = JSON.parse(jsonData);

    // Reconstruct nodes Map
    const nodes = new Map<string, ConversationNode>();
    data.nodes.forEach((nodeData: any) => {
      const { id, ...nodeWithoutId } = nodeData;
      nodes.set(id, {
        ...nodeWithoutId,
        id, // Add id back as a single property
      });
    });

    return {
      id: data.id,
      nodes,
      rootId: data.rootId,
      currentPath: data.currentPath,
      currentNodeId: data.currentNodeId,
      branches: data.branches,
      metadata: data.metadata,
    };
  }

  static validateTree(tree: ConversationTree): boolean {
    // Check if root exists
    if (tree.rootId && !tree.nodes.has(tree.rootId)) {
      logError('TreeUtils.validateTree', new Error('Root node not found'), {
        rootId: tree.rootId,
      });
      return false;
    }

    // Check if current node exists
    if (tree.currentNodeId && !tree.nodes.has(tree.currentNodeId)) {
      logError('TreeUtils.validateTree', new Error('Current node not found'), {
        currentNodeId: tree.currentNodeId,
      });
      return false;
    }

    // Check parent-child relationships
    for (const [nodeId, node] of tree.nodes) {
      if (node.parentId && !tree.nodes.has(node.parentId)) {
        logError(
          'TreeUtils.validateTree',
          new Error(`Parent ${node.parentId} not found for node ${nodeId}`),
          { nodeId, parentId: node.parentId }
        );
        return false;
      }

      for (const childId of node.children) {
        if (!tree.nodes.has(childId)) {
          logError(
            'TreeUtils.validateTree',
            new Error(`Child ${childId} not found for node ${nodeId}`),
            { nodeId, childId }
          );
          return false;
        }
      }
    }

    // Check branches
    for (const branch of tree.branches) {
      if (!tree.nodes.has(branch.rootNodeId)) {
        logError(
          'TreeUtils.validateTree',
          new Error(`Branch root ${branch.rootNodeId} not found`),
          { branchId: branch.id, rootNodeId: branch.rootNodeId }
        );
        return false;
      }
      if (!tree.nodes.has(branch.leafNodeId)) {
        logError(
          'TreeUtils.validateTree',
          new Error(`Branch leaf ${branch.leafNodeId} not found`),
          { branchId: branch.id, leafNodeId: branch.leafNodeId }
        );
        return false;
      }
    }

    return true;
  }
}
