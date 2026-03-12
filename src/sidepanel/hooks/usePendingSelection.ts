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
      const response = await sendRuntimeMessage<{ attachment: ContextAttachment | null }>({
        type: 'context.consumePendingSelection',
      });

      if (!response.ok || !response.data.attachment) {
        return;
      }

      const pendingAttachment = response.data.attachment;

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
