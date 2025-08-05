'use client';

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DataArtifact } from '@/types/artifacts';

interface DataViewerProps {
  artifact: DataArtifact;
  className?: string;
}

export function DataViewer({ artifact, className }: DataViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const parsedData = useMemo(() => {
    try {
      if (artifact.type === 'json') {
        return JSON.parse(artifact.content);
      }
      if (artifact.type === 'csv') {
        // Simple CSV parser
        const lines = artifact.content.trim().split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());
        const data = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          return headers.reduce(
            (obj, header, index) => {
              obj[header] = values[index];
              return obj;
            },
            {} as Record<string, string>
          );
        });
        return data;
      }
      return null;
    } catch (error) {
      console.error('Failed to parse data:', error);
      return null;
    }
  }, [artifact.content, artifact.type]);

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderValue = (
    value: any,
    path = '',
    depth = 0
  ): React.ReactElement => {
    if (value === null) {
      return <span className="text-gray-500">null</span>;
    }

    if (value === undefined) {
      return <span className="text-gray-500">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-blue-400">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-green-400">{value}</span>;
    }

    if (typeof value === 'string') {
      // Sanitize search term to prevent XSS and regex injection
      const sanitizedSearchTerm = searchTerm
        ? searchTerm.replace(/[^a-zA-Z0-9\s.,!?-]/g, '')
        : '';

      const highlighted = sanitizedSearchTerm
        ? value.replace(
            new RegExp(
              `(${sanitizedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
              'gi'
            ),
            '<mark class="bg-yellow-400/30 text-yellow-300">$1</mark>'
          )
        : value;
      return (
        <span
          className="text-orange-400"
          dangerouslySetInnerHTML={{ __html: `&quot;${highlighted}&quot;` }}
        />
      );
    }

    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      return (
        <div className="inline-block">
          <button
            className="-ml-1 inline-flex items-center rounded px-1 hover:bg-white/5"
            onClick={() => togglePath(path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="ml-1 text-gray-400">[{value.length}]</span>
          </button>
          {isExpanded && (
            <div className="mt-1 ml-4">
              {value.map((item, index) => (
                <div className="my-1" key={index}>
                  <span className="mr-2 text-gray-500">{index}:</span>
                  {renderValue(item, `${path}[${index}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const isExpanded = expandedPaths.has(path);
      const keys = Object.keys(value);
      return (
        <div className="inline-block">
          <button
            className="-ml-1 inline-flex items-center rounded px-1 hover:bg-white/5"
            onClick={() => togglePath(path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="ml-1 text-gray-400">
              {'{'}
              {!isExpanded && keys.length > 0 && '...'}
              {!isExpanded && '}'}
            </span>
          </button>
          {isExpanded && (
            <>
              <div className="mt-1 ml-4">
                {keys.map((key) => (
                  <div className="my-1" key={key}>
                    <span className="text-purple-400">&quot;{key}&quot;</span>
                    <span className="mx-1 text-gray-400">:</span>
                    {renderValue(value[key], `${path}.${key}`, depth + 1)}
                  </div>
                ))}
              </div>
              <div className="text-gray-400">{'}'}</div>
            </>
          )}
        </div>
      );
    }

    return <span className="text-gray-400">{String(value)}</span>;
  };

  const handleCopy = async () => {
    try {
      const formatted =
        artifact.type === 'json'
          ? JSON.stringify(parsedData, null, 2)
          : artifact.content;
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], {
      type: artifact.type === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title}.${artifact.type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 border-white/10 border-b p-4">
        <div className="relative max-w-sm flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
          <Input
            className="bg-black/20 pl-9"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            value={searchTerm}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge className="text-xs" variant="secondary">
            {artifact.type.toUpperCase()}
          </Badge>
          <GlassButton
            className="h-8 w-8"
            onClick={handleCopy}
            size="icon"
            variant="ghost"
          >
            {copied ? (
              <Copy className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </GlassButton>
          <GlassButton
            className="h-8 w-8"
            onClick={handleDownload}
            size="icon"
            variant="ghost"
          >
            <Download className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 overflow-auto p-4 font-mono text-sm">
        {parsedData ? (
          renderValue(parsedData)
        ) : (
          <pre className="whitespace-pre-wrap">{artifact.content}</pre>
        )}
      </div>
    </div>
  );
}
