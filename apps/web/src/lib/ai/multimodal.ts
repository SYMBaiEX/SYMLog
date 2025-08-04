import type { CoreMessage } from 'ai'
import type { FileAttachment } from '@/types/attachments'

export function processAttachmentsForAI(
  attachments: FileAttachment[],
  messageText: string
): { systemPrompt: string; messageContent: string } {
  if (!attachments || attachments.length === 0) {
    return { systemPrompt: '', messageContent: messageText }
  }

  let systemPrompt = '\n\nAttached files:'
  let messageContent = messageText

  attachments.forEach((attachment, index) => {
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
        messageContent += `\n\n[File: ${attachment.name}]\n\`\`\`\n${content}\n\`\`\``
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

export function addAttachmentsToMessage(
  message: CoreMessage,
  attachments: FileAttachment[]
): CoreMessage {
  if (!attachments || attachments.length === 0) {
    return message
  }

  const parts: any[] = []
  
  // Add text content if it exists
  if (typeof message.content === 'string' && message.content.trim()) {
    parts.push({ type: 'text', text: message.content })
  }

  // Add attachments
  attachments.forEach((attachment) => {
    if (attachment.type.startsWith('image/') && attachment.base64) {
      parts.push({
        type: 'image',
        image: attachment.base64
      })
    } else if (attachment.type.startsWith('text/') && attachment.base64) {
      try {
        const content = atob(attachment.base64.split(',')[1])
        parts.push({
          type: 'text',
          text: `File: ${attachment.name}\n\`\`\`\n${content}\n\`\`\``
        })
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