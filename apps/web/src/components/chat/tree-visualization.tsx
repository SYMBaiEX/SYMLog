"use client"

import React, { useMemo, useState, useRef, useEffect, memo } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import { 
  GitBranch, 
  MessageCircle, 
  User, 
  Bot, 
  ChevronDown, 
  ChevronRight,
  Eye,
  Edit3,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCurrentTree, useTreeNavigation } from "@/contexts/conversation-tree-context"
import type { ConversationNode, Branch } from "@/types/conversation-tree"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface TreeVisualizationProps {
  className?: string
  compact?: boolean
  onNodeSelect?: (nodeId: string) => void
}

interface TreeLayoutNode {
  node: ConversationNode
  x: number
  y: number
  level: number
  branch: Branch
  children: TreeLayoutNode[]
  isCollapsed?: boolean
}

interface Connection {
  from: { x: number; y: number }
  to: { x: number; y: number }
  fromNodeId: string
  toNodeId: string
}

function TreeVisualizationComponent({ className, compact = false, onNodeSelect }: TreeVisualizationProps) {
  const { tree, nodes, branches, currentNodeId } = useCurrentTree()
  const { switchToBranch, navigateToNode } = useTreeNavigation()
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Layout configuration
  const NODE_WIDTH = 200
  const NODE_HEIGHT = 80
  const LEVEL_HEIGHT = 120
  const SIBLING_SPACING = 40

  // Build tree layout
  const { layoutNodes, connections, bounds } = useMemo(() => {
    if (!tree || nodes.length === 0) {
      return { layoutNodes: [], connections: [], bounds: { width: 0, height: 0 } }
    }

    const nodeMap = new Map<string, ConversationNode>()
    nodes.forEach(node => nodeMap.set(node.id, node))

    const branchMap = new Map<string, Branch>()
    branches.forEach(branch => branchMap.set(branch.id, branch))

    // Find root nodes (nodes without parents)
    const rootNodes = nodes.filter(node => !node.parentId)
    
    if (rootNodes.length === 0) return { layoutNodes: [], connections: [], bounds: { width: 0, height: 0 } }

    const layoutNodes: TreeLayoutNode[] = []
    const connections: Connection[] = []
    
    // Track positions at each level
    const levelPositions = new Map<number, number>()
    
    function layoutNodeRecursive(
      node: ConversationNode, 
      level: number, 
      parentX?: number
    ): TreeLayoutNode {
      const branch = branchMap.get(
        branches.find(b => b.leafNodeId === node.id || 
          b.nodeIds?.includes(node.id))?.id || ''
      ) || branches[0]

      // Calculate position
      const currentLevelPosition = levelPositions.get(level) || 0
      const x = parentX !== undefined ? 
        Math.max(currentLevelPosition, parentX - NODE_WIDTH) : 
        currentLevelPosition
      
      levelPositions.set(level, x + NODE_WIDTH + SIBLING_SPACING)

      const y = level * LEVEL_HEIGHT

      const layoutNode: TreeLayoutNode = {
        node,
        x,
        y,
        level,
        branch,
        children: [],
        isCollapsed: collapsedNodes.has(node.id)
      }

      // Layout children if not collapsed
      if (!collapsedNodes.has(node.id)) {
        const childNodes = nodes.filter(n => n.parentId === node.id)
        layoutNode.children = childNodes.map(child => {
          const childLayout = layoutNodeRecursive(child, level + 1, x + NODE_WIDTH / 2)
          
          // Add connection
          connections.push({
            from: { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT },
            to: { x: childLayout.x + NODE_WIDTH / 2, y: childLayout.y },
            fromNodeId: node.id,
            toNodeId: child.id
          })
          
          return childLayout
        })
      }

      layoutNodes.push(layoutNode)
      return layoutNode
    }

    // Layout from each root
    rootNodes.forEach(root => layoutNodeRecursive(root, 0))

    // Calculate bounds
    const maxX = Math.max(...layoutNodes.map(n => n.x + NODE_WIDTH))
    const maxY = Math.max(...layoutNodes.map(n => n.y + NODE_HEIGHT))

    return {
      layoutNodes,
      connections,
      bounds: { width: maxX + 50, height: maxY + 50 }
    }
  }, [tree, nodes, branches, collapsedNodes])

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId)
    if (onNodeSelect) {
      onNodeSelect(nodeId)
    } else {
      navigateToNode(nodeId)
    }
  }

  const handleNodeDoubleClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      const branch = branches.find(b => 
        b.leafNodeId === nodeId || b.nodeIds?.includes(nodeId)
      )
      if (branch) {
        switchToBranch(branch.id)
        toast.success(`Switched to branch: ${branch.name}`)
      }
    }
  }

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const getNodeContent = (node: ConversationNode) => {
    const content = node.message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('')
    
    return content.length > 50 ? content.substring(0, 50) + '...' : content
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setCollapsedNodes(new Set())
  }

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3))
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.3))

  if (!tree || layoutNodes.length === 0) {
    return (
      <GlassCard className={cn("p-6 text-center", className)}>
        <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No conversation tree to visualize</p>
      </GlassCard>
    )
  }

  if (compact) {
    return (
      <GlassCard className={cn("p-4", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-periwinkle" />
            <span className="text-sm font-medium">Tree View</span>
            <Badge variant="secondary" className="text-xs">
              {layoutNodes.length} nodes
            </Badge>
          </div>
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsFullscreen(true)}
            title="Expand tree view"
          >
            <Maximize2 className="h-3 w-3" />
          </GlassButton>
        </div>
        
        <div className="h-32 overflow-hidden rounded-lg bg-black/20 border border-white/10">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${bounds.width} ${bounds.height}`}
            className="w-full h-full"
          >
            {/* Connections */}
            {connections.map((conn, i) => (
              <line
                key={i}
                x1={conn.from.x}
                y1={conn.from.y}
                x2={conn.to.x}
                y2={conn.to.y}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1"
              />
            ))}
            
            {/* Nodes */}
            {layoutNodes.map((layoutNode) => (
              <g key={layoutNode.node.id}>
                <rect
                  x={layoutNode.x}
                  y={layoutNode.y}
                  width={NODE_WIDTH * 0.4}
                  height={NODE_HEIGHT * 0.4}
                  rx="4"
                  fill={layoutNode.node.id === currentNodeId ? 
                    "rgba(138, 119, 255, 0.3)" : 
                    "rgba(255, 255, 255, 0.1)"
                  }
                  stroke={layoutNode.node.id === currentNodeId ? 
                    "rgba(138, 119, 255, 0.5)" : 
                    "rgba(255, 255, 255, 0.2)"
                  }
                  strokeWidth="1"
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(layoutNode.node.id)}
                />
                <circle
                  cx={layoutNode.x + 8}
                  cy={layoutNode.y + 8}
                  r="3"
                  fill={layoutNode.node.message.role === 'user' ? 
                    "rgba(138, 119, 255, 0.8)" : 
                    "rgba(76, 175, 80, 0.8)"
                  }
                />
              </g>
            ))}
          </svg>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn("flex flex-col", isFullscreen ? "fixed inset-4 z-50" : "", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-periwinkle" />
          <div>
            <h3 className="font-semibold">Conversation Tree</h3>
            <p className="text-xs text-muted-foreground">
              {layoutNodes.length} nodes • {branches.length} branches
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </GlassButton>
          
          <Badge variant="outline" className="text-xs px-2">
            {Math.round(zoom * 100)}%
          </Badge>
          
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </GlassButton>
          
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={resetView}
            title="Reset view"
          >
            <RotateCcw className="h-4 w-4" />
          </GlassButton>
          
          {isFullscreen && (
            <GlassButton
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsFullscreen(false)}
              title="Exit fullscreen"
            >
              <Minimize2 className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </div>

      {/* Tree visualization */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative bg-black/10 rounded-b-lg"
        style={{ minHeight: isFullscreen ? 'calc(100vh - 140px)' : '400px' }}
      >
        <svg
          ref={svgRef}
          width={bounds.width * zoom}
          height={bounds.height * zoom}
          viewBox={`${pan.x} ${pan.y} ${bounds.width / zoom} ${bounds.height / zoom}`}
          className="w-full h-full cursor-move"
        >
          {/* Grid pattern */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Connections */}
          {connections.map((conn, i) => (
            <g key={i}>
              <path
                d={`M ${conn.from.x} ${conn.from.y} 
                    C ${conn.from.x} ${conn.from.y + 30} 
                      ${conn.to.x} ${conn.to.y - 30} 
                      ${conn.to.x} ${conn.to.y}`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </g>
          ))}
          
          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="rgba(255, 255, 255, 0.3)"
              />
            </marker>
          </defs>
          
          {/* Nodes */}
          {layoutNodes.map((layoutNode) => {
            const isSelected = selectedNode === layoutNode.node.id
            const isCurrent = currentNodeId === layoutNode.node.id
            const isUser = layoutNode.node.message.role === 'user'
            const hasChildren = layoutNode.node.children.length > 0
            
            return (
              <g key={layoutNode.node.id}>
                {/* Node background */}
                <rect
                  x={layoutNode.x}
                  y={layoutNode.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="8"
                  fill={isCurrent ? 
                    "rgba(138, 119, 255, 0.2)" : 
                    isSelected ?
                    "rgba(255, 255, 255, 0.15)" :
                    "rgba(255, 255, 255, 0.05)"
                  }
                  stroke={isCurrent ? 
                    "rgba(138, 119, 255, 0.6)" : 
                    isSelected ?
                    "rgba(255, 255, 255, 0.4)" :
                    "rgba(255, 255, 255, 0.2)"
                  }
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-200 hover:fill-opacity-80"
                  onClick={() => handleNodeClick(layoutNode.node.id)}
                  onDoubleClick={() => handleNodeDoubleClick(layoutNode.node.id)}
                />
                
                {/* Role indicator */}
                <circle
                  cx={layoutNode.x + 16}
                  cy={layoutNode.y + 16}
                  r="6"
                  fill={isUser ? "rgba(138, 119, 255, 0.8)" : "rgba(76, 175, 80, 0.8)"}
                />
                
                {/* Role icon */}
                <foreignObject
                  x={layoutNode.x + 10}
                  y={layoutNode.y + 10}
                  width="12"
                  height="12"
                >
                  {isUser ? (
                    <User className="h-3 w-3 text-white" />
                  ) : (
                    <Bot className="h-3 w-3 text-white" />
                  )}
                </foreignObject>
                
                {/* Branch indicator */}
                <rect
                  x={layoutNode.x + NODE_WIDTH - 60}
                  y={layoutNode.y + 8}
                  width="52"
                  height="16"
                  rx="8"
                  fill={`rgba(${layoutNode.branch.color || '138, 119, 255'}, 0.2)`}
                />
                <text
                  x={layoutNode.x + NODE_WIDTH - 34}
                  y={layoutNode.y + 18}
                  textAnchor="middle"
                  className="text-xs font-medium fill-white"
                >
                  {layoutNode.branch.name.substring(0, 6)}
                </text>
                
                {/* Message content */}
                <foreignObject
                  x={layoutNode.x + 8}
                  y={layoutNode.y + 28}
                  width={NODE_WIDTH - 16}
                  height={36}
                >
                  <div className="text-xs text-white leading-tight p-1 overflow-hidden">
                    {getNodeContent(layoutNode.node)}
                  </div>
                </foreignObject>
                
                {/* Expand/collapse button */}
                {hasChildren && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleNodeCollapse(layoutNode.node.id)
                    }}
                  >
                    <circle
                      cx={layoutNode.x + NODE_WIDTH / 2}
                      cy={layoutNode.y + NODE_HEIGHT + 8}
                      r="8"
                      fill="rgba(255, 255, 255, 0.1)"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="1"
                    />
                    <foreignObject
                      x={layoutNode.x + NODE_WIDTH / 2 - 6}
                      y={layoutNode.y + NODE_HEIGHT + 2}
                      width="12"
                      height="12"
                    >
                      {collapsedNodes.has(layoutNode.node.id) ? (
                        <ChevronRight className="h-3 w-3 text-white" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-white" />
                      )}
                    </foreignObject>
                  </g>
                )}
                
                {/* Action menu */}
                <foreignObject
                  x={layoutNode.x + NODE_WIDTH - 24}
                  y={layoutNode.y + NODE_HEIGHT - 24}
                  width="20"
                  height="20"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-black/20 flex items-center justify-center hover:bg-black/40 transition-all">
                        <MoreHorizontal className="h-3 w-3 text-white" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass">
                      <DropdownMenuItem 
                        onClick={() => handleNodeClick(layoutNode.node.id)}
                        className="gap-2"
                      >
                        <Eye className="h-3 w-3" />
                        Navigate to
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleNodeDoubleClick(layoutNode.node.id)}
                        className="gap-2"
                      >
                        <GitBranch className="h-3 w-3" />
                        Switch branch
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => {
                          // Navigate to node and enable editing mode
                          handleNodeClick(layoutNode.node.id)
                          toast.info('Navigate to message to edit')
                        }}
                        className="gap-2"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </foreignObject>
              </g>
            )
          })}
        </svg>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur rounded-lg p-3 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-periwinkle" />
              <span>User message</span>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="h-3 w-3 text-light-green" />
              <span>AI message</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-periwinkle rounded bg-periwinkle/20" />
              <span>Current node</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const TreeVisualization = memo(TreeVisualizationComponent)