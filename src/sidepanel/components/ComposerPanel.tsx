import { Bot, Camera, FileText, LoaderCircle, Repeat2, Send, Sparkles, Type } from 'lucide-react';
import type { ContextAttachment, Settings } from '../../shared/models';
import { AttachmentCard } from './AttachmentCard';
import { primaryButtonClassName, subtleButtonClassName } from '../styles';

type ComposerPanelProps = {
  attachments: ContextAttachment[];
  draft: string;
  loading: boolean;
  autoAttachPage: boolean;
  automationMode: boolean;
  composerPlaceholder: string;
  contextError: string;
  error: string;
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onCaptureSelection: () => void;
  onCapturePage: () => void;
  onCaptureScreenshot: () => void;
  onToggleAutoAttachPage: (nextValue: boolean) => void;
  onToggleAutomationMode: (nextValue: boolean) => void;
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
  automationMode,
  composerPlaceholder,
  contextError,
  error,
  settings,
  translations: t,
  onCaptureSelection,
  onCapturePage,
  onCaptureScreenshot,
  onToggleAutoAttachPage,
  onToggleAutomationMode,
  onPreviewAttachment,
  onDeleteAttachment,
  onDraftChange,
  onSubmit,
}: ComposerPanelProps) {
  const hasAttachments = attachments.length > 0;
  const modeLabel = automationMode ? t.sidepanel.automationModeShort : t.sidepanel.chatModeShort;
  const modeIcon = automationMode ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />;

  return (
    <section className="z-10 shrink-0 rounded-[20px] border border-stone-200/70 bg-white p-2 shadow-md shadow-stone-900/6">
      <div className="flex flex-col gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <button
                className={`${subtleButtonClassName} h-8 w-8 rounded-lg px-0`}
                onClick={onCaptureSelection}
                aria-label={t.sidepanel.captureSelection}
                title={t.sidepanel.captureSelection}
              >
                <Type className="h-4.5 w-4.5" />
              </button>
              <div className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-1 py-1">
                <button
                  className={`${subtleButtonClassName} h-6.5 w-6.5 rounded-lg border-0 bg-transparent px-0 shadow-none hover:bg-white`}
                  onClick={onCapturePage}
                  aria-label={t.sidepanel.capturePage}
                  title={t.sidepanel.capturePage}
                >
                  <FileText className="h-4 w-4" />
                </button>
                <label
                  className="inline-flex h-6.5 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-1.5 text-[10px] font-medium text-stone-700"
                  aria-label={t.sidepanel.autoAttachPage}
                  title={t.sidepanel.autoAttachPage}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                    checked={autoAttachPage}
                    onChange={(event) => onToggleAutoAttachPage(event.target.checked)}
                  />
                  <span>{t.sidepanel.autoAttachPageShort}</span>
                </label>
              </div>
              <button
                className={`${subtleButtonClassName} h-8 w-8 rounded-lg px-0`}
                onClick={onCaptureScreenshot}
                aria-label={t.sidepanel.captureScreenshot}
                title={t.sidepanel.captureScreenshot}
              >
                <Camera className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {contextError ? (
            <div className="mt-1.5 rounded-[14px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[13px] text-rose-600">
              {contextError}
            </div>
          ) : null}

          {hasAttachments ? (
            <div className="mt-1.5 min-w-0 rounded-[18px] border border-stone-200 bg-stone-50/70">
              <div className="flex max-h-48 min-w-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto p-1.5">
                {attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    settings={settings}
                    openLabel={t.sidepanel.attachmentOpen}
                    deleteLabel={t.common.delete}
                    onOpen={onPreviewAttachment}
                    onDelete={(currentAttachment) => onDeleteAttachment(currentAttachment.id)}
                    className="min-w-0 w-full max-w-full cursor-pointer rounded-[16px] border border-stone-200 bg-white px-2.5 py-2 text-left text-[11px] text-stone-700 shadow-sm transition hover:bg-stone-50"
                    titleClassName="font-medium [overflow-wrap:anywhere]"
                    metaClassName="mt-0.5 text-[10px] leading-3.5 text-stone-500 [overflow-wrap:anywhere]"
                    deleteButtonClassName="inline-flex h-5 w-5 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-800"
                    bodyClassName="mt-1.5 line-clamp-3 min-w-0 w-full max-w-full whitespace-pre-wrap rounded-[12px] border border-stone-200 bg-stone-50 px-2 py-1.5 text-[11px] leading-4.5 text-stone-600 [overflow-wrap:anywhere]"
                    showBodyPreview
                    previewAlt={t.sidepanel.attachmentPreviewAlt}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-stone-200/70 pt-2">
          <div className="flex items-end gap-1.5">
            <textarea
              className="max-h-32 min-h-[72px] flex-1 resize-none overflow-y-auto rounded-[18px] border border-stone-200 bg-stone-50 px-2.5 py-2 text-[13px] leading-5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-300 focus:bg-white"
              placeholder={composerPlaceholder}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.ctrlKey && !loading && draft.trim()) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
            <button
              className={`${primaryButtonClassName} h-9 w-9 shrink-0 rounded-lg px-0`}
              disabled={loading || !draft.trim()}
              onClick={onSubmit}
              aria-label={t.sidepanel.send}
              title={t.sidepanel.send}
            >
              {loading ? <LoaderCircle className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-start">
            <div
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-1.5 py-0.5 text-[11px] font-medium text-stone-700"
            >
              <span className="px-1 text-stone-500">{t.sidepanel.currentMode}</span>
              <button
                type="button"
                className="group inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-inherit transition-colors hover:bg-stone-100"
                onClick={() => onToggleAutomationMode(!automationMode)}
                aria-label={t.sidepanel.automationMode}
                title={t.sidepanel.automationMode}
              >
                <span className="relative inline-flex h-4 w-4 items-center justify-center">
                  <span className="transition-opacity duration-150 group-hover:opacity-0">
                    {modeIcon}
                  </span>
                  <Repeat2 className="absolute h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </span>
                <span>{modeLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="mt-1.5 text-[13px] text-rose-600">{error}</div> : null}
    </section>
  );
}
