import { useEffect, useRef } from 'react';
import { sendRuntimeMessage } from '../../lib/runtime';
import type { ContextAttachment } from '../../shared/models';

type UsePendingSelectionParams = {
  setAttachments: React.Dispatch<React.SetStateAction<ContextAttachment[]>>;
};

export function usePendingSelection({ setAttachments }: UsePendingSelectionParams) {
  const didConsumePendingSelectionRef = useRef(false);

  useEffect(() => {
    if (didConsumePendingSelectionRef.current) {
      return;
    }

    didConsumePendingSelectionRef.current = true;

    void (async () => {
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

      const pendingAttachment = selectionResponse.data.attachment;

      setAttachments((current) => {
        if (
          current.some(
            (attachment) =>
              attachment.kind === 'selectionText' &&
              pendingAttachment.kind === 'selectionText' &&
              attachment.text === pendingAttachment.text &&
              attachment.source.url === pendingAttachment.source.url,
          )
        ) {
          return current;
        }

        return [...current, pendingAttachment];
      });
    })();
  }, [setAttachments]);
}
