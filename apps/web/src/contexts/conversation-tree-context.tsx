'use client';

import type { UIMessage } from '@ai-sdk/react';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { ConversationTreeManager } from '@/lib/conversation-tree/index';
import type { FileAttachment } from '@/types/attachments';
import type {
  Branch,
  BranchComparison,
  BranchMetadata,
  ConversationNode,
  ConversationTree,
  TreeNavigationState,
  TreeStateChange,
} from '@/types/conversation-tree';

interface ConversationTreeState {
  treeManager: ConversationTreeManager | null;
  currentTree: ConversationTree | null;
  navigationState: TreeNavigationState;
  isLoading: boolean;
  error: string | null;
}

interface ConversationTreeActions {
  initializeTree: (conversationId?: string) => void;
  addMessage: (
    message: UIMessage,
    attachments?: FileAttachment[],
    parentId?: string,
    metadata?: Partial<BranchMetadata>
  ) => string;
  editMessage: (
    nodeId: string,
    newContent: string,
    createBranch?: boolean
  ) => string;
  regenerateMessage: (
    nodeId: string,
    options?: { model?: string; temperature?: number }
  ) => string;
  createBranch: (fromNodeId: string, branchName?: string) => string;
  switchToBranch: (branchId: string) => void;
  deleteBranch: (branchId: string) => void;
  navigateToNode: (nodeId: string) => void;
  clearTree: () => void;
  // New branch management actions
  renameBranch: (branchId: string, newName: string) => void;
  toggleBranchFavorite: (branchId: string) => boolean;
  setBranchColor: (branchId: string, color: string) => void;
  compareBranches: (branchAId: string, branchBId: string) => BranchComparison;
  mergeBranches: (
    sourceBranchId: string,
    targetBranchId: string,
    strategy?: 'append' | 'replace' | 'interleave'
  ) => string;
  deleteMessage: (nodeId: string, preserveBranches?: boolean) => void;
  createBranchFromMessage: (nodeId: string, branchName?: string) => string;
}

type TreeAction =
  | {
      type: 'INITIALIZE_TREE';
      payload: { treeManager: ConversationTreeManager; tree: ConversationTree };
    }
  | { type: 'UPDATE_TREE'; payload: { tree: ConversationTree } }
  | {
      type: 'UPDATE_NAVIGATION';
      payload: { navigationState: TreeNavigationState };
    }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'CLEAR_TREE' };

const initialState: ConversationTreeState = {
  treeManager: null,
  currentTree: null,
  navigationState: {
    currentBranch: '',
    availableBranches: [],
    canGoBack: false,
    canGoForward: false,
    breadcrumbs: [],
  },
  isLoading: false,
  error: null,
};

function treeReducer(
  state: ConversationTreeState,
  action: TreeAction
): ConversationTreeState {
  switch (action.type) {
    case 'INITIALIZE_TREE':
      return {
        ...state,
        treeManager: action.payload.treeManager,
        currentTree: action.payload.tree,
        navigationState: action.payload.treeManager.getNavigationState(),
        isLoading: false,
        error: null,
      };

    case 'UPDATE_TREE':
      return {
        ...state,
        currentTree: action.payload.tree,
        navigationState:
          state.treeManager?.getNavigationState() || state.navigationState,
      };

    case 'UPDATE_NAVIGATION':
      return {
        ...state,
        navigationState: action.payload.navigationState,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
        isLoading: false,
      };

    case 'CLEAR_TREE':
      return {
        ...initialState,
      };

    default:
      return state;
  }
}

const ConversationTreeContext = createContext<{
  state: ConversationTreeState;
  actions: ConversationTreeActions;
} | null>(null);

interface ConversationTreeProviderProps {
  children: React.ReactNode;
  conversationId?: string;
}

