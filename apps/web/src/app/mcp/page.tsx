"use client"

import { useState, useEffect } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  Plus,
  Server,
  Activity,
  Wifi,
  WifiOff,
  Settings,
  Shield,
  Zap,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  MoreVertical,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Edit,
  Trash2
} from "lucide-react"

// Mock data for MCP servers
const mockServers = [
  {
    id: 1,
    name: "Sequential Thinking",
    description: "Advanced reasoning and problem-solving capabilities",
    status: "connected",
    url: "mcp://sequential-thinking",
    version: "v2.1.0",
    uptime: "99.9%",
    lastSync: "30 seconds ago",
    tools: ["think", "analyze", "reason", "solve"],
    resources: 12,
    permissions: ["read", "write", "execute"],
    latency: 45,
    requests: 1247,
  },
  {
    id: 2,
    name: "Kluster Verification",
    description: "Code quality and verification system",
    status: "connected",
    url: "mcp://kluster-ai",
    version: "v1.8.3",
    uptime: "98.7%",
    lastSync: "1 minute ago",
    tools: ["verify", "analyze-code", "quality-check", "security-scan"],
    resources: 8,
    permissions: ["read", "execute"],
    latency: 62,
    requests: 892,
  },
  {
    id: 3,
    name: "Context7 Docs",
    description: "Documentation and knowledge management",
    status: "connecting",
    url: "mcp://context7",
    version: "v3.0.1",
    uptime: "97.2%",
    lastSync: "connecting...",
    tools: ["search", "index", "retrieve", "cache"],
    resources: 25,
    permissions: ["read"],
    latency: 0,
    requests: 534,
  },
  {
    id: 4,
    name: "Web Search",
    description: "Real-time web search and information retrieval",
    status: "error",
    url: "mcp://websearch",
    version: "v2.5.7",
    uptime: "95.1%",
    lastSync: "5 minutes ago",
    tools: ["search", "crawl", "summarize"],
    resources: 6,
    permissions: ["read", "network"],
    latency: 0,
    requests: 1823,
  },
  {
    id: 5,
    name: "Puppeteer Control",
    description: "Browser automation and UI testing",
    status: "connected",
    url: "mcp://puppeteer",
    version: "v1.4.2",
    uptime: "99.5%",
    lastSync: "2 minutes ago",
    tools: ["navigate", "click", "fill", "screenshot", "evaluate"],
    resources: 15,
    permissions: ["read", "write", "execute", "browser"],
    latency: 78,
    requests: 456,
  },
]

export default function MCPPage() {
  const [servers, setServers] = useState(mockServers)
  const [filter, setFilter] = useState("all")

  const filteredServers = servers.filter(server => 
    filter === "all" || server.status === filter
  )

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "connected":
        return { 
          color: "bg-light-green text-black",
          icon: CheckCircle,
          text: "Connected"
        }
      case "connecting":
        return { 
          color: "bg-yellow-500 text-black",
          icon: RefreshCw,
          text: "Connecting"
        }
      case "error":
        return { 
          color: "bg-red-500 text-white",
          icon: AlertCircle,
          text: "Error"
        }
      case "disconnected":
        return { 
          color: "bg-gray-500 text-white",
          icon: WifiOff,
          text: "Disconnected"
        }
      default:
        return { 
          color: "bg-gray-500 text-white",
          icon: WifiOff,
          text: "Unknown"
        }
    }
  }

  const connectedCount = servers.filter(s => s.status === "connected").length
  const totalTools = servers.reduce((acc, server) => acc + server.tools.length, 0)
  const totalResources = servers.reduce((acc, server) => acc + server.resources, 0)
  const avgLatency = Math.round(
    servers.filter(s => s.latency > 0).reduce((acc, server) => acc + server.latency, 0) / 
    servers.filter(s => s.latency > 0).length
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">MCP Server Management</h1>
            <p className="text-gray-300">Monitor and manage Model Context Protocol servers</p>
          </div>
          <GlassButton size="lg" variant="secondary" glow>
            <Plus className="mr-2 h-5 w-5" />
            Add Server
          </GlassButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="text-center">
            <Database className="h-8 w-8 text-periwinkle mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{servers.length}</div>
            <p className="text-gray-300 text-sm">Total Servers</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Wifi className="h-8 w-8 text-light-green mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{connectedCount}</div>
            <p className="text-gray-300 text-sm">Connected</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Zap className="h-8 w-8 text-periwinkle mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{totalTools}</div>
            <p className="text-gray-300 text-sm">Available Tools</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Clock className="h-8 w-8 text-light-green mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{avgLatency}ms</div>
            <p className="text-gray-300 text-sm">Avg Latency</p>
          </GlassCard>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {["all", "connected", "connecting", "error", "disconnected"].map(status => (
            <GlassButton
              key={status}
              variant={filter === status ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </GlassButton>
          ))}
        </div>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredServers.map((server, index) => {
          const statusInfo = getStatusInfo(server.status)
          const StatusIcon = statusInfo.icon
          
          return (
            <GlassCard 
              key={server.id} 
              hover 
              className={`animate-fade-in animation-delay-${(index + 1) * 200}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Server className="h-8 w-8 text-periwinkle" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{server.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusInfo.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusInfo.text}
                  </Badge>
                  <GlassButton variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </GlassButton>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4">{server.description}</p>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{server.uptime}</div>
                  <p className="text-xs text-gray-400">Uptime</p>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">
                    {server.latency > 0 ? `${server.latency}ms` : "N/A"}
                  </div>
                  <p className="text-xs text-gray-400">Latency</p>
                </div>
              </div>

              {/* Tools */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-periwinkle" />
                  <span className="text-sm font-medium text-white">Tools ({server.tools.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {server.tools.slice(0, 4).map(tool => (
                    <Badge key={tool} variant="outline" className="text-xs border-white/20 text-gray-300">
                      {tool}
                    </Badge>
                  ))}
                  {server.tools.length > 4 && (
                    <Badge variant="outline" className="text-xs border-white/20 text-gray-300">
                      +{server.tools.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Resources & Permissions */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Database className="h-3 w-3 text-light-green" />
                    <span className="text-xs text-gray-400">Resources</span>
                  </div>
                  <div className="text-sm text-white">{server.resources}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Shield className="h-3 w-3 text-light-green" />
                    <span className="text-xs text-gray-400">Permissions</span>
                  </div>
                  <div className="text-sm text-white">{server.permissions.length}</div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="text-xs text-gray-400">
                  <div>v{server.version}</div>
                  <div>Last sync: {server.lastSync}</div>
                  <div>{server.requests.toLocaleString()} requests</div>
                </div>
                <div className="flex gap-1">
                  <GlassButton variant="ghost" size="icon">
                    <Eye className="h-4 w-4" />
                  </GlassButton>
                  <GlassButton variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </GlassButton>
                  <GlassButton variant="ghost" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </GlassButton>
                  <GlassButton variant="ghost" size="icon">
                    {server.status === "connected" ? 
                      <Pause className="h-4 w-4" /> : 
                      <Play className="h-4 w-4" />
                    }
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredServers.length === 0 && (
        <GlassCard className="text-center py-12">
          <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No servers found</h3>
          <p className="text-gray-300 mb-6">
            {filter === "all" 
              ? "Add your first MCP server to get started" 
              : `No ${filter} servers found`
            }
          </p>
          <GlassButton variant="secondary" glow>
            <Plus className="mr-2 h-4 w-4" />
            Add Server
          </GlassButton>
        </GlassCard>
      )}
    </div>
  )
}