"use client"

import { useState, useEffect } from "react"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { 
  Settings, 
  Palette, 
  Zap, 
  Brain, 
  GitBranch,
  Download,
  Upload,
  RotateCcw,
  Save,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ChatSettings {
  // Model Settings
  defaultModel: string
  temperature: number
  maxTokens: number
  systemPromptType: 'default' | 'technical' | 'creative'
  
  // UI Settings
  theme: 'dark' | 'light' | 'auto'
  compactMode: boolean
  showTimestamps: boolean
  enableAnimations: boolean
  
  // Conversation Settings
  enableBranching: boolean
  autoSaveBranches: boolean
  maxBranches: number
  branchNamingStrategy: 'auto' | 'manual' | 'hybrid'
  
  // Advanced Settings
  enableMarkdownPreview: boolean
  syntaxHighlighting: boolean
  codeExecutionEnabled: boolean
  autoGenerateArtifacts: boolean
}

interface ChatSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: Partial<ChatSettings>
  onSettingsChange: (settings: Partial<ChatSettings>) => void
  className?: string
}

const defaultSettings: ChatSettings = {
  defaultModel: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 4096,
  systemPromptType: 'default',
  theme: 'dark',
  compactMode: false,
  showTimestamps: false,
  enableAnimations: true,
  enableBranching: false,
  autoSaveBranches: true,
  maxBranches: 10,
  branchNamingStrategy: 'hybrid',
  enableMarkdownPreview: true,
  syntaxHighlighting: true,
  codeExecutionEnabled: true,
  autoGenerateArtifacts: true
}