export function ConversationTreeProvider({
  children,
  conversationId,
}: ConversationTreeProviderProps) {
  const [state, dispatch] = useReducer(treeReducer, initialState);

  // Initialize tree manager
  const initializeTree = useCallback((id?: string) => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

    try {
      const treeManager = new ConversationTreeManager({
        id: id || `conversation-${Date.now()}`,
      });

      const tree = treeManager.getTree();

      // Set up event listener for tree changes
      const unsubscribe = treeManager.subscribe((change: TreeStateChange) => {
        const navigationState = treeManager.getNavigationState();
        dispatch({ type: 'UPDATE_NAVIGATION', payload: { navigationState } });
      });

      dispatch({
        type: 'INITIALIZE_TREE',
        payload: { treeManager, tree },
      });

      return unsubscribe;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to initialize tree',
        },
      });
    }
  }, []);

  // Tree manipulation actions
  const addMessage = useCallback(
    (
      message: UIMessage,
      attachments?: FileAttachment[],
      parentId?: string,
      metadata?: Partial<BranchMetadata>
    ): string => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      return state.treeManager.addMessage(
        message,
        attachments,
        parentId,
        metadata
      );
    },
    [state.treeManager]
  );

  const editMessage = useCallback(
    (nodeId: string, newContent: string, createBranch = true): string => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      return state.treeManager.editMessage(nodeId, newContent, createBranch);
    },
    [state.treeManager]
  );

  const regenerateMessage = useCallback(
    (
      nodeId: string,
      options?: { model?: string; temperature?: number }
    ): string => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      state.treeManager.regenerateResponse(nodeId);
      return nodeId;
    },
    [state.treeManager]
  );

  const createBranch = useCallback(
    (fromNodeId: string, branchName?: string): string => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      const metadata: Partial<BranchMetadata> = branchName
        ? { name: branchName }
        : {};
      return state.treeManager.createBranch(fromNodeId, metadata);
    },
    [state.treeManager]
  );

  const switchToBranch = useCallback(
    (branchId: string): void => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      // Switch to branch by switching to the branch's leaf node
      const branch = state.currentTree?.branches.find((b) => b.id === branchId);
      if (branch) {
        state.treeManager.switchToNode(branch.leafNodeId);
      }
    },
    [state.treeManager]
  );

  const deleteBranch = useCallback(
    (branchId: string): void => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      // Delete branch functionality - need to implement in manager
      console.warn('Delete branch not implemented yet');
    },
    [state.treeManager]
  );

  const navigateToNode = useCallback(
    (nodeId: string): void => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      // Update current node and refresh navigation state
      const tree = state.treeManager.getTree();
      tree.currentNodeId = nodeId;
      const navigationState = state.treeManager.getNavigationState();
      dispatch({ type: 'UPDATE_NAVIGATION', payload: { navigationState } });
    },
    [state.treeManager]
  );

  const clearTree = useCallback(() => {
    dispatch({ type: 'CLEAR_TREE' });
  }, []);

  // New branch management actions
  const renameBranch = useCallback(
    (branchId: string, newName: string): void => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      state.treeManager.renameBranch(branchId, newName);
    },
    [state.treeManager]
  );

  const toggleBranchFavorite = useCallback(
    (branchId: string): boolean => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      return state.treeManager.toggleBranchFavorite(branchId);
    },
    [state.treeManager]
  );

  const setBranchColor = useCallback(
    (branchId: string, color: string): void => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      state.treeManager.setBranchColor(branchId, color);
    },
    [state.treeManager]
  );

  const compareBranches = useCallback(
    (branchAId: string, branchBId: string): BranchComparison => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      return state.treeManager.compareBranches(branchAId, branchBId);
    },
    [state.treeManager]
  );

  const mergeBranches = useCallback(
    (
      sourceBranchId: string,
      targetBranchId: string,
      strategy: 'append' | 'replace' | 'interleave' = 'append'
    ): string => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      return state.treeManager.mergeBranches(
        sourceBranchId,
        targetBranchId,
        strategy
      );
    },
    [state.treeManager]
  );

  const deleteMessage = useCallback(
    (nodeId: string, preserveBranches = false): void => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      state.treeManager.deleteNode(nodeId);
    },
    [state.treeManager]
  );

  const createBranchFromMessage = useCallback(
    (nodeId: string, branchName?: string): string => {
      if (!state.treeManager) throw new Error('Tree manager not initialized');
      const metadata: Partial<BranchMetadata> = branchName
        ? { name: branchName }
        : {};
      return state.treeManager.createBranch(nodeId, metadata);
    },
    [state.treeManager]
  );

  // Initialize tree on mount or when conversationId changes
  useEffect(() => {
    const unsubscribe = initializeTree(conversationId);
    return unsubscribe;
  }, [conversationId, initializeTree]);

  const actions: ConversationTreeActions = {
    initializeTree,
    addMessage,
    editMessage,
    regenerateMessage,
    createBranch,
    switchToBranch,
    deleteBranch,
    navigateToNode,
    clearTree,
    renameBranch,
    toggleBranchFavorite,
    setBranchColor,
    compareBranches,
    mergeBranches,
    deleteMessage,
    createBranchFromMessage,
  };

  return (
    <ConversationTreeContext.Provider value={{ state, actions }}>
      {children}
    </ConversationTreeContext.Provider>
  );
}

export function useConversationTree() {
  const context = useContext(ConversationTreeContext);
  if (!context) {
    throw new Error(
      'useConversationTree must be used within a ConversationTreeProvider'
    );
  }
  return context;
}

// Additional utility hooks
export function useTreeNavigation() {
  const { state, actions } = useConversationTree();

  return {
    navigationState: state.navigationState,
    canGoBack: state.navigationState.canGoBack,
    canGoForward: state.navigationState.canGoForward,
    currentBranch: state.navigationState.currentBranch,
    availableBranches: state.navigationState.availableBranches,
    breadcrumbs: state.navigationState.breadcrumbs,
    navigateToNode: actions.navigateToNode,
    switchToBranch: actions.switchToBranch,
  };
}

export function useTreeOperations() {
  const { state, actions } = useConversationTree();

  return {
    addMessage: actions.addMessage,
    editMessage: actions.editMessage,
    regenerateMessage: actions.regenerateMessage,
    createBranch: actions.createBranch,
    deleteBranch: actions.deleteBranch,
    renameBranch: actions.renameBranch,
    toggleBranchFavorite: actions.toggleBranchFavorite,
    setBranchColor: actions.setBranchColor,
    compareBranches: actions.compareBranches,
    mergeBranches: actions.mergeBranches,
    deleteMessage: actions.deleteMessage,
    createBranchFromMessage: actions.createBranchFromMessage,
    isLoading: state.isLoading,
    error: state.error,
  };
}

export function useCurrentTree() {
  const { state } = useConversationTree();

  return {
    tree: state.currentTree,
    nodes: state.currentTree?.nodes
      ? Array.from(state.currentTree.nodes.values())
      : [],
    branches: state.currentTree?.branches || [],
    currentNodeId: state.currentTree?.currentNodeId,
    currentPath: state.currentTree?.currentPath || [],
  };
}
