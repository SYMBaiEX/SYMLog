"use client"

import type { FileAttachment } from "@/types/attachments"
import { getAttachmentType } from "@/types/attachments"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/glass-card"
import { 
  Image, 
  FileText, 
  Code, 
  Database, 
  Music, 
  Video,
  Download,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MessageAttachmentsProps {
  attachments: FileAttachment[]
  className?: string
}

export function MessageAttachments({ attachments, className }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) {
    return null
  }

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

  return (
    <div className={cn("space-y-2 mt-2", className)}>
      {attachments.map((attachment) => {
        const Icon = getFileIcon(attachment.type)
        const isImage = attachment.type.startsWith('image/')
        
        return (
          <GlassCard key={attachment.id} className="p-3 max-w-sm">
            <div className="flex items-center gap-3">
              {/* File Preview/Icon */}
              <div className="flex-shrink-0">
                {isImage && attachment.preview ? (
                  <div className="relative">
                    <img
                      src={attachment.preview}
                      alt={attachment.name}
                      className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        // Open image in new tab
                        if (attachment.base64) {
                          const win = window.open()
                          if (win) {
                            win.document.write(`
                              <html>
                                <head><title>${attachment.name}</title></head>
                                <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                  <img src="${attachment.base64}" alt="${attachment.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                                </body>
                              </html>
                            `)
                          }
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50 rounded">
                      <ExternalLink className="h-4 w-4 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 glass rounded flex items-center justify-center">
                    <Icon className="h-6 w-6 text-periwinkle" />
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

              {/* Download Button */}
              {attachment.base64 && (
                <button
                  onClick={() => {
                    // Create download link
                    const link = document.createElement('a')
                    link.href = attachment.base64!
                    link.download = attachment.name
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }}
                  className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                  title="Download file"
                >
                  <Download className="h-4 w-4 text-muted-foreground hover:text-white" />
                </button>
              )}
            </div>

            {/* Image Gallery Preview */}
            {isImage && attachment.preview && (
              <div className="mt-3">
                <img
                  src={attachment.preview}
                  alt={attachment.name}
                  className="w-full max-w-xs rounded border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    // Open image in new tab
                    if (attachment.base64) {
                      const win = window.open()
                      if (win) {
                        win.document.write(`
                          <html>
                            <head><title>${attachment.name}</title></head>
                            <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                              <img src="${attachment.base64}" alt="${attachment.name}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                            </body>
                          </html>
                        `)
                      }
                    }
                  }}
                />
              </div>
            )}
          </GlassCard>
        )
      })}
    </div>
  )
}