export function ChatSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSettingsChange,
  className
}: ChatSettingsModalProps) {
  const [settings, setSettings] = useState<ChatSettings>({ ...defaultSettings, ...currentSettings })
  const [hasChanges, setHasChanges] = useState(false)

  // Update settings when props change
  useEffect(() => {
    setSettings({ ...defaultSettings, ...currentSettings })
    setHasChanges(false)
  }, [currentSettings, isOpen])

  const handleSettingChange = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    onSettingsChange(settings)
    setHasChanges(false)
    toast.success('Settings saved successfully')
  }

  const handleReset = () => {
    setSettings({ ...defaultSettings })
    setHasChanges(true)
    toast.info('Settings reset to defaults')
  }

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Settings exported')
  }

  const handleImportSettings = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const importedSettings = JSON.parse(e.target?.result as string)
            setSettings({ ...defaultSettings, ...importedSettings })
            setHasChanges(true)
            toast.success('Settings imported successfully')
          } catch (error) {
            toast.error('Failed to import settings: Invalid JSON file')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("glass max-w-4xl max-h-[80vh] overflow-auto", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-periwinkle" />
            Chat Settings
          </DialogTitle>
          <DialogDescription>
            Customize your AI chat experience, model parameters, and conversation management.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="model" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="model" className="gap-1">
              <Brain className="h-3 w-3" />
              Model
            </TabsTrigger>
            <TabsTrigger value="ui" className="gap-1">
              <Palette className="h-3 w-3" />
              Interface
            </TabsTrigger>
            <TabsTrigger value="conversation" className="gap-1">
              <GitBranch className="h-3 w-3" />
              Conversation
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1">
              <Zap className="h-3 w-3" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Model Settings */}
          <TabsContent value="model" className="space-y-6">
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-4">Model Configuration</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model-select">Default Model</Label>
                  <Select 
                    value={settings.defaultModel} 
                    onValueChange={(value) => handleSettingChange('defaultModel', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</SelectItem>
                      <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                      <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {settings.temperature}</Label>
                  <Slider
                    value={[settings.temperature]}
                    onValueChange={([value]) => handleSettingChange('temperature', value)}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">
                    Lower values = more focused, higher values = more creative
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value) || 4096)}
                    min={100}
                    max={8192}
                    className="bg-black/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt Type</Label>
                  <Select 
                    value={settings.systemPromptType} 
                    onValueChange={(value: any) => handleSettingChange('systemPromptType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* UI Settings */}
          <TabsContent value="ui" className="space-y-6">
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-4">Interface Preferences</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact Mode</Label>
                    <div className="text-xs text-muted-foreground">
                      Reduce spacing and padding for more content
                    </div>
                  </div>
                  <Switch
                    checked={settings.compactMode}
                    onCheckedChange={(checked) => handleSettingChange('compactMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Timestamps</Label>
                    <div className="text-xs text-muted-foreground">
                      Display message timestamps
                    </div>
                  </div>
                  <Switch
                    checked={settings.showTimestamps}
                    onCheckedChange={(checked) => handleSettingChange('showTimestamps', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Animations</Label>
                    <div className="text-xs text-muted-foreground">
                      Smooth transitions and animations
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableAnimations}
                    onCheckedChange={(checked) => handleSettingChange('enableAnimations', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select 
                    value={settings.theme} 
                    onValueChange={(value: any) => handleSettingChange('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="auto">Auto (System)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Conversation Settings */}
          <TabsContent value="conversation" className="space-y-6">
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-4">Conversation Management</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Branching</Label>
                    <div className="text-xs text-muted-foreground">
                      Allow conversation trees and branches
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableBranching}
                    onCheckedChange={(checked) => handleSettingChange('enableBranching', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Save Branches</Label>
                    <div className="text-xs text-muted-foreground">
                      Automatically save conversation branches
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoSaveBranches}
                    onCheckedChange={(checked) => handleSettingChange('autoSaveBranches', checked)}
                    disabled={!settings.enableBranching}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Branches: {settings.maxBranches}</Label>
                  <Slider
                    value={[settings.maxBranches]}
                    onValueChange={([value]) => handleSettingChange('maxBranches', value)}
                    max={50}
                    min={3}
                    step={1}
                    className="w-full"
                    disabled={!settings.enableBranching}
                  />
                  <div className="text-xs text-muted-foreground">
                    Maximum number of branches per conversation
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Branch Naming Strategy</Label>
                  <Select 
                    value={settings.branchNamingStrategy} 
                    onValueChange={(value: any) => handleSettingChange('branchNamingStrategy', value)}
                    disabled={!settings.enableBranching}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-generate names</SelectItem>
                      <SelectItem value="manual">Manual naming only</SelectItem>
                      <SelectItem value="hybrid">Hybrid (auto with manual option)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-6">
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-4">Advanced Features</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Markdown Preview</Label>
                    <div className="text-xs text-muted-foreground">
                      Live preview while typing markdown
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableMarkdownPreview}
                    onCheckedChange={(checked) => handleSettingChange('enableMarkdownPreview', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Syntax Highlighting</Label>
                    <div className="text-xs text-muted-foreground">
                      Highlight code blocks and syntax
                    </div>
                  </div>
                  <Switch
                    checked={settings.syntaxHighlighting}
                    onCheckedChange={(checked) => handleSettingChange('syntaxHighlighting', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Code Execution</Label>
                    <div className="text-xs text-muted-foreground">
                      Enable code execution in sandboxed environment
                    </div>
                  </div>
                  <Switch
                    checked={settings.codeExecutionEnabled}
                    onCheckedChange={(checked) => handleSettingChange('codeExecutionEnabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Generate Artifacts</Label>
                    <div className="text-xs text-muted-foreground">
                      Automatically create artifacts for code and documents
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoGenerateArtifacts}
                    onCheckedChange={(checked) => handleSettingChange('autoGenerateArtifacts', checked)}
                  />
                </div>
              </div>
            </GlassCard>

            {/* Import/Export Settings */}
            <GlassCard className="p-4">
              <h3 className="font-semibold mb-4">Settings Management</h3>
              
              <div className="flex gap-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={handleExportSettings}
                  className="gap-1"
                >
                  <Download className="h-3 w-3" />
                  Export Settings
                </GlassButton>
                
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={handleImportSettings}
                  className="gap-1"
                >
                  <Upload className="h-3 w-3" />
                  Import Settings
                </GlassButton>
                
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1 text-yellow-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Defaults
                </GlassButton>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <div className="text-sm text-muted-foreground">
            {hasChanges && (
              <span className="text-yellow-400">• Unsaved changes</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <GlassButton
              variant="ghost"
              onClick={handleClose}
              className="gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </GlassButton>
            
            <GlassButton
              variant="default"
              onClick={handleSave}
              disabled={!hasChanges}
              className="gap-1"
            >
              <Save className="h-3 w-3" />
              Save Settings
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}