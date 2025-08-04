import type { 
  ConversationTree, 
  ConversationNode,
  TreeMetadata,
  TreeStateChange
} from '@/types/conversation-tree'
import type { UIMessage } from '@ai-sdk/react'

export class TreeUtils {
  static generateId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  static getMessageContent(message: UIMessage): string {
    if (message.content) return message.content
    
    if (message.parts) {
      return message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
    }
    
    return ''
  }

  static findNodeByMessage(tree: ConversationTree, messageId: string): ConversationNode | undefined {
    return Array.from(tree.nodes.values()).find(node => node.message.id === messageId)
  }

  static updateMetadata(tree: ConversationTree): void {
    tree.metadata.updatedAt = Date.now()
    tree.metadata.totalMessages = tree.nodes.size
    tree.metadata.totalBranches = tree.branches.length
    
    // Set title from first user message if not set
    if (!tree.metadata.title && tree.nodes.size > 0) {
      const firstUserNode = Array.from(tree.nodes.values())
        .find(node => node.message.role === 'user')
      
      if (firstUserNode) {
        const content = TreeUtils.getMessageContent(firstUserNode.message)
        tree.metadata.title = content.length > 50 
          ? content.substring(0, 50) + '...' 
          : content
      }
    }
  }

  static pruneOldNodes(tree: ConversationTree, maxNodes = 1000): void {
    if (tree.nodes.size <= maxNodes) return
    
    // Keep most recent nodes and those in current path
    const nodesToKeep = new Set(tree.currentPath)
    const sortedNodes = Array.from(tree.nodes.entries())
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, maxNodes - nodesToKeep.size)
    
    sortedNodes.forEach(([id]) => nodesToKeep.add(id))
    
    // Remove old nodes
    tree.nodes = new Map(
      Array.from(tree.nodes.entries())
        .filter(([id]) => nodesToKeep.has(id))
    )
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
        id,
        ...node,
        // Ensure message is serializable
        message: {
          ...node.message,
          parts: node.message.parts || []
        }
      }))
    }
    
    return JSON.stringify(exportData, null, 2)
  }

  static importTree(jsonData: string): ConversationTree {
    const data = JSON.parse(jsonData)
    
    // Reconstruct nodes Map
    const nodes = new Map<string, ConversationNode>()
    data.nodes.forEach((node: any) => {
      nodes.set(node.id, {
        ...node,
        id: node.id // Ensure id is preserved
      })
    })
    
    return {
      id: data.id,
      nodes,
      rootId: data.rootId,
      currentPath: data.currentPath,
      currentNodeId: data.currentNodeId,
      branches: data.branches,
      metadata: data.metadata
    }
  }

  static validateTree(tree: ConversationTree): boolean {
    // Check if root exists
    if (tree.rootId && !tree.nodes.has(tree.rootId)) {
      console.error('Root node not found')
      return false
    }
    
    // Check if current node exists
    if (tree.currentNodeId && !tree.nodes.has(tree.currentNodeId)) {
      console.error('Current node not found')
      return false
    }
    
    // Check parent-child relationships
    for (const [nodeId, node] of tree.nodes) {
      if (node.parentId && !tree.nodes.has(node.parentId)) {
        console.error(`Parent ${node.parentId} not found for node ${nodeId}`)
        return false
      }
      
      for (const childId of node.children) {
        if (!tree.nodes.has(childId)) {
          console.error(`Child ${childId} not found for node ${nodeId}`)
          return false
        }
      }
    }
    
    // Check branches
    for (const branch of tree.branches) {
      if (!tree.nodes.has(branch.rootNodeId)) {
        console.error(`Branch root ${branch.rootNodeId} not found`)
        return false
      }
      if (!tree.nodes.has(branch.leafNodeId)) {
        console.error(`Branch leaf ${branch.leafNodeId} not found`)
        return false
      }
    }
    
    return true
  }
}