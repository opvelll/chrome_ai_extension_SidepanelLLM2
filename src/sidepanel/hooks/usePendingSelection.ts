import { useEffect, useRef } from 'react';
import { sendRuntimeMessage } from '../../lib/runtime';
import type { ContextAttachment } from '../../shared/models';

type UsePendingSelectionParams = {
  setAttachments: React.Dispatch<React.SetStateAction<ContextAttachment[]>>;
};

export function usePendingSelection({ setAttachments }: UsePendingSelectionParams) {
  const didConsumePendingSelectionRef = useRef(false);

  function appendAttachment(nextAttachment: ContextAttachment) {
    console.log('[area-capture][sidepanel] appendAttachment start', {
      attachmentId: nextAttachment.id,
      kind: nextAttachment.kind,
      sourceUrl: nextAttachment.source.url,
      capturedAt: nextAttachment.source.capturedAt,
    });
    setAttachments((current) => {
      console.log('[area-capture][sidepanel] appendAttachment current', {
        count: current.length,
        ids: current.map((attachment) => attachment.id),
      });
      if (
        current.some(
          (attachment) =>
            attachment.kind === nextAttachment.kind &&
            attachment.source.url === nextAttachment.source.url &&
            attachment.source.capturedAt === nextAttachment.source.capturedAt,
        )
      ) {
        console.log('[area-capture][sidepanel] appendAttachment skipped duplicate', {
          attachmentId: nextAttachment.id,
        });
        return current;
      }

      const next = [...current, nextAttachment];
      console.log('[area-capture][sidepanel] appendAttachment next', {
        count: next.length,
        ids: next.map((attachment) => attachment.id),
      });
      return next;
    });
  }

  async function consumePendingAreaAttachment() {
    console.log('[area-capture][sidepanel] consumePendingAreaAttachment start');
    const pendingAttachmentResponse = await sendRuntimeMessage<{ attachment: ContextAttachment | null }>({
      type: 'context.consumePendingAttachment',
    });

    const pendingAttachment = pendingAttachmentResponse.ok
      ? pendingAttachmentResponse.data.attachment
      : null;

    console.log('[area-capture][sidepanel] consumePendingAreaAttachment response', {
      ok: pendingAttachmentResponse.ok,
      attachmentId: pendingAttachment?.id ?? null,
      kind: pendingAttachment?.kind ?? null,
    });

    if (!pendingAttachment) {
      return false;
    }

    appendAttachment(pendingAttachment);

    return true;
  }

  useEffect(() => {
    if (didConsumePendingSelectionRef.current) {
      return;
    }

    didConsumePendingSelectionRef.current = true;

    void (async () => {
      console.log('[area-capture][sidepanel] initial pending consume start');
      if (await consumePendingAreaAttachment()) {
        console.log('[area-capture][sidepanel] initial pending consume got area attachment');
        return;
      }

      const pendingResponse = await sendRuntimeMessage<{ attachment: ContextAttachment | null }>({
        type: 'context.consumePendingSelection',
      });

      if (!pendingResponse.ok) {
        return;
      }

      const selectionResponse = pendingResponse.data.attachment
        ? pendingResponse
        : await sendRuntimeMessage<{ attachment: ContextAttachment | null }>({
            type: 'context.getActiveSelection',
          });

      if (!selectionResponse.ok || !selectionResponse.data.attachment) {
        return;
      }

      const pendingSelectionAttachment = selectionResponse.data.attachment;

      setAttachments((current) => {
        if (
          current.some(
            (attachment) =>
              attachment.kind === 'selectionText' &&
              pendingSelectionAttachment.kind === 'selectionText' &&
              attachment.text === pendingSelectionAttachment.text &&
              attachment.source.url === pendingSelectionAttachment.source.url,
          )
        ) {
          return current;
        }

        return [...current, pendingSelectionAttachment];
      });
    })();
  }, [setAttachments]);

  useEffect(() => {
    function handlePendingAttachmentMessage(
      request: { type?: string; payload?: { attachment?: ContextAttachment } },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) {
      console.log('[area-capture][sidepanel] runtime message received', {
        type: request.type,
        attachmentId: request.payload?.attachment?.id ?? null,
      });
      if (request.type !== 'context.pendingAttachmentReady' || !request.payload?.attachment) {
        return;
      }

      appendAttachment(request.payload.attachment);
      sendResponse({ ok: true });
    }

    chrome.runtime.onMessage.addListener(handlePendingAttachmentMessage);
    return () => chrome.runtime.onMessage.removeListener(handlePendingAttachmentMessage);
  }, [setAttachments]);

  useEffect(() => {
    function handleStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      console.log('[area-capture][sidepanel] storage changed', {
        areaName,
        keys: Object.keys(changes),
      });
      if (areaName !== 'session' || !changes.pendingAttachments) {
        return;
      }

      void consumePendingAreaAttachment();
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [setAttachments]);
}
