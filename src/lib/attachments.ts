import type { ContextAttachment, TabSource } from '../shared/models';

function safeSourceTitle(source: TabSource): string {
  return source.title || 'Untitled page';
}

function safeSourceUrl(source: TabSource): string {
  return source.url || 'about:blank';
}

export function attachmentSourceSummary(source: TabSource): string {
  return safeSourceTitle(source);
}

export function attachmentSourceDetails(source: TabSource): string[] {
  return [
    `Title: ${safeSourceTitle(source)}`,
    `URL: ${safeSourceUrl(source)}`,
    `Hostname: ${source.hostname || '-'}`,
    `Path: ${source.pathname || '/'}`,
    `Captured at: ${source.capturedAt}`,
    `Tab ID: ${source.tabId ?? '-'}`,
  ];
}

export function attachmentPromptText(attachment: ContextAttachment): string {
  const sourceDetails = attachmentSourceDetails(attachment.source).join('\n');

  switch (attachment.kind) {
    case 'selectionText':
      return `Attachment type: Selected text\nSource details:\n${sourceDetails}\nContent:\n${attachment.text}`;
    case 'pageText':
      return `Attachment type: Page text\nSource details:\n${sourceDetails}\nContent:\n${attachment.text}`;
    case 'pageStructure':
      return `Attachment type: Page structure\nSource details:\n${sourceDetails}\nContent:\n${attachment.text}`;
    case 'screenshot':
      return `Attachment type: Screenshot\nSource details:\n${sourceDetails}\nContent: Screenshot image attached separately.`;
  }
}
