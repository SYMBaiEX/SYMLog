'use client';

import {
  BarChart3,
  Code,
  FileText,
  Image,
  Maximize2,
  Table,
  X,
} from 'lucide-react';
import { memo, useState } from 'react';
import { ArtifactViewer } from '@/components/dynamic';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import type { Artifact } from '@/types/artifacts';

interface ArtifactPreviewProps {
  artifact: Artifact;
  className?: string;
}

function ArtifactPreviewComponent({
  artifact,
  className,
}: ArtifactPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const getPreviewContent = () => {
    switch (artifact.type) {
      case 'code':
      case 'react-component':
      case 'python-script':
      case 'sql-query': {
        const lines = artifact.content.split('\n').slice(0, 5);
        return (
          <pre className="overflow-hidden rounded-lg bg-black/40 p-3 text-xs">
            <code className="text-gray-300">
              {lines.join('\n')}
              {artifact.content.split('\n').length > 5 && '\n...'}
            </code>
          </pre>
        );
      }
      case 'document':
      case 'markdown': {
        const preview = artifact.content.slice(0, 200);
        return (
          <p className="line-clamp-3 text-gray-300 text-sm">
            {preview}
            {artifact.content.length > 200 && '...'}
          </p>
        );
      }
      case 'spreadsheet':
        return (
          <div className="text-gray-300 text-sm">
            <p>
              {artifact.data.length} rows × {artifact.columns.length} columns
            </p>
          </div>
        );
      case 'image':
        return (
          <div className="relative h-32 overflow-hidden rounded-lg bg-black/20">
            {artifact.url ? (
              <LazyImage
                alt={artifact.title}
                className="h-full w-full object-contain"
                src={artifact.url}
              />
            ) : artifact.base64 ? (
              <LazyImage
                alt={artifact.title}
                className="h-full w-full object-contain"
                src={`data:image/${artifact.format};base64,${artifact.base64}`}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                <Image className="h-8 w-8" />
              </div>
            )}
          </div>
        );
      case 'chart':
        return (
          <div className="text-gray-300 text-sm">
            <p className="capitalize">{artifact.chartType} chart</p>
          </div>
        );
      case 'json':
      case 'csv': {
        const dataPreview = artifact.content.slice(0, 150);
        return (
          <pre className="overflow-hidden rounded-lg bg-black/40 p-3 text-xs">
            <code className="text-gray-300">
              {dataPreview}
              {artifact.content.length > 150 && '...'}
            </code>
          </pre>
        );
      }
      default:
        return <p className="text-gray-500 text-sm">Preview not available</p>;
    }
  };

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="h-[90vh] w-full max-w-6xl">
          <ArtifactViewer
            artifact={artifact}
            editable
            fullscreen
            onClose={() => setIsExpanded(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <GlassCard
      className={cn('p-4 transition-colors hover:bg-white/5', className)}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <h4 className="font-medium">{artifact.title}</h4>
          <Badge className="text-xs" variant="secondary">
            {artifact.type}
          </Badge>
          {artifact.language && (
            <Badge className="text-xs" variant="outline">
              {artifact.language}
            </Badge>
          )}
        </div>
        <GlassButton
          className="h-7 w-7"
          onClick={() => setIsExpanded(true)}
          size="icon"
          variant="ghost"
        >
          <Maximize2 className="h-3 w-3" />
        </GlassButton>
      </div>

      <div className="space-y-2">{getPreviewContent()}</div>
    </GlassCard>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ArtifactPreview = memo(
  ArtifactPreviewComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.artifact.id === nextProps.artifact.id &&
      prevProps.artifact.content === nextProps.artifact.content &&
      prevProps.className === nextProps.className
    );
  }
);
