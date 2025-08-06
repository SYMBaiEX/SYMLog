'use client';

import {
  Bot,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  GitBranch,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  RotateCcw,
  User,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
} from '@/contexts/conversation-tree-context';
import { cn } from '@/lib/utils';
import type { Branch, ConversationNode } from '@/types/conversation-tree';

interface TreeVisualizationProps {
  className?: string;
  compact?: boolean;
  onNodeSelect?: (nodeId: string) => void;
}

interface TreeLayoutNode {
  node: ConversationNode;
  x: number;
  y: number;
  level: number;
  branch: Branch;
  children: TreeLayoutNode[];
  isCollapsed?: boolean;
}

interface Connection {
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromNodeId: string;
  toNodeId: string;
}

function TreeVisualizationComponent({
  className,
  compact = false,
  onNodeSelect,
}: TreeVisualizationProps) {
  const { tree, nodes, branches, currentNodeId } = useCurrentTree();
  const { switchToBranch, navigateToNode } = useTreeNavigation();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout configuration
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 80;
  const LEVEL_HEIGHT = 120;
  const SIBLING_SPACING = 40;

  // Build tree layout
  const { layoutNodes, connections, bounds } = useMemo(() => {
    if (!tree || nodes.length === 0) {
      return {
        layoutNodes: [],
        connections: [],
        bounds: { width: 0, height: 0 },
      };
    }

    const nodeMap = new Map<string, ConversationNode>();
    nodes.forEach((node) => nodeMap.set(node.id, node));

    const branchMap = new Map<string, Branch>();
    branches.forEach((branch) => branchMap.set(branch.id, branch));

    // Find root nodes (nodes without parents)
    const rootNodes = nodes.filter((node) => !node.parentId);

    if (rootNodes.length === 0)
      return {
        layoutNodes: [],
        connections: [],
        bounds: { width: 0, height: 0 },
      };

    const layoutNodes: TreeLayoutNode[] = [];
    const connections: Connection[] = [];

    // Track positions at each level
    const levelPositions = new Map<number, number>();

    function layoutNodeRecursive(
      node: ConversationNode,
      level: number,
      parentX?: number
    ): TreeLayoutNode {
      const branch =
        branchMap.get(
          branches.find(
            (b) =>
              b.leafNodeId === node.id || (b as any).nodeIds?.includes(node.id)
          )?.id || ''
        ) || branches[0];

      // Calculate position
      const currentLevelPosition = levelPositions.get(level) || 0;
      const x =
        parentX !== undefined
          ? Math.max(currentLevelPosition, parentX - NODE_WIDTH)
          : currentLevelPosition;

      levelPositions.set(level, x + NODE_WIDTH + SIBLING_SPACING);

      const y = level * LEVEL_HEIGHT;

      const layoutNode: TreeLayoutNode = {
        node,
        x,
        y,
        level,
        branch,
        children: [],
        isCollapsed: collapsedNodes.has(node.id),
      };

      // Layout children if not collapsed
      if (!collapsedNodes.has(node.id)) {
        const childNodes = nodes.filter((n) => n.parentId === node.id);
        layoutNode.children = childNodes.map((child) => {
          const childLayout = layoutNodeRecursive(
            child,
            level + 1,
            x + NODE_WIDTH / 2
          );

          // Add connection
          connections.push({
            from: { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT },
            to: { x: childLayout.x + NODE_WIDTH / 2, y: childLayout.y },
            fromNodeId: node.id,
            toNodeId: child.id,
          });

          return childLayout;
        });
      }

      layoutNodes.push(layoutNode);
      return layoutNode;
    }

    // Layout from each root
    rootNodes.forEach((root) => layoutNodeRecursive(root, 0));

    // Calculate bounds
    const maxX = Math.max(...layoutNodes.map((n) => n.x + NODE_WIDTH));
    const maxY = Math.max(...layoutNodes.map((n) => n.y + NODE_HEIGHT));

    return {
      layoutNodes,
      connections,
      bounds: { width: maxX + 50, height: maxY + 50 },
    };
  }, [tree, nodes, branches, collapsedNodes]);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    } else {
      navigateToNode(nodeId);
    }
  };

  const handleNodeDoubleClick = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      const branch = branches.find(
        (b) => b.leafNodeId === nodeId || (b as any).nodeIds?.includes(nodeId)
      );
      if (branch) {
        switchToBranch(branch.id);
        toast.success(`Switched to branch: ${branch.name}`);
      }
    }
  };

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const getNodeContent = (node: ConversationNode) => {
    const content = node.message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');

    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCollapsedNodes(new Set());
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.3));

  if (!tree || layoutNodes.length === 0) {
    return (
      <GlassCard className={cn('p-6 text-center', className)}>
        <GitBranch className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          No conversation tree to visualize
        </p>
      </GlassCard>
    );
  }

  if (compact) {
    return (
      <GlassCard className={cn('p-4', className)}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-periwinkle" />
            <span className="font-medium text-sm">Tree View</span>
            <Badge className="text-xs" variant="secondary">
              {layoutNodes.length} nodes
            </Badge>
          </div>
          <GlassButton
            className="h-6 w-6"
            onClick={() => setIsFullscreen(true)}
            size="icon"
            title="Expand tree view"
            variant="ghost"
          >
            <Maximize2 className="h-3 w-3" />
          </GlassButton>
        </div>

        <div className="h-32 overflow-hidden rounded-lg border border-white/10 bg-black/20">
          <svg
            className="h-full w-full"
            height="100%"
            viewBox={`0 0 ${bounds.width} ${bounds.height}`}
            width="100%"
          >
            {/* Connections */}
            {connections.map((conn, i) => (
              <line
                key={i}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1"
                x1={conn.from.x}
                x2={conn.to.x}
                y1={conn.from.y}
                y2={conn.to.y}
              />
            ))}

            {/* Nodes */}
            {layoutNodes.map((layoutNode) => (
              <g key={layoutNode.node.id}>
                <rect
                  className="cursor-pointer"
                  fill={
                    layoutNode.node.id === currentNodeId
                      ? 'rgba(138, 119, 255, 0.3)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }
                  height={NODE_HEIGHT * 0.4}
                  onClick={() => handleNodeClick(layoutNode.node.id)}
                  rx="4"
                  stroke={
                    layoutNode.node.id === currentNodeId
                      ? 'rgba(138, 119, 255, 0.5)'
                      : 'rgba(255, 255, 255, 0.2)'
                  }
                  strokeWidth="1"
                  width={NODE_WIDTH * 0.4}
                  x={layoutNode.x}
                  y={layoutNode.y}
                />
                <circle
                  cx={layoutNode.x + 8}
                  cy={layoutNode.y + 8}
                  fill={
                    layoutNode.node.message.role === 'user'
                      ? 'rgba(138, 119, 255, 0.8)'
                      : 'rgba(76, 175, 80, 0.8)'
                  }
                  r="3"
                />
              </g>
            ))}
          </svg>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      className={cn(
        'flex flex-col',
        isFullscreen ? 'fixed inset-4 z-50' : '',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-white/10 border-b p-4">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-periwinkle" />
          <div>
            <h3 className="font-semibold">Conversation Tree</h3>
            <p className="text-muted-foreground text-xs">
              {layoutNodes.length} nodes • {branches.length} branches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            className="h-8 w-8"
            onClick={zoomOut}
            size="icon"
            title="Zoom out"
            variant="ghost"
          >
            <ZoomOut className="h-4 w-4" />
          </GlassButton>

          <Badge className="px-2 text-xs" variant="outline">
            {Math.round(zoom * 100)}%
          </Badge>

          <GlassButton
            className="h-8 w-8"
            onClick={zoomIn}
            size="icon"
            title="Zoom in"
            variant="ghost"
          >
            <ZoomIn className="h-4 w-4" />
          </GlassButton>

          <GlassButton
            className="h-8 w-8"
            onClick={resetView}
            size="icon"
            title="Reset view"
            variant="ghost"
          >
            <RotateCcw className="h-4 w-4" />
          </GlassButton>

          {isFullscreen && (
            <GlassButton
              className="h-8 w-8"
              onClick={() => setIsFullscreen(false)}
              size="icon"
              title="Exit fullscreen"
              variant="ghost"
            >
              <Minimize2 className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </div>

      {/* Tree visualization */}
      <div
        className="relative flex-1 overflow-auto rounded-b-lg bg-black/10"
        ref={containerRef}
        style={{ minHeight: isFullscreen ? 'calc(100vh - 140px)' : '400px' }}
      >
        <svg
          className="h-full w-full cursor-move"
          height={bounds.height * zoom}
          ref={svgRef}
          viewBox={`${pan.x} ${pan.y} ${bounds.width / zoom} ${bounds.height / zoom}`}
          width={bounds.width * zoom}
        >
          {/* Grid pattern */}
          <defs>
            <pattern
              height="20"
              id="grid"
              patternUnits="userSpaceOnUse"
              width="20"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect fill="url(#grid)" height="100%" width="100%" />

          {/* Connections */}
          {connections.map((conn, i) => (
            <g key={i}>
              <path
                d={`M ${conn.from.x} ${conn.from.y} 
                    C ${conn.from.x} ${conn.from.y + 30} 
                      ${conn.to.x} ${conn.to.y - 30} 
                      ${conn.to.x} ${conn.to.y}`}
                fill="none"
                markerEnd="url(#arrowhead)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
              />
            </g>
          ))}

          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerHeight="7"
              markerWidth="10"
              orient="auto"
              refX="9"
              refY="3.5"
            >
              <polygon
                fill="rgba(255, 255, 255, 0.3)"
                points="0 0, 10 3.5, 0 7"
              />
            </marker>
          </defs>

          {/* Nodes */}
          {layoutNodes.map((layoutNode) => {
            const isSelected = selectedNode === layoutNode.node.id;
            const isCurrent = currentNodeId === layoutNode.node.id;
            const isUser = layoutNode.node.message.role === 'user';
            const hasChildren = layoutNode.node.children.length > 0;

            return (
              <g key={layoutNode.node.id}>
                {/* Node background */}
                <rect
                  className="cursor-pointer transition-all duration-200 hover:fill-opacity-80"
                  fill={
                    isCurrent
                      ? 'rgba(138, 119, 255, 0.2)'
                      : isSelected
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)'
                  }
                  height={NODE_HEIGHT}
                  onClick={() => handleNodeClick(layoutNode.node.id)}
                  onDoubleClick={() =>
                    handleNodeDoubleClick(layoutNode.node.id)
                  }
                  rx="8"
                  stroke={
                    isCurrent
                      ? 'rgba(138, 119, 255, 0.6)'
                      : isSelected
                        ? 'rgba(255, 255, 255, 0.4)'
                        : 'rgba(255, 255, 255, 0.2)'
                  }
                  strokeWidth="2"
                  width={NODE_WIDTH}
                  x={layoutNode.x}
                  y={layoutNode.y}
                />

                {/* Role indicator */}
                <circle
                  cx={layoutNode.x + 16}
                  cy={layoutNode.y + 16}
                  fill={
                    isUser
                      ? 'rgba(138, 119, 255, 0.8)'
                      : 'rgba(76, 175, 80, 0.8)'
                  }
                  r="6"
                />

                {/* Role icon */}
                <foreignObject
                  height="12"
                  width="12"
                  x={layoutNode.x + 10}
                  y={layoutNode.y + 10}
                >
                  {isUser ? (
                    <User className="h-3 w-3 text-white" />
                  ) : (
                    <Bot className="h-3 w-3 text-white" />
                  )}
                </foreignObject>

                {/* Branch indicator */}
                <rect
                  fill={`rgba(${layoutNode.branch.color || '138, 119, 255'}, 0.2)`}
                  height="16"
                  rx="8"
                  width="52"
                  x={layoutNode.x + NODE_WIDTH - 60}
                  y={layoutNode.y + 8}
                />
                <text
                  className="fill-white font-medium text-xs"
                  textAnchor="middle"
                  x={layoutNode.x + NODE_WIDTH - 34}
                  y={layoutNode.y + 18}
                >
                  {layoutNode.branch.name.substring(0, 6)}
                </text>

                {/* Message content */}
                <foreignObject
                  height={36}
                  width={NODE_WIDTH - 16}
                  x={layoutNode.x + 8}
                  y={layoutNode.y + 28}
                >
                  <div className="overflow-hidden p-1 text-white text-xs leading-tight">
                    {getNodeContent(layoutNode.node)}
                  </div>
                </foreignObject>

                {/* Expand/collapse button */}
                {hasChildren && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeCollapse(layoutNode.node.id);
                    }}
                  >
                    <circle
                      cx={layoutNode.x + NODE_WIDTH / 2}
                      cy={layoutNode.y + NODE_HEIGHT + 8}
                      fill="rgba(255, 255, 255, 0.1)"
                      r="8"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="1"
                    />
                    <foreignObject
                      height="12"
                      width="12"
                      x={layoutNode.x + NODE_WIDTH / 2 - 6}
                      y={layoutNode.y + NODE_HEIGHT + 2}
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
                  height="20"
                  width="20"
                  x={layoutNode.x + NODE_WIDTH - 24}
                  y={layoutNode.y + NODE_HEIGHT - 24}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-5 w-5 items-center justify-center rounded bg-black/20 opacity-0 transition-all hover:bg-black/40 group-hover:opacity-100">
                        <MoreHorizontal className="h-3 w-3 text-white" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleNodeClick(layoutNode.node.id)}
                      >
                        <Eye className="h-3 w-3" />
                        Navigate to
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() =>
                          handleNodeDoubleClick(layoutNode.node.id)
                        }
                      >
                        <GitBranch className="h-3 w-3" />
                        Switch branch
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => {
                          // Navigate to node and enable editing mode
                          handleNodeClick(layoutNode.node.id);
                          toast.info('Navigate to message to edit');
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-lg bg-black/40 p-3 text-xs backdrop-blur">
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
              <div className="h-3 w-3 rounded border-2 border-periwinkle bg-periwinkle/20" />
              <span>Current node</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const TreeVisualization = memo(TreeVisualizationComponent);
