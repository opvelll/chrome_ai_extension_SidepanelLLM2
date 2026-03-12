import { Camera, FileText, LoaderCircle, Send, Type } from 'lucide-react';
import type { ContextAttachment, Settings } from '../../shared/models';
import { AttachmentCard } from './AttachmentCard';
import { primaryButtonClassName, subtleButtonClassName } from '../styles';

type ComposerPanelProps = {
  attachments: ContextAttachment[];
  draft: string;
  loading: boolean;
  autoAttachPage: boolean;
  composerPlaceholder: string;
  contextError: string;
  error: string;
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onCaptureSelection: () => void;
  onCapturePage: () => void;
  onCaptureScreenshot: () => void;
  onToggleAutoAttachPage: (nextValue: boolean) => void;
  onPreviewAttachment: (attachment: ContextAttachment) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onDraftChange: (nextValue: string) => void;
  onSubmit: () => void;
};

export function ComposerPanel({
  attachments,
  draft,
  loading,
  autoAttachPage,
  composerPlaceholder,
  contextError,
  error,
  settings,
  translations: t,
  onCaptureSelection,
  onCapturePage,
  onCaptureScreenshot,
  onToggleAutoAttachPage,
  onPreviewAttachment,
  onDeleteAttachment,
  onDraftChange,
  onSubmit,
}: ComposerPanelProps) {
  return (
    <section className="rounded-[24px] border border-stone-200/70 bg-white/92 p-2.5 shadow-md shadow-stone-900/6 backdrop-blur-xl">
      <div className="flex flex-col gap-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
              onClick={onCaptureSelection}
              aria-label={t.sidepanel.captureSelection}
              title={t.sidepanel.captureSelection}
            >
              <Type className="h-5 w-5" />
            </button>
            <button
              className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
              onClick={onCapturePage}
              aria-label={t.sidepanel.capturePage}
              title={t.sidepanel.capturePage}
            >
              <FileText className="h-5 w-5" />
            </button>
            <button
              className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
              onClick={onCaptureScreenshot}
              aria-label={t.sidepanel.captureScreenshot}
              title={t.sidepanel.captureScreenshot}
            >
              <Camera className="h-5 w-5" />
            </button>
            <label
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 text-[11px] font-medium text-stone-700 transition hover:border-teal-200 hover:bg-teal-50/50"
              aria-label={t.sidepanel.autoAttachPage}
              title={t.sidepanel.autoAttachPage}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                checked={autoAttachPage}
                onChange={(event) => onToggleAutoAttachPage(event.target.checked)}
              />
              <span>{t.sidepanel.autoAttachPageShort}</span>
            </label>
          </div>

          {contextError ? (
            <div className="mt-2 rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {contextError}
            </div>
          ) : null}

          <div className="mt-2 min-w-0 rounded-[20px] border border-stone-200 bg-stone-50/70">
            {attachments.length === 0 ? (
              <div className="px-3 py-3 text-xs text-stone-500">{t.sidepanel.attachedItems}</div>
            ) : (
              <div className="flex max-h-56 min-w-0 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
                {attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    settings={settings}
                    openLabel={t.sidepanel.attachmentOpen}
                    deleteLabel={t.common.delete}
                    onOpen={onPreviewAttachment}
                    onDelete={(currentAttachment) => onDeleteAttachment(currentAttachment.id)}
                    className="min-w-0 w-full max-w-full cursor-pointer rounded-[18px] border border-stone-200 bg-white px-3 py-2.5 text-left text-xs text-stone-700 shadow-sm transition hover:bg-stone-50"
                    titleClassName="font-medium [overflow-wrap:anywhere]"
                    metaClassName="mt-1 text-[10px] leading-4 text-stone-500 [overflow-wrap:anywhere]"
                    deleteButtonClassName="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-800"
                    bodyClassName="mt-2 line-clamp-3 min-w-0 w-full max-w-full whitespace-pre-wrap rounded-[14px] border border-stone-200 bg-stone-50 px-2.5 py-2 text-xs leading-5 text-stone-600 [overflow-wrap:anywhere]"
                    showBodyPreview
                    previewAlt={t.sidepanel.attachmentPreviewAlt}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-stone-200/70 pt-2.5">
          <div className="flex items-end gap-2">
            <textarea
              className="max-h-36 min-h-[92px] flex-1 resize-none overflow-y-auto rounded-[20px] border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm leading-5.5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-300 focus:bg-white"
              placeholder={composerPlaceholder}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
            />
            <button
              className={`${primaryButtonClassName} h-10 w-10 shrink-0 rounded-xl px-0`}
              disabled={loading || !draft.trim()}
              onClick={onSubmit}
              aria-label={t.sidepanel.send}
              title={t.sidepanel.send}
            >
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="mt-2 text-sm text-rose-600">{error}</div> : null}
    </section>
  );
}
