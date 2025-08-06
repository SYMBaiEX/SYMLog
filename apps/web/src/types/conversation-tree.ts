import type { UIMessage } from '@ai-sdk/react';
import type { FileAttachment } from './attachments';

export interface BranchMetadata {
  name?: string;
  description?: string;
  model?: string;
  temperature?: number;
  createdBy: 'user' | 'ai' | 'system' | 'user_edit';
  editedFromMessageId?: string;
  regeneratedFromMessageId?: string;
  mergedFrom?: string[];
  mergeStrategy?: string;
  reason?: string;
  color?: string;
  editedFrom?: string;
}

export interface ConversationNode {
  id: string;
  message: UIMessage;
  attachments?: FileAttachment[];
  parentId?: string;
  children: string[];
  branchName?: string;
  createdAt: number;
  updatedAt: number;
  metadata: BranchMetadata;
  isEdited?: boolean;
  originalContent?: string;
  isBranchPoint?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  description?: string;
  rootNodeId: string;
  leafNodeId: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  color?: string;
  metadata?: BranchMetadata;
  isActive?: boolean;
}

export interface ConversationTree {
  id: string;
  nodes: Map<string, ConversationNode>;
  rootId: string;
  currentPath: string[];
  currentNodeId: string;
  branches: Branch[];
  metadata: {
    title?: string;
    createdAt: number;
    updatedAt: number;
    totalMessages: number;
    totalBranches: number;
  };
}

export interface BranchingAction {
  type: 'create' | 'switch' | 'delete' | 'merge' | 'edit' | 'regenerate';
  nodeId: string;
  branchId?: string;
  data?: any;
}

export interface TreeNavigationState {
  currentBranch: string;
  availableBranches: string[];
  canGoBack: boolean;
  canGoForward: boolean;
  breadcrumbs: Array<{
    nodeId: string;
    branchName?: string;
    messagePreview: string;
  }>;
}

export interface MessageEdit {
  nodeId: string;
  newContent: string;
  editType: 'user_edit' | 'regeneration' | 'branch_creation';
  timestamp: number;
}

export interface BranchComparison {
  branches: [Branch, Branch];
  branchA: Branch;
  branchB: Branch;
  differences: Array<{
    nodeId: string;
    type: 'added' | 'removed' | 'modified';
    content: string;
    branch?: 'A' | 'B';
  }>;
  commonAncestor?: string;
  metrics: {
    totalDifferences: number;
    messagesInA: number;
    messagesInB: number;
    divergencePoint: number;
  };
}

export interface ConversationTreeOptions {
  maxBranches?: number;
  maxDepth?: number;
  autoSave?: boolean;
  enableVersioning?: boolean;
  branchNamingStrategy?: 'auto' | 'manual' | 'hybrid';
}

// Utility types for tree operations
export type TreePath = string[];
export type NodeOperation = 'add' | 'edit' | 'delete' | 'move';
export type BranchStrategy = 'linear' | 'tree' | 'hybrid';

// Events for tree state changes
export interface TreeStateChange {
  type:
    | 'node_added'
    | 'node_edited'
    | 'node_deleted'
    | 'branch_created'
    | 'branch_switched'
    | 'branch_edited'
    | 'branch_deleted'
    | 'branch_merged'
    | 'message_edited';
  nodeId: string;
  branchId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}
