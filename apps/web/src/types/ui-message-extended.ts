import type { UIMessage } from '@ai-sdk/react';
import type { FileAttachment } from './attachments';

export interface ExtendedUIMessage extends UIMessage {
  attachments?: FileAttachment[];
}

export function hasAttachments(
  message: UIMessage
): message is ExtendedUIMessage {
  return (
    'attachments' in message && Array.isArray((message as any).attachments)
  );
}
