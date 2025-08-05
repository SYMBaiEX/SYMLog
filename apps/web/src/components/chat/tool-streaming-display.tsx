'use client';

import {
  AlertCircleIcon,
  BarChart3Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CodeIcon,
  DatabaseIcon,
  FileTextIcon,
  ImageIcon,
  LoaderIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  StopCircleIcon,
  TableIcon,
  XCircleIcon,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type {
  StreamingToolPart,
  ToolExecutionProgress,
  ToolStreamingDisplayProps,
  ToolStreamingSession,
  ToolStreamingState,
} from '@/types/tool-streaming';

// Tool icon mapping
const TOOL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  createCodeArtifact: CodeIcon,
  createDocumentArtifact: FileTextIcon,
  createChartArtifact: BarChart3Icon,
  createSpreadsheetArtifact: TableIcon,
  createImageArtifact: ImageIcon,
  createDataArtifact: DatabaseIcon,
};

// State color mapping
const STATE_COLORS: Record<ToolStreamingState, string> = {
  idle: 'bg-gray-100 text-gray-800',
  'input-parsing': 'bg-blue-100 text-blue-800',
  'input-available': 'bg-green-100 text-green-800',
  'tool-executing': 'bg-yellow-100 text-yellow-800',
  'tool-progress': 'bg-yellow-100 text-yellow-800',
  'tool-complete': 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

// State icons
const STATE_ICONS: Record<
  ToolStreamingState,
  React.ComponentType<{ className?: string }>
> = {
  idle: ClockIcon,
  'input-parsing': LoaderIcon,
  'input-available': CheckCircleIcon,
  'tool-executing': LoaderIcon,
  'tool-progress': LoaderIcon,
  'tool-complete': CheckCircleIcon,
  error: XCircleIcon,
  cancelled: StopCircleIcon,
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

interface ToolPartDisplayProps {
  part: StreamingToolPart;
  isLatest: boolean;
}

function ToolPartDisplay({ part, isLatest }: ToolPartDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  const getPartIcon = () => {
    switch (part.type) {
      case 'input':
        return <CodeIcon className="h-4 w-4" />;
      case 'progress':
        return <LoaderIcon className="h-4 w-4" />;
      case 'output':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'error':
        return <XCircleIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  const getPartColor = () => {
    switch (part.type) {
      case 'input':
        return 'border-blue-200 bg-blue-50';
      case 'progress':
        return 'border-yellow-200 bg-yellow-50';
      case 'output':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between rounded-md border p-3 transition-colors hover:bg-gray-50',
          getPartColor()
        )}
      >
        <div className="flex items-center gap-2">
          {getPartIcon()}
          <span className="font-medium text-sm capitalize">{part.type}</span>
          <Badge className="text-xs" variant="outline">
            {new Date(part.timestamp).toLocaleTimeString()}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="pr-3 pb-3 pl-6">
          <pre className="max-h-40 overflow-x-auto rounded border bg-white p-2 text-xs">
            {JSON.stringify(part.data, null, 2)}
          </pre>
          {part.metadata && (
            <div className="mt-2 text-gray-500 text-xs">
              <strong>Metadata:</strong>
              <pre className="mt-1 overflow-x-auto rounded border bg-gray-100 p-2">
                {JSON.stringify(part.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ProgressDisplayProps {
  progress: ToolExecutionProgress | null;
  state: ToolStreamingState;
}

function ProgressDisplay({ progress, state }: ProgressDisplayProps) {
  if (!(progress || ['tool-executing', 'tool-progress'].includes(state))) {
    return null;
  }

  const currentProgress = progress?.progress ?? 0;
  const isAnimated = ['tool-executing', 'tool-progress'].includes(state);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {progress?.stage
            ? `${progress.stage.charAt(0).toUpperCase()}${progress.stage.slice(1)}`
            : 'Processing'}
        </span>
        <span className="text-gray-500">{currentProgress}%</span>
      </div>

      <Progress
        className={cn('h-2', isAnimated && 'animate-pulse')}
        value={currentProgress}
      />

      {progress?.message && (
        <p className="text-gray-600 text-xs">{progress.message}</p>
      )}

      {progress?.estimatedTimeRemaining && (
        <p className="text-gray-500 text-xs">
          Est. {formatDuration(progress.estimatedTimeRemaining)} remaining
        </p>
      )}
    </div>
  );
}

interface SessionMetadataProps {
  session: ToolStreamingSession;
}

function SessionMetadata({ session }: SessionMetadataProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const duration = session.metadata.endTime
    ? session.metadata.endTime - session.metadata.startTime
    : Date.now() - session.metadata.startTime;

  return (
    <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded p-2 text-gray-600 text-sm hover:bg-gray-50">
        <span>Session Details</span>
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="grid grid-cols-2 gap-4 p-2 text-xs">
          <div>
            <div className="font-medium text-gray-700">Execution ID</div>
            <div className="break-all font-mono text-gray-600">
              {session.id}
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-700">Duration</div>
            <div className="text-gray-600">{formatDuration(duration)}</div>
          </div>

          <div>
            <div className="font-medium text-gray-700">Input Size</div>
            <div className="text-gray-600">
              {formatBytes(session.metadata.inputSize)}
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-700">Output Size</div>
            <div className="text-gray-600">
              {formatBytes(session.metadata.outputSize)}
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-700">Cache Hit</div>
            <div className="text-gray-600">
              {session.metadata.cacheHit ? (
                <Badge className="text-xs" variant="secondary">
                  Yes
                </Badge>
              ) : (
                <Badge className="text-xs" variant="outline">
                  No
                </Badge>
              )}
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-700">Retries</div>
            <div className="text-gray-600">{session.metadata.retryCount}</div>
          </div>
        </div>

        {session.options && (
          <div className="mt-2 rounded bg-gray-50 p-2">
            <div className="mb-1 font-medium text-gray-700 text-xs">
              Options
            </div>
            <pre className="overflow-x-auto text-gray-600 text-xs">
              {JSON.stringify(session.options, null, 2)}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolStreamingDisplay({
  session,
  showProgress = true,
  showInput = true,
  showOutput = true,
  showMetadata = false,
  enableRetry = true,
  enableCancel = true,
  onRetry,
  onCancel,
  className,
}: ToolStreamingDisplayProps) {
  const [parts, setParts] = useState<StreamingToolPart[]>([]);

  // Mock parts for demonstration - in real usage these would come from the streaming hook
  useEffect(() => {
    if (session) {
      // Generate sample parts based on session state
      const sampleParts: StreamingToolPart[] = [];

      if (session.input) {
        sampleParts.push({
          id: 'input-1',
          type: 'input',
          toolName: session.toolName,
          executionId: session.id,
          timestamp: session.startTime + 1000,
          data: { stage: 'complete', input: session.input },
        });
      }

      if (session.progress) {
        sampleParts.push({
          id: 'progress-1',
          type: 'progress',
          toolName: session.toolName,
          executionId: session.id,
          timestamp: session.lastUpdateTime,
          data: session.progress,
        });
      }

      if (session.output) {
        sampleParts.push({
          id: 'output-1',
          type: 'output',
          toolName: session.toolName,
          executionId: session.id,
          timestamp: session.metadata.endTime || Date.now(),
          data: session.output,
        });
      }

      if (session.error) {
        sampleParts.push({
          id: 'error-1',
          type: 'error',
          toolName: session.toolName,
          executionId: session.id,
          timestamp: Date.now(),
          data: session.error,
        });
      }

      setParts(sampleParts);
    }
  }, [session]);

  if (!session) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-6 text-center text-gray-500">
          No active tool execution
        </CardContent>
      </Card>
    );
  }

  const ToolIcon = TOOL_ICONS[session.toolName] || CodeIcon;
  const StateIcon = STATE_ICONS[session.state];
  const isActive = [
    'input-parsing',
    'input-available',
    'tool-executing',
    'tool-progress',
  ].includes(session.state);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ToolIcon className="h-5 w-5 text-gray-600" />
            <div>
              <CardTitle className="text-base">{session.toolName}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge className={cn('text-xs', STATE_COLORS[session.state])}>
                  <StateIcon className="mr-1 h-3 w-3" />
                  {session.state.replace('-', ' ')}
                </Badge>
                {isActive && (
                  <LoaderIcon className="h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {enableRetry && onRetry && session.state === 'error' && (
              <Button onClick={onRetry} size="sm" variant="outline">
                <RefreshCwIcon className="mr-1 h-4 w-4" />
                Retry
              </Button>
            )}

            {enableCancel && onCancel && isActive && (
              <Button onClick={onCancel} size="sm" variant="outline">
                <StopCircleIcon className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Progress Display */}
        {showProgress && (
          <ProgressDisplay
            progress={session.progress ?? null}
            state={session.state}
          />
        )}

        {/* Error Display */}
        {session.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <XCircleIcon className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-800">Error</span>
              <Badge className="text-red-700 text-xs" variant="outline">
                {session.error.type}
              </Badge>
            </div>
            <p className="text-red-700 text-sm">{session.error.message}</p>
            {session.error.retryable && (
              <p className="mt-1 text-red-600 text-xs">
                This error is retryable ({session.error.retryCount} attempts so
                far)
              </p>
            )}
          </div>
        )}

        {/* Tool Parts Display */}
        {parts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700 text-sm">Execution Log</h4>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {parts
                .filter((part) => {
                  if (!showInput && part.type === 'input') return false;
                  if (!showOutput && part.type === 'output') return false;
                  return true;
                })
                .map((part, index) => (
                  <ToolPartDisplay
                    isLatest={index === parts.length - 1}
                    part={part}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Session Metadata */}
        {showMetadata && <SessionMetadata session={session} />}

        {/* Quick Stats */}
        <div className="flex items-center justify-between border-t pt-2 text-gray-500 text-xs">
          <span>
            Started {new Date(session.startTime).toLocaleTimeString()}
          </span>
          <span>ID: {session.id.split('_').pop()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for smaller spaces
export function ToolStreamingCompact({
  session,
  onRetry,
  onCancel,
  className,
}: Pick<
  ToolStreamingDisplayProps,
  'session' | 'onRetry' | 'onCancel' | 'className'
>) {
  if (!session) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-gray-500 text-sm',
          className
        )}
      >
        <ClockIcon className="h-4 w-4" />
        <span>No active execution</span>
      </div>
    );
  }

  const ToolIcon = TOOL_ICONS[session.toolName] || CodeIcon;
  const StateIcon = STATE_ICONS[session.state];
  const isActive = [
    'input-parsing',
    'input-available',
    'tool-executing',
    'tool-progress',
  ].includes(session.state);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border bg-white p-2',
        className
      )}
    >
      <ToolIcon className="h-4 w-4 text-gray-600" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">
            {session.toolName}
          </span>
          <Badge className={cn('text-xs', STATE_COLORS[session.state])}>
            <StateIcon className="mr-1 h-3 w-3" />
            {session.state.replace('-', ' ')}
          </Badge>
        </div>

        {session.progress && (
          <div className="mt-1">
            <Progress className="h-1" value={session.progress.progress} />
            <div className="mt-1 truncate text-gray-500 text-xs">
              {session.progress.message}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onRetry && session.state === 'error' && (
          <Button onClick={onRetry} size="sm" variant="ghost">
            <RefreshCwIcon className="h-3 w-3" />
          </Button>
        )}

        {onCancel && isActive && (
          <Button onClick={onCancel} size="sm" variant="ghost">
            <StopCircleIcon className="h-3 w-3" />
          </Button>
        )}

        {isActive && (
          <LoaderIcon className="h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
    </div>
  );
}

export default ToolStreamingDisplay;
