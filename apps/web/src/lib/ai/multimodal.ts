import type { CoreMessage } from 'ai'
import type { FileAttachment } from '@/types/attachments'
import { validateAttachments, scanForMaliciousContent } from '@/lib/security/attachment-validator'

export async function processAttachmentsForAI(
  attachments: FileAttachment[],
  messageText: string,
  userId?: string
): Promise<{ systemPrompt: string; messageContent: string; error?: string }> {
  if (!attachments || attachments.length === 0) {
    return { systemPrompt: '', messageContent: messageText }
  }

  // Validate attachments first
  const validation = await validateAttachments(attachments, userId)
  if (!validation.valid) {
    return {
      systemPrompt: '',
      messageContent: messageText,
      error: validation.error
    }
  }

  const safeAttachments = validation.sanitizedAttachments!

  let systemPrompt = '\n\nAttached files:'
  let messageContent = messageText

  safeAttachments.forEach((attachment, index) => {
    const attachmentInfo = `
File ${index + 1}: ${attachment.name} (${attachment.type}, ${Math.round(attachment.size / 1024)}KB)`

    systemPrompt += attachmentInfo

    // For images, include base64 data
    if (attachment.type.startsWith('image/') && attachment.base64) {
      messageContent += `\n\n[Image: ${attachment.name}]\n${attachment.base64}`
    }
    
    // For text files, try to extract content
    else if (attachment.type.startsWith('text/') && attachment.base64) {
      try {
        const content = atob(attachment.base64.split(',')[1])
        
        // Scan for malicious content
        const scanResult = scanForMaliciousContent(content, attachment.type)
        if (!scanResult.safe) {
          messageContent += `\n\n[File: ${attachment.name} - Blocked: ${scanResult.reason}]`
        } else {
          messageContent += `\n\n[File: ${attachment.name}]\n\`\`\`\n${content}\n\`\`\``
        }
      } catch (error) {
        messageContent += `\n\n[File: ${attachment.name} - Unable to read content]`
      }
    }
    
    // For other file types, just mention them
    else {
      messageContent += `\n\n[Attached: ${attachment.name}]`
    }
  })

  return { systemPrompt, messageContent }
}

export async function addAttachmentsToMessage(
  message: CoreMessage,
  attachments: FileAttachment[],
  userId?: string
): Promise<CoreMessage> {
  if (!attachments || attachments.length === 0) {
    return message
  }

  // Validate attachments first
  const validation = await validateAttachments(attachments, userId)
  if (!validation.valid) {
    // Return message with error notification
    return {
      ...message,
      content: `${message.content}\n\n[Attachment Error: ${validation.error}]`
    }
  }

  const safeAttachments = validation.sanitizedAttachments!

  const parts: any[] = []
  
  // Add text content if it exists
  if (typeof message.content === 'string' && message.content.trim()) {
    parts.push({ type: 'text', text: message.content })
  }

  // Add attachments
  safeAttachments.forEach((attachment) => {
    if (attachment.type.startsWith('image/') && attachment.base64) {
      parts.push({
        type: 'image',
        image: attachment.base64
      })
    } else if (attachment.type.startsWith('text/') && attachment.base64) {
      try {
        const content = atob(attachment.base64.split(',')[1])
        
        // Scan for malicious content
        const scanResult = scanForMaliciousContent(content, attachment.type)
        if (!scanResult.safe) {
          parts.push({
            type: 'text',
            text: `File: ${attachment.name} (Blocked: ${scanResult.reason})`
          })
        } else {
          parts.push({
            type: 'text',
            text: `File: ${attachment.name}\n\`\`\`\n${content}\n\`\`\``
          })
        }
      } catch (error) {
        parts.push({
          type: 'text',
          text: `File: ${attachment.name} (Unable to read content)`
        })
      }
    } else {
      parts.push({
        type: 'text',
        text: `Attached file: ${attachment.name} (${attachment.type})`
      })
    }
  })

  return {
    ...message,
    content: parts.length === 1 ? parts[0].text || parts[0].image : parts
  }
}

export function createImageDataURL(base64Data: string, mimeType: string): string {
  // If already a data URL, return as is
  if (base64Data.startsWith('data:')) {
    return base64Data
  }
  
  // Create data URL
  return `data:${mimeType};base64,${base64Data}`
}