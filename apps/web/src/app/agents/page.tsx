"use client"

import { useState, useEffect } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"
import { Badge } from "@/components/ui/badge"
import {
  Bot,
  Plus,
  Settings,
  Brain,
  Database,
  Activity,
  Eye,
  Edit,
  Trash2,
  Copy,
  Play,
  Pause,
  MoreVertical
} from "lucide-react"

// Mock data for AI agents
const mockAgents = [
  {
    id: 1,
    name: "Claude Assistant",
    description: "General purpose AI assistant with advanced reasoning capabilities",
    status: "active",
    avatar: "🤖",
    memoryUsage: 68,
    lastActivity: "2 minutes ago",
    capabilities: ["Reasoning", "Code", "Analysis"],
    model: "Claude 3.5 Sonnet",
  },
  {
    id: 2,
    name: "Research Bot",
    description: "Specialized in academic research and data analysis",
    status: "active",
    avatar: "🔬",
    memoryUsage: 45,
    lastActivity: "5 minutes ago",
    capabilities: ["Research", "Data Analysis", "Citations"],
    model: "GPT-4",
  },
  {
    id: 3,
    name: "Code Mentor",
    description: "Expert programming assistant for multiple languages",
    status: "paused",
    avatar: "💻",
    memoryUsage: 23,
    lastActivity: "1 hour ago",
    capabilities: ["Programming", "Debugging", "Code Review"],
    model: "Claude 3.5 Sonnet",
  },
  {
    id: 4,
    name: "Creative Writer",
    description: "AI specialized in creative writing and storytelling",
    status: "active",
    avatar: "✍️",
    memoryUsage: 72,
    lastActivity: "10 minutes ago",
    capabilities: ["Writing", "Storytelling", "Poetry"],
    model: "GPT-4 Turbo",
  },
]

export default function AgentsPage() {
  const [agents, setAgents] = useState(mockAgents)
  const [filter, setFilter] = useState("all")

  const filteredAgents = agents.filter(agent => 
    filter === "all" || agent.status === filter
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-light-green text-black"
      case "paused":
        return "bg-yellow-500 text-black"
      case "offline":
        return "bg-red-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">AI Agent Portal</h1>
            <p className="text-gray-300">Manage and customize your intelligent AI agents</p>
          </div>
          <GlassButton size="lg" glow>
            <Plus className="mr-2 h-5 w-5" />
            Create Agent
          </GlassButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="text-center">
            <Bot className="h-8 w-8 text-periwinkle mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{agents.length}</div>
            <p className="text-gray-300 text-sm">Total Agents</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Activity className="h-8 w-8 text-light-green mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">
              {agents.filter(a => a.status === "active").length}
            </div>
            <p className="text-gray-300 text-sm">Active</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Database className="h-8 w-8 text-periwinkle mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">
              {Math.round(agents.reduce((acc, agent) => acc + agent.memoryUsage, 0) / agents.length)}%
            </div>
            <p className="text-gray-300 text-sm">Avg Memory</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Brain className="h-8 w-8 text-light-green mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">3</div>
            <p className="text-gray-300 text-sm">Models</p>
          </GlassCard>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {["all", "active", "paused", "offline"].map(status => (
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

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent, index) => (
          <GlassCard 
            key={agent.id} 
            hover 
            className={`animate-fade-in animation-delay-${(index + 1) * 200}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{agent.avatar}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                  <Badge className={getStatusColor(agent.status)}>
                    {agent.status}
                  </Badge>
                </div>
              </div>
              <GlassButton variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </GlassButton>
            </div>

            <p className="text-gray-300 text-sm mb-4">{agent.description}</p>

            {/* Memory Usage */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Memory Usage</span>
                <span className="text-white">{agent.memoryUsage}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-periwinkle to-light-green h-2 rounded-full transition-all duration-300"
                  style={{ width: `${agent.memoryUsage}%` }}
                />
              </div>
            </div>

            {/* Capabilities */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map(capability => (
                  <Badge key={capability} variant="outline" className="text-xs border-white/20 text-gray-300">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="text-xs text-gray-400">
                <div>Model: {agent.model}</div>
                <div>Last: {agent.lastActivity}</div>
              </div>
              <div className="flex gap-1">
                <GlassButton variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </GlassButton>
                <GlassButton variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </GlassButton>
                <GlassButton variant="ghost" size="icon">
                  <Copy className="h-4 w-4" />
                </GlassButton>
                <GlassButton variant="ghost" size="icon">
                  {agent.status === "active" ? 
                    <Pause className="h-4 w-4" /> : 
                    <Play className="h-4 w-4" />
                  }
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Empty State */}
      {filteredAgents.length === 0 && (
        <GlassCard className="text-center py-12">
          <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No agents found</h3>
          <p className="text-gray-300 mb-6">
            {filter === "all" 
              ? "Create your first AI agent to get started" 
              : `No ${filter} agents found`
            }
          </p>
          <GlassButton glow>
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </GlassButton>
        </GlassCard>
      )}
    </div>
  )
}