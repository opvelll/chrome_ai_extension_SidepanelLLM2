import { useEffect, useState } from 'react';
import type { ContextAttachment } from '../../shared/models';

export function useAttachmentPreview() {
  const [previewAttachment, setPreviewAttachment] = useState<ContextAttachment | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (!previewAttachment) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewAttachment(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAttachment]);

  useEffect(() => {
    setPreviewScale(1);
  }, [previewAttachment]);

  function updatePreviewScale(nextScale: number) {
    setPreviewScale(Math.min(3, Math.max(0.5, Number(nextScale.toFixed(2)))));
  }

  return {
    previewAttachment,
    previewScale,
    setPreviewAttachment,
    updatePreviewScale,
  };
}
