"use client"

import { useState, useRef, useCallback } from "react"
import type { FileAttachment } from "@/types/attachments"
import { MAX_FILE_SIZE, MAX_FILES_PER_MESSAGE, isFileTypeSupported, getAttachmentType } from "@/types/attachments"
import { GlassButton } from "@/components/ui/glass-button"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { LazyImage } from "@/components/ui/lazy-image"
import { 
  Paperclip, 
  X, 
  Image, 
  FileText, 
  Code, 
  Database, 
  Music, 
  Video,
  AlertCircle,
  Upload
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface FileUploadProps {
  attachments: FileAttachment[]
  onAttachmentsChange: (attachments: FileAttachment[]) => void
  disabled?: boolean
}

export function FileUpload({ attachments, onAttachmentsChange, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateFileId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const getFileIcon = (type: string) => {
    const attachmentType = getAttachmentType(type)
    switch (attachmentType) {
      case 'image': return Image
      case 'document': return FileText
      case 'code': return Code
      case 'data': return Database
      case 'audio': return Music
      case 'video': return Video
      default: return FileText
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const processFile = useCallback(async (file: File): Promise<FileAttachment | null> => {
    // Validate file type
    if (!isFileTypeSupported(file.type)) {
      toast.error(`File type ${file.type} is not supported`)
      return null
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File ${file.name} is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`)
      return null
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const attachment: FileAttachment = {
        id: generateFileId(),
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
        uploadedAt: Date.now()
      }

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        attachment.preview = base64
      }

      return attachment
    } catch (error) {
      console.error('Error processing file:', error)
      toast.error(`Failed to process file ${file.name}`)
      return null
    }
  }, [])

  const handleFiles = useCallback(async (files: FileList) => {
    if (disabled) return

    const fileArray = Array.from(files)
    
    // Check total file count
    if (attachments.length + fileArray.length > MAX_FILES_PER_MESSAGE) {
      toast.error(`Maximum ${MAX_FILES_PER_MESSAGE} files allowed per message`)
      return
    }

    const processedFiles: FileAttachment[] = []
    
    for (const file of fileArray) {
      const processed = await processFile(file)
      if (processed) {
        processedFiles.push(processed)
      }
    }

    if (processedFiles.length > 0) {
      onAttachmentsChange([...attachments, ...processedFiles])
      toast.success(`Added ${processedFiles.length} file(s)`)
    }
  }, [attachments, onAttachmentsChange, processFile, disabled])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      handleFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files) {
      handleFiles(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter(att => att.id !== id))
  }

  const openFileDialog = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-2">
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.csv,.json,.html,.css,.js,.ts,.py,.java,.cpp,.c,.cs,.go,.rs,.php,.rb,.swift,.kt"
        onChange={handleFileInput}
        className="hidden"
        aria-label="Upload files"
        id="file-upload-input"
      />

      {/* Upload Button */}
      <GlassButton
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={disabled}
        onClick={openFileDialog}
        aria-describedby="file-upload-input"
        aria-label="Upload files"
      >
        <Paperclip className="h-4 w-4" />
      </GlassButton>

      {/* Drag & Drop Area (when dragging) */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <GlassCard className="p-8 text-center border-2 border-dashed border-periwinkle">
            <Upload className="h-12 w-12 text-periwinkle mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Drop files here</h3>
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
            const Icon = getFileIcon(attachment.type)
            const isImage = attachment.type.startsWith('image/')
            
            return (
              <GlassCard key={attachment.id} className="p-3">
                <div className="flex items-center gap-3">
                  {/* File Preview/Icon */}
                  <div className="flex-shrink-0">
                    {isImage && attachment.preview ? (
                      <LazyImage
                        src={attachment.preview}
                        alt={attachment.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 glass rounded flex items-center justify-center">
                        <Icon className="h-5 w-5 text-periwinkle" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getAttachmentType(attachment.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </span>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <GlassButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-400 hover:text-red-300"
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </GlassButton>
                </div>
              </GlassCard>
            )
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
  )
}