'use client';

import {
  AlertCircle,
  Code,
  Database,
  FileText,
  Image,
  Music,
  Paperclip,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { GlassButton } from '@/components/ui/glass-button';
import { GlassCard } from '@/components/ui/glass-card';
import { LazyImage } from '@/components/ui/lazy-image';
import { logError } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { generateSecureId } from '@/lib/utils/id-generator';
import type { FileAttachment } from '@/types/attachments';
import {
  getAttachmentType,
  isFileTypeSupported,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
} from '@/types/attachments';

interface FileUploadProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
}

export function FileUpload({
  attachments,
  onAttachmentsChange,
  disabled,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFileId = () => generateSecureId('file');

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

  const processFile = useCallback(
    async (file: File): Promise<FileAttachment | null> => {
      // Validate file type
      if (!isFileTypeSupported(file.type)) {
        toast.error(`File type ${file.type} is not supported`);
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `File ${file.name} is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`
        );
        return null;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const attachment: FileAttachment = {
          id: generateFileId(),
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
          uploadedAt: Date.now(),
        };

        // Generate preview for images
        if (file.type.startsWith('image/')) {
          attachment.preview = base64;
        }

        return attachment;
      } catch (error) {
        logError('FileUpload.processFile', error, {
          fileName: file.name,
          fileType: file.type,
        });
        toast.error(`Failed to process file ${file.name}`);
        return null;
      }
    },
    []
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (disabled) return;

      const fileArray = Array.from(files);

      // Check total file count
      if (attachments.length + fileArray.length > MAX_FILES_PER_MESSAGE) {
        toast.error(
          `Maximum ${MAX_FILES_PER_MESSAGE} files allowed per message`
        );
        return;
      }

      const processedFiles: FileAttachment[] = [];

      for (const file of fileArray) {
        const processed = await processFile(file);
        if (processed) {
          processedFiles.push(processed);
        }
      }

      if (processedFiles.length > 0) {
        onAttachmentsChange([...attachments, ...processedFiles]);
        toast.success(`Added ${processedFiles.length} file(s)`);
      }
    },
    [attachments, onAttachmentsChange, processFile, disabled]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files) {
      handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((att) => att.id !== id));
  };

  const openFileDialog = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* File Input */}
      <input
        accept="image/*,.pdf,.txt,.md,.csv,.json,.html,.css,.js,.ts,.py,.java,.cpp,.c,.cs,.go,.rs,.php,.rb,.swift,.kt"
        aria-label="Upload files"
        className="hidden"
        id="file-upload-input"
        multiple
        onChange={handleFileInput}
        ref={fileInputRef}
        type="file"
      />

      {/* Upload Button */}
      <GlassButton
        aria-describedby="file-upload-input"
        aria-label="Upload files"
        className="h-8 w-8"
        disabled={disabled}
        onClick={openFileDialog}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Paperclip className="h-4 w-4" />
      </GlassButton>

      {/* Drag & Drop Area (when dragging) */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <GlassCard className="border-2 border-periwinkle border-dashed p-8 text-center">
            <Upload className="mx-auto mb-4 h-12 w-12 text-periwinkle" />
            <h3 className="mb-2 font-semibold text-lg">Drop files here</h3>
            <p className="text-muted-foreground">
              Upload images, documents, and code files
            </p>
          </GlassCard>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.type);
            const isImage = attachment.type.startsWith('image/');

            return (
              <GlassCard className="p-3" key={attachment.id}>
                <div className="flex items-center gap-3">
                  {/* File Preview/Icon */}
                  <div className="flex-shrink-0">
                    {isImage && attachment.preview ? (
                      <LazyImage
                        alt={attachment.name}
                        className="h-10 w-10 rounded object-cover"
                        src={attachment.preview}
                      />
                    ) : (
                      <div className="glass flex h-10 w-10 items-center justify-center rounded">
                        <Icon className="h-5 w-5 text-periwinkle" />
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

                  {/* Remove Button */}
                  <GlassButton
                    className="h-6 w-6 text-red-400 hover:text-red-300"
                    onClick={() => removeAttachment(attachment.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                  </GlassButton>
                </div>
              </GlassCard>
            );
          })}

          {/* File Count Warning */}
          {attachments.length >= MAX_FILES_PER_MESSAGE && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <AlertCircle className="h-3 w-3" />
              Maximum {MAX_FILES_PER_MESSAGE} files per message
            </div>
          )}
        </div>
      )}
    </div>
  );
}
