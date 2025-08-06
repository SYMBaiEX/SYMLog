'use client';

import {
  AlertCircle,
  BarChart3,
  Check,
  Code,
  Copy,
  Download,
  Edit,
  Eye,
  EyeOff,
  FileText,
  Image,
  Loader2,
  Maximize2,
  Play,
  RefreshCw,
  Save,
  Table,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CodeSandbox } from '@/components/dynamic';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Artifact, ArtifactAction, CodeArtifact } from '@/types/artifacts';
import { ChartViewer } from './chart-viewer';
import { CodeViewer } from './code-viewer';
import { DataViewer } from './data-viewer';
import { DocumentViewer } from './document-viewer';
import { ImageViewer } from './image-viewer';
import { SpreadsheetViewer } from './spreadsheet-viewer';

interface ArtifactViewerProps {
  artifact: Artifact;
  onClose?: () => void;
  onUpdate?: (artifact: Artifact) => void;
  onExecute?: (artifact: Artifact) => Promise<void>;
  isExecuting?: boolean;
  fullscreen?: boolean;
  editable?: boolean;
  className?: string;
}

export function ArtifactViewer({
  artifact,
  onClose,
  onUpdate,
  onExecute,
  isExecuting = false,
  fullscreen = false,
  editable = false,
  className,
}: ArtifactViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(artifact.content);
  const [activeTab, setActiveTab] = useState<'preview' | 'source' | 'execute'>(
    'preview'
  );
  const [copied, setCopied] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);

  useEffect(() => {
    setEditedContent(artifact.content);
  }, [artifact.content]);

  const getIcon = () => {
    switch (artifact.type) {
      case 'code':
      case 'react-component':
      case 'python-script':
      case 'sql-query':
        return <Code className="h-4 w-4" />;
      case 'document':
      case 'markdown':
      case 'html':
        return <FileText className="h-4 w-4" />;
      case 'spreadsheet':
        return <Table className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'chart':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${
      artifact.language || 'txt'
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully');
  };

  const handleSave = () => {
    if (onUpdate) {
      onUpdate({
        ...artifact,
        content: editedContent,
        updatedAt: Date.now(),
        version: artifact.version + 1,
      });
      setIsEditing(false);
      toast.success('Saved successfully');
    }
  };

  const handleExecute = async () => {
    if (onExecute && !isExecuting) {
      await onExecute(artifact);
    }
  };

  const isExecutable = [
    'code',
    'react-component',
    'python-script',
    'sql-query',
  ].includes(artifact.type);

  const actions: ArtifactAction[] = [
    {
      id: 'copy',
      label: 'Copy',
      icon: copied ? 'check' : 'copy',
      handler: handleCopy,
    },
    {
      id: 'download',
      label: 'Download',
      icon: 'download',
      handler: handleDownload,
    },
    ...(isExecutable && onExecute
      ? [
          {
            id: 'execute',
            label: isExecuting ? 'Executing...' : 'Run',
            icon: isExecuting ? 'loader' : 'play',
            handler: handleExecute,
            enabled: () => !isExecuting,
          },
        ]
      : []),
    ...(editable && onUpdate
      ? [
          {
            id: 'edit',
            label: isEditing ? 'Save' : 'Edit',
            icon: isEditing ? 'save' : 'edit',
            handler: isEditing ? handleSave : () => setIsEditing(true),
          },
        ]
      : []),
  ];

  const renderViewer = () => {
    if (activeTab === 'source' || isEditing) {
      return (
        <CodeViewer
          artifact={
            {
              ...artifact,
              content: isEditing ? editedContent : artifact.content,
            } as CodeArtifact
          }
          editable={isEditing}
          onChange={setEditedContent}
        />
      );
    }

    switch (artifact.type) {
      case 'code':
      case 'react-component':
      case 'python-script':
      case 'sql-query':
        return <CodeViewer artifact={artifact as any} />;
      case 'document':
      case 'markdown':
      case 'html':
        return <DocumentViewer artifact={artifact as any} />;
      case 'spreadsheet':
        return <SpreadsheetViewer artifact={artifact as any} />;
      case 'image':
        return <ImageViewer artifact={artifact as any} />;
      case 'chart':
        return <ChartViewer artifact={artifact as any} />;
      case 'json':
      case 'csv':
        return <DataViewer artifact={artifact as any} />;
      default:
        return (
          <div className="p-4 text-muted-foreground">
            Unsupported artifact type
          </div>
        );
    }
  };

  return (
    <GlassCard
      className={cn(
        'flex flex-col',
        isFullscreen && 'fixed inset-4 z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-white/10 border-b p-4">
        <div className="flex items-center gap-3">
          {getIcon()}
          <h3 className="font-semibold">{artifact.title}</h3>
          <Badge className="text-xs" variant="secondary">
            {artifact.type}
          </Badge>
          {artifact.language && (
            <Badge className="text-xs" variant="outline">
              {artifact.language}
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">
            v{artifact.version}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <GlassButton
              className="h-8 w-8"
              disabled={action.enabled ? !action.enabled(artifact) : false}
              key={action.id}
              onClick={() => action.handler(artifact)}
              size="icon"
              variant="ghost"
            >
              {action.icon === 'check' && <Check className="h-4 w-4" />}
              {action.icon === 'copy' && <Copy className="h-4 w-4" />}
              {action.icon === 'download' && <Download className="h-4 w-4" />}
              {action.icon === 'play' && <Play className="h-4 w-4" />}
              {action.icon === 'loader' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {action.icon === 'edit' && <Edit className="h-4 w-4" />}
              {action.icon === 'save' && <Save className="h-4 w-4" />}
            </GlassButton>
          ))}

          <GlassButton
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
            size="icon"
            variant="ghost"
          >
            <Maximize2 className="h-4 w-4" />
          </GlassButton>

          {onClose && (
            <GlassButton
              className="h-8 w-8"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(artifact.type === 'code' ||
          artifact.type === 'react-component' ||
          artifact.type === 'python-script' ||
          artifact.type === 'document' ||
          artifact.type === 'markdown') && (
          <Tabs
            className="h-full"
            onValueChange={(v) =>
              setActiveTab(v as 'preview' | 'source' | 'execute')
            }
            value={activeTab}
          >
            <div className="px-4 pt-2">
              <TabsList className="glass">
                <TabsTrigger className="gap-2" value="preview">
                  <Eye className="h-3 w-3" />
                  Preview
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="source">
                  <Code className="h-3 w-3" />
                  Source
                </TabsTrigger>
                {isExecutable && (
                  <TabsTrigger className="gap-2" value="execute">
                    <Play className="h-3 w-3" />
                    Execute
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            <TabsContent className="h-[calc(100%-3rem)]" value="preview">
              {renderViewer()}
            </TabsContent>
            <TabsContent className="h-[calc(100%-3rem)]" value="source">
              {renderViewer()}
            </TabsContent>
            {isExecutable && (
              <TabsContent className="h-[calc(100%-3rem)]" value="execute">
                <CodeSandbox
                  code={artifact.content}
                  language={artifact.language || 'javascript'}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
        {artifact.type !== 'code' &&
          artifact.type !== 'document' &&
          artifact.type !== 'markdown' &&
          renderViewer()}
      </div>

      {/* Execution Output */}
      {isExecutable && (artifact as any).output && (
        <div className="border-white/10 border-t p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge className="text-xs" variant="outline">
              Output
            </Badge>
            {(artifact as any).error && (
              <Badge className="gap-1 text-xs" variant="destructive">
                <AlertCircle className="h-3 w-3" />
                Error
              </Badge>
            )}
          </div>
          <pre className="max-h-32 overflow-auto rounded-lg bg-black/20 p-3 text-xs">
            {(artifact as any).error || (artifact as any).output}
          </pre>
        </div>
      )}
    </GlassCard>
  );
}
