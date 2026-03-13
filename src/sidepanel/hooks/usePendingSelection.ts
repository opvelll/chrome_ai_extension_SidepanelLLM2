import { useEffect, useRef } from 'react';
import { sendRuntimeMessage } from '../../lib/runtime';
import type { ContextAttachment } from '../../shared/models';

type UsePendingSelectionParams = {
  setAttachments: React.Dispatch<React.SetStateAction<ContextAttachment[]>>;
};

export function usePendingSelection({ setAttachments }: UsePendingSelectionParams) {
  const didConsumePendingSelectionRef = useRef(false);

  function appendAttachment(nextAttachment: ContextAttachment) {
    setAttachments((current) => {
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
    });
  }

  async function consumePendingAreaAttachment() {
    const pendingAttachmentResponse = await sendRuntimeMessage<{ attachment: ContextAttachment | null }>({
      type: 'context.consumePendingAttachment',
    });

    const pendingAttachment = pendingAttachmentResponse.ok
      ? pendingAttachmentResponse.data.attachment
      : null;

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
      if (await consumePendingAreaAttachment()) {
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
      if (areaName !== 'session' || !changes.pendingAttachments) {
        return;
      }

      void consumePendingAreaAttachment();
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [setAttachments]);
}
