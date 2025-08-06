'use client';

import {
  Code,
  Database,
  Download,
  ExternalLink,
  FileText,
  Image,
  Music,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import type { FileAttachment } from '@/types/attachments';
import { getAttachmentType } from '@/types/attachments';

interface MessageAttachmentsProps {
  attachments: FileAttachment[];
  className?: string;
}

export function MessageAttachments({
  attachments,
  className,
}: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const getFileIcon = (type: string) => {
    const attachmentType = getAttachmentType(type);
    switch (attachmentType) {
      case 'image':
        return Image;
      case 'document':
        return FileText;
      case 'code':
        return Code;
      case 'data':
        return Database;
      case 'audio':
        return Music;
      case 'video':
        return Video;
      default:
        return FileText;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('mt-2 space-y-2', className)}>
      {attachments.map((attachment) => {
        const Icon = getFileIcon(attachment.type);
        const isImage = attachment.type.startsWith('image/');

        return (
          <GlassCard className="max-w-sm p-3" key={attachment.id}>
            <div className="flex items-center gap-3">
              {/* File Preview/Icon */}
              <div className="flex-shrink-0">
                {isImage && attachment.preview ? (
                  <div className="relative">
                    <LazyImage
                      alt={attachment.name}
                      className="h-12 w-12 cursor-pointer rounded object-cover transition-opacity hover:opacity-80"
                      onClick={() => {
                        // Open image in new tab
                        if (attachment.base64) {
                          const win = window.open();
                          if (win) {
                            win.document.write(`
                              <html>
                                <head><title>${attachment.name}</title></head>
                                <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                  <img src="${attachment.base64}" alt="${attachment.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                                </body>
                              </html>
                            `);
                          }
                        }
                      }}
                      src={attachment.preview}
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                      <ExternalLink className="h-4 w-4 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="glass flex h-12 w-12 items-center justify-center rounded">
                    <Icon className="h-6 w-6 text-periwinkle" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">
                  {attachment.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className="text-xs" variant="outline">
                    {getAttachmentType(attachment.type)}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
              </div>

              {/* Download Button */}
              {attachment.base64 && (
                <button
                  className="flex-shrink-0 rounded p-1 transition-colors hover:bg-white/10"
                  onClick={() => {
                    // Create download link
                    const link = document.createElement('a');
                    link.href = attachment.base64!;
                    link.download = attachment.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  title="Download file"
                >
                  <Download className="h-4 w-4 text-muted-foreground hover:text-white" />
                </button>
              )}
            </div>

            {/* Image Gallery Preview */}
            {isImage && attachment.preview && (
              <div className="mt-3">
                <LazyImage
                  alt={attachment.name}
                  className="w-full max-w-xs cursor-pointer rounded border border-white/10 transition-opacity hover:opacity-80"
                  onClick={() => {
                    // Open image in new tab
                    if (attachment.base64) {
                      const win = window.open();
                      if (win) {
                        win.document.write(`
                          <html>
                            <head><title>${attachment.name}</title></head>
                            <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                              <img src="${attachment.base64}" alt="${attachment.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                            </body>
                          </html>
                        `);
                      }
                    }
                  }}
                  src={attachment.preview}
                />
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
