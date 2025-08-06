import type {
  ConversationNode,
  ConversationTree,
} from '@/types/conversation-tree';

export class NavigationManager {
  constructor(private tree: ConversationTree) {}

  getNode(nodeId: string): ConversationNode | undefined {
    return this.tree.nodes.get(nodeId);
  }

  getCurrentNode(): ConversationNode | undefined {
    return this.tree.nodes.get(this.tree.currentNodeId);
  }

  getPathToNode(nodeId: string): string[] {
    const path: string[] = [];
    let currentId: string | undefined = nodeId;

    while (currentId) {
      path.unshift(currentId);
      const node = this.tree.nodes.get(currentId);
      currentId = node?.parentId;
    }

    return path;
  }

  updateCurrentPath(): void {
    this.tree.currentPath = this.getPathToNode(this.tree.currentNodeId);
  }

  switchToNode(nodeId: string): void {
    if (!this.tree.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} not found`);
    }

    this.tree.currentNodeId = nodeId;
    this.updateCurrentPath();
  }

  getAllNodes(): ConversationNode[] {
    return Array.from(this.tree.nodes.values());
  }

  getMessages(path?: string[]): ConversationNode[] {
    const targetPath = path || this.tree.currentPath;
    return targetPath
      .map((nodeId) => this.tree.nodes.get(nodeId))
      .filter((node): node is ConversationNode => node !== undefined);
  }

  hasChildren(nodeId: string): boolean {
    const node = this.tree.nodes.get(nodeId);
    return node ? node.children.length > 0 : false;
  }
}
