'use client';

import {
  Brain,
  Download,
  GitBranch,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ChatSettings {
  // Model Settings
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  systemPromptType: 'default' | 'technical' | 'creative';

  // UI Settings
  theme: 'dark' | 'light' | 'auto';
  compactMode: boolean;
  showTimestamps: boolean;
  enableAnimations: boolean;

  // Conversation Settings
  enableBranching: boolean;
  autoSaveBranches: boolean;
  maxBranches: number;
  branchNamingStrategy: 'auto' | 'manual' | 'hybrid';

  // Advanced Settings
  enableMarkdownPreview: boolean;
  syntaxHighlighting: boolean;
  codeExecutionEnabled: boolean;
  autoGenerateArtifacts: boolean;
}

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: Partial<ChatSettings>;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  className?: string;
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
  autoGenerateArtifacts: true,
};

export function ChatSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSettingsChange,
  className,
}: ChatSettingsModalProps) {
  const [settings, setSettings] = useState<ChatSettings>({
    ...defaultSettings,
    ...currentSettings,
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Update settings when props change
  useEffect(() => {
    setSettings({ ...defaultSettings, ...currentSettings });
    setHasChanges(false);
  }, [currentSettings, isOpen]);

  const handleSettingChange = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSettingsChange(settings);
    setHasChanges(false);
    toast.success('Settings saved successfully');
  };

  const handleReset = () => {
    setSettings({ ...defaultSettings });
    setHasChanges(true);
    toast.info('Settings reset to defaults');
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Settings exported');
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedSettings = JSON.parse(e.target?.result as string);
            setSettings({ ...defaultSettings, ...importedSettings });
            setHasChanges(true);
            toast.success('Settings imported successfully');
          } catch (error) {
            toast.error('Failed to import settings: Invalid JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClose = () => {
    if (hasChanges) {
      if (
        confirm('You have unsaved changes. Are you sure you want to close?')
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog onOpenChange={handleClose} open={isOpen}>
      <DialogContent
        className={cn('glass max-h-[80vh] max-w-4xl overflow-auto', className)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-periwinkle" />
            Chat Settings
          </DialogTitle>
          <DialogDescription>
            Customize your AI chat experience, model parameters, and
            conversation management.
          </DialogDescription>
        </DialogHeader>

        <Tabs className="w-full" defaultValue="model">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger className="gap-1" value="model">
              <Brain className="h-3 w-3" />
              Model
            </TabsTrigger>
            <TabsTrigger className="gap-1" value="ui">
              <Palette className="h-3 w-3" />
              Interface
            </TabsTrigger>
            <TabsTrigger className="gap-1" value="conversation">
              <GitBranch className="h-3 w-3" />
              Conversation
            </TabsTrigger>
            <TabsTrigger className="gap-1" value="advanced">
              <Zap className="h-3 w-3" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Model Settings */}
          <TabsContent className="space-y-6" value="model">
            <GlassCard className="p-4">
              <h3 className="mb-4 font-semibold">Model Configuration</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model-select">Default Model</Label>
                  <Select
                    onValueChange={(value) =>
                      handleSettingChange('defaultModel', value)
                    }
                    value={settings.defaultModel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-5-sonnet-20241022">
                        Claude 3.5 Sonnet (Latest)
                      </SelectItem>
                      <SelectItem value="claude-3-5-haiku-20241022">
                        Claude 3.5 Haiku
                      </SelectItem>
                      <SelectItem value="claude-3-opus-20240229">
                        Claude 3 Opus
                      </SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {settings.temperature}</Label>
                  <Slider
                    className="w-full"
                    max={2}
                    min={0}
                    onValueChange={([value]) =>
                      handleSettingChange('temperature', value)
                    }
                    step={0.1}
                    value={[settings.temperature]}
                  />
                  <div className="text-muted-foreground text-xs">
                    Lower values = more focused, higher values = more creative
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    className="bg-black/20"
                    id="max-tokens"
                    max={8192}
                    min={100}
                    onChange={(e) =>
                      handleSettingChange(
                        'maxTokens',
                        Number.parseInt(e.target.value) || 4096
                      )
                    }
                    type="number"
                    value={settings.maxTokens}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt Type</Label>
                  <Select
                    onValueChange={(value: any) =>
                      handleSettingChange('systemPromptType', value)
                    }
                    value={settings.systemPromptType}
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
          <TabsContent className="space-y-6" value="ui">
            <GlassCard className="p-4">
              <h3 className="mb-4 font-semibold">Interface Preferences</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact Mode</Label>
                    <div className="text-muted-foreground text-xs">
                      Reduce spacing and padding for more content
                    </div>
                  </div>
                  <Switch
                    checked={settings.compactMode}
                    onCheckedChange={(checked) =>
                      handleSettingChange('compactMode', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Timestamps</Label>
                    <div className="text-muted-foreground text-xs">
                      Display message timestamps
                    </div>
                  </div>
                  <Switch
                    checked={settings.showTimestamps}
                    onCheckedChange={(checked) =>
                      handleSettingChange('showTimestamps', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Animations</Label>
                    <div className="text-muted-foreground text-xs">
                      Smooth transitions and animations
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableAnimations}
                    onCheckedChange={(checked) =>
                      handleSettingChange('enableAnimations', checked)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    onValueChange={(value: any) =>
                      handleSettingChange('theme', value)
                    }
                    value={settings.theme}
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
          <TabsContent className="space-y-6" value="conversation">
            <GlassCard className="p-4">
              <h3 className="mb-4 font-semibold">Conversation Management</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Branching</Label>
                    <div className="text-muted-foreground text-xs">
                      Allow conversation trees and branches
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableBranching}
                    onCheckedChange={(checked) =>
                      handleSettingChange('enableBranching', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Save Branches</Label>
                    <div className="text-muted-foreground text-xs">
                      Automatically save conversation branches
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoSaveBranches}
                    disabled={!settings.enableBranching}
                    onCheckedChange={(checked) =>
                      handleSettingChange('autoSaveBranches', checked)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Branches: {settings.maxBranches}</Label>
                  <Slider
                    className="w-full"
                    disabled={!settings.enableBranching}
                    max={50}
                    min={3}
                    onValueChange={([value]) =>
                      handleSettingChange('maxBranches', value)
                    }
                    step={1}
                    value={[settings.maxBranches]}
                  />
                  <div className="text-muted-foreground text-xs">
                    Maximum number of branches per conversation
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Branch Naming Strategy</Label>
                  <Select
                    disabled={!settings.enableBranching}
                    onValueChange={(value: any) =>
                      handleSettingChange('branchNamingStrategy', value)
                    }
                    value={settings.branchNamingStrategy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-generate names</SelectItem>
                      <SelectItem value="manual">Manual naming only</SelectItem>
                      <SelectItem value="hybrid">
                        Hybrid (auto with manual option)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent className="space-y-6" value="advanced">
            <GlassCard className="p-4">
              <h3 className="mb-4 font-semibold">Advanced Features</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Markdown Preview</Label>
                    <div className="text-muted-foreground text-xs">
                      Live preview while typing markdown
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableMarkdownPreview}
                    onCheckedChange={(checked) =>
                      handleSettingChange('enableMarkdownPreview', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Syntax Highlighting</Label>
                    <div className="text-muted-foreground text-xs">
                      Highlight code blocks and syntax
                    </div>
                  </div>
                  <Switch
                    checked={settings.syntaxHighlighting}
                    onCheckedChange={(checked) =>
                      handleSettingChange('syntaxHighlighting', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Code Execution</Label>
                    <div className="text-muted-foreground text-xs">
                      Enable code execution in sandboxed environment
                    </div>
                  </div>
                  <Switch
                    checked={settings.codeExecutionEnabled}
                    onCheckedChange={(checked) =>
                      handleSettingChange('codeExecutionEnabled', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Generate Artifacts</Label>
                    <div className="text-muted-foreground text-xs">
                      Automatically create artifacts for code and documents
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoGenerateArtifacts}
                    onCheckedChange={(checked) =>
                      handleSettingChange('autoGenerateArtifacts', checked)
                    }
                  />
                </div>
              </div>
            </GlassCard>

            {/* Import/Export Settings */}
            <GlassCard className="p-4">
              <h3 className="mb-4 font-semibold">Settings Management</h3>

              <div className="flex gap-2">
                <GlassButton
                  className="gap-1"
                  onClick={handleExportSettings}
                  size="sm"
                  variant="ghost"
                >
                  <Download className="h-3 w-3" />
                  Export Settings
                </GlassButton>

                <GlassButton
                  className="gap-1"
                  onClick={handleImportSettings}
                  size="sm"
                  variant="ghost"
                >
                  <Upload className="h-3 w-3" />
                  Import Settings
                </GlassButton>

                <GlassButton
                  className="gap-1 text-yellow-400"
                  onClick={handleReset}
                  size="sm"
                  variant="ghost"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Defaults
                </GlassButton>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between border-white/10 border-t pt-4">
          <div className="text-muted-foreground text-sm">
            {hasChanges && (
              <span className="text-yellow-400">• Unsaved changes</span>
            )}
          </div>

          <div className="flex gap-2">
            <GlassButton
              className="gap-1"
              onClick={handleClose}
              variant="ghost"
            >
              <X className="h-3 w-3" />
              Cancel
            </GlassButton>

            <GlassButton
              className="gap-1"
              disabled={!hasChanges}
              onClick={handleSave}
              variant="default"
            >
              <Save className="h-3 w-3" />
              Save Settings
            </GlassButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
