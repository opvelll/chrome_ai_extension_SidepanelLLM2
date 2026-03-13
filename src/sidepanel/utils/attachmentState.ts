import type { ContextAttachment } from '../../shared/models';

export function appendDraftAttachment(
  current: ContextAttachment[],
  nextAttachment: ContextAttachment,
): ContextAttachment[] {
  if (
    current.some(
      (attachment) =>
        attachment.kind === nextAttachment.kind &&
        attachment.source.url === nextAttachment.source.url &&
        attachment.source.capturedAt === nextAttachment.source.capturedAt,
    )
  ) {
    return current;
  }

  return [...current, nextAttachment];
}

export function appendSelectionAttachment(
  current: ContextAttachment[],
  nextAttachment: ContextAttachment,
): ContextAttachment[] {
  if (
    nextAttachment.kind === 'selectionText' &&
    current.some(
      (attachment) =>
        attachment.kind === 'selectionText' &&
        attachment.text === nextAttachment.text &&
        attachment.source.url === nextAttachment.source.url,
    )
  ) {
    return current;
  }

  return appendDraftAttachment(current, nextAttachment);
}

export function removeDraftAttachment(current: ContextAttachment[], attachmentId: string) {
  return current.filter((attachment) => attachment.id !== attachmentId);
}

export function hasPageTextAttachment(attachments: ContextAttachment[]) {
  return attachments.some((attachment) => attachment.kind === 'pageText');
}
