import type { UIMessage } from '@ai-sdk/react'
import type { 
  ConversationTree, 
  ConversationNode, 
  Branch, 
  BranchMetadata,
  TreeNavigationState,
  MessageEdit,
  BranchingAction,
  TreeStateChange
} from '@/types/conversation-tree'
import type { FileAttachment } from '@/types/attachments'

export class ConversationTreeManager {
  private tree: ConversationTree
  private listeners: Array<(change: TreeStateChange) => void> = []

  constructor(initialTree?: Partial<ConversationTree>) {
    this.tree = {
      id: initialTree?.id || this.generateId(),
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
      }
    }
  }

  // Core tree operations
  addMessage(
    message: UIMessage, 
    attachments?: FileAttachment[],
    parentId?: string,
    metadata?: Partial<BranchMetadata>
  ): string {
    const nodeId = this.generateId()
    const now = Date.now()
    
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
        ...metadata
      }
    }

    // Add to parent's children if has parent
    if (parentId && this.tree.nodes.has(parentId)) {
      const parent = this.tree.nodes.get(parentId)!
      parent.children.push(nodeId)
      parent.updatedAt = now
    }

    // Set as root if no parent
    if (!parentId && !this.tree.rootId) {
      this.tree.rootId = nodeId
    }

    this.tree.nodes.set(nodeId, node)
    this.tree.currentNodeId = nodeId
    this.updateCurrentPath()
    this.updateMetadata()

    this.emit({
      type: 'node_added',
      nodeId,
      timestamp: now
    })

    return nodeId
  }

  editMessage(nodeId: string, newContent: string, createBranch = true): string {
    const node = this.tree.nodes.get(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)

    if (createBranch && node.children.length > 0) {
      // Create a new branch for the edit
      return this.createBranchFromEdit(nodeId, newContent)
    }

    // Direct edit without branching
    if (!node.isEdited) {
      node.originalContent = this.getMessageContent(node.message)
      node.isEdited = true
    }

    // Update message content
    this.updateMessageContent(node.message, newContent)
    node.updatedAt = Date.now()

    this.emit({
      type: 'node_edited',
      nodeId,
      timestamp: Date.now(),
      data: { newContent, createBranch }
    })

    return nodeId
  }

  regenerateMessage(nodeId: string, options?: { model?: string; temperature?: number }): string {
    const node = this.tree.nodes.get(nodeId)
    if (!node || node.message.role !== 'assistant') {
      throw new Error('Can only regenerate AI messages')
    }

    // Create new node as sibling
    const newNodeId = this.generateId()
    const now = Date.now()

    const newNode: ConversationNode = {
      ...node,
      id: newNodeId,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...node.metadata,
        regeneratedFromMessageId: nodeId,
        model: options?.model || node.metadata.model,
        temperature: options?.temperature || node.metadata.temperature
      }
    }

    // Add as sibling
    if (node.parentId) {
      const parent = this.tree.nodes.get(node.parentId)!
      parent.children.push(newNodeId)
    }

    this.tree.nodes.set(newNodeId, newNode)
    this.tree.currentNodeId = newNodeId
    this.updateCurrentPath()

    this.emit({
      type: 'node_added',
      nodeId: newNodeId,
      timestamp: now,
      data: { type: 'regeneration', originalNodeId: nodeId }
    })

    return newNodeId
  }

  createBranch(fromNodeId: string, branchName?: string): string {
    const node = this.tree.nodes.get(fromNodeId)
    if (!node) throw new Error(`Node ${fromNodeId} not found`)

    const branchId = this.generateId()
    const now = Date.now()

    // Count messages from root to this node
    const messageCount = this.getPathToNode(fromNodeId).length

    const branch: Branch = {
      id: branchId,
      name: branchName || `Branch ${this.tree.branches.length + 1}`,
      rootNodeId: this.tree.rootId,
      leafNodeId: fromNodeId,
      messageCount,
      createdAt: now
    }

    this.tree.branches.push(branch)
    this.updateMetadata()

    this.emit({
      type: 'branch_created',
      nodeId: fromNodeId,
      branchId,
      timestamp: now
    })

    return branchId
  }

  switchToBranch(branchId: string): void {
    const branch = this.tree.branches.find(b => b.id === branchId)
    if (!branch) throw new Error(`Branch ${branchId} not found`)

    this.tree.currentNodeId = branch.leafNodeId
    this.updateCurrentPath()

    this.emit({
      type: 'branch_switched',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now()
    })
  }

  deleteBranch(branchId: string): void {
    const branchIndex = this.tree.branches.findIndex(b => b.id === branchId)
    if (branchIndex === -1) throw new Error(`Branch ${branchId} not found`)

    const branch = this.tree.branches[branchIndex]
    
    // Remove nodes that are unique to this branch
    this.removeUniqueBranchNodes(branch)
    
    this.tree.branches.splice(branchIndex, 1)
    this.updateMetadata()
  }

  // Navigation methods
  getNavigationState(): TreeNavigationState {
    const currentPath = this.getCurrentPath()
    const availableBranches = this.getAvailableBranches()
    
    return {
      currentBranch: this.getCurrentBranch()?.id || '',
      availableBranches: availableBranches.map(b => b.id),
      canGoBack: currentPath.length > 1,
      canGoForward: this.canNavigateForward(),
      breadcrumbs: this.getBreadcrumbs()
    }
  }

  getCurrentPath(): string[] {
    return this.getPathToNode(this.tree.currentNodeId)
  }

  getPathToNode(nodeId: string): string[] {
    const path: string[] = []
    let currentId: string | undefined = nodeId

    while (currentId) {
      path.unshift(currentId)
      const node = this.tree.nodes.get(currentId)
      currentId = node?.parentId
    }

    return path
  }

  // Utility methods
  private createBranchFromEdit(nodeId: string, newContent: string): string {
    const originalNode = this.tree.nodes.get(nodeId)!
    
    // Create new node with edited content
    const newNodeId = this.generateId()
    const now = Date.now()

    const editedMessage = { ...originalNode.message }
    this.updateMessageContent(editedMessage, newContent)

    const newNode: ConversationNode = {
      ...originalNode,
      id: newNodeId,
      message: editedMessage,
      createdAt: now,
      updatedAt: now,
      isEdited: true,
      originalContent: this.getMessageContent(originalNode.message),
      children: [], // New branch starts fresh
      metadata: {
        ...originalNode.metadata,
        editedFromMessageId: nodeId
      }
    }

    // Add as sibling to original
    if (originalNode.parentId) {
      const parent = this.tree.nodes.get(originalNode.parentId)!
      parent.children.push(newNodeId)
    }

    this.tree.nodes.set(newNodeId, newNode)
    this.tree.currentNodeId = newNodeId
    this.updateCurrentPath()

    // Create branch record
    this.createBranch(newNodeId, `Edit of "${this.getMessagePreview(originalNode.message)}"`)

    return newNodeId
  }

  private updateCurrentPath(): void {
    this.tree.currentPath = this.getPathToNode(this.tree.currentNodeId)
  }

  private updateMetadata(): void {
    this.tree.metadata.updatedAt = Date.now()
    this.tree.metadata.totalMessages = this.tree.nodes.size
    this.tree.metadata.totalBranches = this.tree.branches.length
  }

  private getMessageContent(message: UIMessage): string {
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('')
  }

  private updateMessageContent(message: UIMessage, newContent: string): void {
    // Find first text part and update it
    const textPart = message.parts.find(part => part.type === 'text')
    if (textPart) {
      textPart.text = newContent
    } else {
      // Add new text part if none exists
      message.parts.unshift({ type: 'text', text: newContent })
    }
  }

  private getMessagePreview(message: UIMessage, maxLength = 50): string {
    const content = this.getMessageContent(message)
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content
  }

  private getCurrentBranch(): Branch | undefined {
    return this.tree.branches.find(branch => 
      this.getPathToNode(this.tree.currentNodeId).includes(branch.leafNodeId)
    )
  }

  private getAvailableBranches(): Branch[] {
    // Get branches that share some path with current node
    const currentPath = this.getCurrentPath()
    return this.tree.branches.filter(branch => {
      const branchPath = this.getPathToNode(branch.leafNodeId)
      return branchPath.some(nodeId => currentPath.includes(nodeId))
    })
  }

  private canNavigateForward(): boolean {
    const currentNode = this.tree.nodes.get(this.tree.currentNodeId)
    return currentNode ? currentNode.children.length > 0 : false
  }

  private getBreadcrumbs() {
    const path = this.getCurrentPath()
    return path.map(nodeId => {
      const node = this.tree.nodes.get(nodeId)!
      return {
        nodeId,
        branchName: node.branchName,
        messagePreview: this.getMessagePreview(node.message)
      }
    })
  }

  // Branch management operations
  renameBranch(branchId: string, newName: string): void {
    const branch = this.tree.branches.find(b => b.id === branchId)
    if (!branch) throw new Error(`Branch ${branchId} not found`)
    
    if (!newName.trim()) throw new Error('Branch name cannot be empty')
    
    const oldName = branch.name
    branch.name = newName.trim()
    this.updateMetadata()
    
    this.emit({
      type: 'branch_edited',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now(),
      data: { oldName, newName }
    })
  }

  toggleBranchFavorite(branchId: string): boolean {
    const branch = this.tree.branches.find(b => b.id === branchId)
    if (!branch) throw new Error(`Branch ${branchId} not found`)
    
    branch.isFavorite = !branch.isFavorite
    this.updateMetadata()
    
    this.emit({
      type: 'branch_edited',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now(),
      data: { favorited: branch.isFavorite }
    })
    
    return branch.isFavorite
  }

  setBranchColor(branchId: string, color: string): void {
    const branch = this.tree.branches.find(b => b.id === branchId)
    if (!branch) throw new Error(`Branch ${branchId} not found`)
    
    branch.color = color
    this.updateMetadata()
    
    this.emit({
      type: 'branch_edited',
      nodeId: branch.leafNodeId,
      branchId,
      timestamp: Date.now(),
      data: { color }
    })
  }

  compareBranches(branchAId: string, branchBId: string): BranchComparison {
    const branchA = this.tree.branches.find(b => b.id === branchAId)
    const branchB = this.tree.branches.find(b => b.id === branchBId)
    
    if (!branchA) throw new Error(`Branch ${branchAId} not found`)
    if (!branchB) throw new Error(`Branch ${branchBId} not found`)
    
    const pathA = this.getPathToNode(branchA.leafNodeId)
    const pathB = this.getPathToNode(branchB.leafNodeId)
    
    const differences: BranchComparison['differences'] = []
    
    // Find common ancestor
    let commonAncestorIndex = 0
    while (
      commonAncestorIndex < Math.min(pathA.length, pathB.length) &&
      pathA[commonAncestorIndex] === pathB[commonAncestorIndex]
    ) {
      commonAncestorIndex++
    }
    
    // Nodes unique to branch A
    for (let i = commonAncestorIndex; i < pathA.length; i++) {
      const node = this.tree.nodes.get(pathA[i])!
      differences.push({
        nodeId: pathA[i],
        type: 'added',
        content: this.getMessageContent(node.message),
        branch: 'A'
      })
    }
    
    // Nodes unique to branch B
    for (let i = commonAncestorIndex; i < pathB.length; i++) {
      const node = this.tree.nodes.get(pathB[i])!
      differences.push({
        nodeId: pathB[i],
        type: 'added',
        content: this.getMessageContent(node.message),
        branch: 'B'
      })
    }
    
    return {
      branchA,
      branchB,
      differences: differences as BranchComparison['differences']
    }
  }

  mergeBranches(sourceBranchId: string, targetBranchId: string, strategy: 'append' | 'replace' | 'manual' = 'append'): string {
    const sourceBranch = this.tree.branches.find(b => b.id === sourceBranchId)
    const targetBranch = this.tree.branches.find(b => b.id === targetBranchId)
    
    if (!sourceBranch) throw new Error(`Source branch ${sourceBranchId} not found`)
    if (!targetBranch) throw new Error(`Target branch ${targetBranchId} not found`)
    
    const comparison = this.compareBranches(sourceBranchId, targetBranchId)
    
    if (strategy === 'append') {
      // Append unique nodes from source to target
      const sourceUniqueNodes = comparison.differences
        .filter(diff => diff.branch === 'A')
        .map(diff => diff.nodeId)
      
      let currentParentId = targetBranch.leafNodeId
      
      for (const nodeId of sourceUniqueNodes) {
        const sourceNode = this.tree.nodes.get(nodeId)!
        const newNodeId = this.generateId()
        
        const mergedNode: ConversationNode = {
          ...sourceNode,
          id: newNodeId,
          parentId: currentParentId,
          children: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {
            ...sourceNode.metadata,
            createdBy: 'system'
          }
        }
        
        // Update parent's children
        const parent = this.tree.nodes.get(currentParentId)!
        parent.children.push(newNodeId)
        
        this.tree.nodes.set(newNodeId, mergedNode)
        currentParentId = newNodeId
      }
      
      // Update target branch leaf
      targetBranch.leafNodeId = currentParentId
      targetBranch.messageCount += sourceUniqueNodes.length
      
      this.emit({
        type: 'branch_merged',
        nodeId: currentParentId,
        branchId: targetBranchId,
        timestamp: Date.now(),
        data: { sourceBranchId, strategy, mergedNodes: sourceUniqueNodes.length }
      })
      
      return currentParentId
    }
    
    throw new Error(`Merge strategy '${strategy}' not yet implemented`)
  }

  deleteMessage(nodeId: string, preserveBranches = false): void {
    const node = this.tree.nodes.get(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    
    // Check if this node is critical to any branches
    const affectedBranches = this.tree.branches.filter(branch => 
      this.getPathToNode(branch.leafNodeId).includes(nodeId)
    )
    
    if (affectedBranches.length > 0 && !preserveBranches) {
      throw new Error(`Cannot delete node ${nodeId}: it affects ${affectedBranches.length} branches. Use preserveBranches=true to force deletion.`)
    }
    
    // Remove from parent's children
    if (node.parentId) {
      const parent = this.tree.nodes.get(node.parentId)!
      parent.children = parent.children.filter(childId => childId !== nodeId)
    }
    
    // Handle children - promote them to node's parent
    if (node.children.length > 0) {
      for (const childId of node.children) {
        const child = this.tree.nodes.get(childId)!
        child.parentId = node.parentId
        
        if (node.parentId) {
          const parent = this.tree.nodes.get(node.parentId)!
          parent.children.push(childId)
        }
      }
    }
    
    // Update affected branches
    for (const branch of affectedBranches) {
      if (branch.leafNodeId === nodeId) {
        // Find new leaf node (parent or first child)
        branch.leafNodeId = node.parentId || node.children[0] || branch.rootNodeId
        branch.messageCount--
      }
    }
    
    // Remove the node
    this.tree.nodes.delete(nodeId)
    
    // Update current node if it was deleted
    if (this.tree.currentNodeId === nodeId) {
      this.tree.currentNodeId = node.parentId || node.children[0] || this.tree.rootId
      this.updateCurrentPath()
    }
    
    this.updateMetadata()
    
    this.emit({
      type: 'node_deleted',
      nodeId,
      timestamp: Date.now(),
      data: { affectedBranches: affectedBranches.length }
    })
  }

  createBranchFromMessage(nodeId: string, branchName?: string): string {
    const node = this.tree.nodes.get(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    
    // Create a new branch starting from this node
    return this.createBranch(nodeId, branchName || `Branch from "${this.getMessagePreview(node.message)}"`)
  }

  private removeUniqueBranchNodes(branch: Branch): void {
    // Get all nodes in this branch's path
    const branchPath = this.getPathToNode(branch.leafNodeId)
    
    // Find nodes that are unique to this branch (not shared with other branches)
    const nodesToRemove: string[] = []
    
    for (const nodeId of branchPath) {
      const node = this.tree.nodes.get(nodeId)!
      
      // Check if this node is part of other branches
      const otherBranches = this.tree.branches.filter(b => 
        b.id !== branch.id && 
        this.getPathToNode(b.leafNodeId).includes(nodeId)
      )
      
      // If node is unique to this branch and not the root, mark for removal
      if (otherBranches.length === 0 && nodeId !== this.tree.rootId) {
        nodesToRemove.push(nodeId)
      }
    }
    
    // Remove nodes in reverse order (children first)
    for (const nodeId of nodesToRemove.reverse()) {
      const node = this.tree.nodes.get(nodeId)!
      
      // Remove from parent's children
      if (node.parentId) {
        const parent = this.tree.nodes.get(node.parentId)!
        parent.children = parent.children.filter(childId => childId !== nodeId)
      }
      
      // Remove the node
      this.tree.nodes.delete(nodeId)
    }
    
    this.updateMetadata()
    
    this.emit({
      type: 'branch_deleted',
      nodeId: branch.leafNodeId,
      branchId: branch.id,
      timestamp: Date.now(),
      data: { removedNodes: nodesToRemove.length }
    })
  }

  private generateId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private emit(change: TreeStateChange): void {
    this.listeners.forEach(listener => listener(change))
  }

  // Public API for managing listeners
  addEventListener(listener: (change: TreeStateChange) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // Getters
  getTree(): ConversationTree {
    return { ...this.tree }
  }

  getNode(nodeId: string): ConversationNode | undefined {
    return this.tree.nodes.get(nodeId)
  }

  getAllNodes(): ConversationNode[] {
    return Array.from(this.tree.nodes.values())
  }

  getBranches(): Branch[] {
    return [...this.tree.branches]
  }
}