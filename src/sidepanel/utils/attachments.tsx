import { FileText, Image as ImageIcon, Type } from 'lucide-react';
import type { ContextAttachment } from '../../shared/models';

export function attachmentIcon(attachment: ContextAttachment) {
  switch (attachment.kind) {
    case 'selectionText':
      return <Type className="h-4.5 w-4.5" />;
    case 'pageText':
    case 'pageStructure':
      return <FileText className="h-4.5 w-4.5" />;
    case 'screenshot':
      return <ImageIcon className="h-4.5 w-4.5" />;
  }
}

export function attachmentBody(attachment: ContextAttachment) {
  return attachment.kind === 'screenshot' ? '' : attachment.text;
}

export function isAttachmentActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}
