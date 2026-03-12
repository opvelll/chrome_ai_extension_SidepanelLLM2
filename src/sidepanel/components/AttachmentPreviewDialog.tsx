import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { attachmentSourceDetails, attachmentSourceSummary } from '../../lib/attachments';
import { attachmentLabel } from '../../lib/i18n';
import type { ContextAttachment, Settings } from '../../shared/models';
import { subtleButtonClassName } from '../styles';
import { attachmentBody } from '../utils/attachments';

type AttachmentPreviewDialogProps = {
  attachment: ContextAttachment | null;
  previewScale: number;
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onClose: () => void;
  onUpdateScale: (nextScale: number) => void;
};

export function AttachmentPreviewDialog({
  attachment,
  previewScale,
  settings,
  translations: t,
  onClose,
  onUpdateScale,
}: AttachmentPreviewDialogProps) {
  if (!attachment) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-stone-950/50 p-2 backdrop-blur-[2px]">
      <button className="absolute inset-0" aria-label={t.common.close} title={t.common.close} onClick={onClose} />
      <section
        className="relative z-10 flex max-h-[88vh] w-full max-w-[22rem] flex-col overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-2xl shadow-stone-950/20"
        role="dialog"
        aria-modal="true"
        aria-label={attachmentLabel(attachment, settings)}
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-stone-900">{attachmentLabel(attachment, settings)}</div>
            <div className="mt-1 line-clamp-2 text-[11px] text-stone-500">
              {attachmentSourceSummary(attachment.source)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {attachment.kind === 'screenshot' ? (
              <>
                <button
                  type="button"
                  className={`${subtleButtonClassName} h-8 w-8 rounded-xl px-0`}
                  onClick={() => onUpdateScale(previewScale - 0.25)}
                  aria-label={t.common.zoomOut}
                  title={t.common.zoomOut}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`${subtleButtonClassName} h-8 w-8 rounded-xl px-0`}
                  onClick={() => onUpdateScale(1)}
                  aria-label={t.common.reset}
                  title={t.common.reset}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`${subtleButtonClassName} h-8 w-8 rounded-xl px-0`}
                  onClick={() => onUpdateScale(previewScale + 0.25)}
                  aria-label={t.common.zoomIn}
                  title={t.common.zoomIn}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <button
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              onClick={onClose}
              aria-label={t.common.close}
              title={t.common.close}
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 whitespace-pre-wrap rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] leading-5 text-stone-600 [overflow-wrap:anywhere]">
            {attachmentSourceDetails(attachment.source).join('\n')}
          </div>
          {attachment.kind === 'screenshot' ? (
            <div className="overflow-auto rounded-[18px] border border-stone-200 bg-stone-100 p-2">
              <img
                className="max-h-none max-w-none rounded-[12px] object-contain"
                src={attachment.imageDataUrl}
                alt={t.sidepanel.attachmentPreviewAlt}
                style={{
                  width: `${previewScale * 100}%`,
                  minWidth: `${previewScale * 100}%`,
                }}
              />
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm leading-6 text-stone-700 [overflow-wrap:anywhere]">
              {attachmentBody(attachment)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
