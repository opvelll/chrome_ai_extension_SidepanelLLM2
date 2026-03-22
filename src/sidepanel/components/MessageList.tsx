import { Trash2, X } from 'lucide-react';
import { attachmentSourceDetails } from '../../lib/attachments';
import { attachmentLabel } from '../../lib/i18n';
import type { ChatMessage, ContextAttachment, Settings } from '../../shared/models';
import { attachmentIcon, isAttachmentActivationKey } from '../utils/attachments';

type MessageListProps = {
  messages: ChatMessage[];
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onDeleteMessage: (messageId: string) => void;
  onDeleteAttachment: (messageId: string, attachmentId: string) => void;
  onPreviewAttachment: (attachment: ContextAttachment) => void;
};

export function MessageList({
  messages,
  settings,
  translations: t,
  onDeleteMessage,
  onDeleteAttachment,
  onPreviewAttachment,
}: MessageListProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto rounded-[20px] border border-stone-200/50 bg-white/78 p-2 shadow-inner shadow-stone-900/4 backdrop-blur-sm">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`message group ${message.role} max-w-[95%] rounded-[18px] px-2.5 py-2 shadow-sm ${
            message.role === 'user'
              ? 'self-end bg-teal-700 text-white shadow-teal-900/20'
              : 'border border-stone-200 bg-white text-stone-900 shadow-stone-900/5'
          }`}
        >
          <div className="mb-0.5 flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.content}</div>
              {message.role === 'assistant' && message.toolUsage?.webSearchUsed ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span
                    className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                    title={message.toolUsage.webSearchQueries?.join('\n') || undefined}
                  >
                    {t.sidepanel.webSearchUsed}
                  </span>
                </div>
              ) : null}
            </div>
            <button
              className={`inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 ${
                message.role === 'user'
                  ? 'text-white/60 hover:bg-white/10 hover:text-white focus:opacity-100'
                  : 'text-stone-400 hover:bg-stone-100 hover:text-rose-600 focus:opacity-100'
              }`}
              onClick={() => onDeleteMessage(message.id)}
              aria-label={t.common.delete}
              title={t.common.delete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {message.attachments?.length ? (
            <div className="mt-1.5 flex flex-col gap-1">
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className={`max-w-full cursor-pointer self-start rounded-[14px] border px-2 py-1.5 text-left text-[11px] transition ${
                    message.role === 'user'
                      ? 'border-white/15 bg-white/12'
                      : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                  }`}
                  onClick={() => onPreviewAttachment(attachment)}
                  onKeyDown={(event) => {
                    if (!isAttachmentActivationKey(event.key)) {
                      return;
                    }
                    event.preventDefault();
                    onPreviewAttachment(attachment);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.sidepanel.attachmentOpen}: ${attachmentLabel(attachment, settings)}`}
                  title={t.sidepanel.attachmentOpen}
                >
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5">{attachmentIcon(attachment)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="[overflow-wrap:anywhere]">{attachmentLabel(attachment, settings)}</div>
                      <div
                        className={`mt-0.5 text-[10px] leading-3.5 [overflow-wrap:anywhere] ${
                          message.role === 'user' ? 'text-white/70' : 'text-stone-500'
                        }`}
                      >
                        {attachmentSourceDetails(attachment.source).join(' / ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded-full transition ${
                        message.role === 'user'
                          ? 'text-white/60 hover:bg-white/10 hover:text-white'
                          : 'text-stone-400 hover:bg-stone-200 hover:text-rose-600'
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteAttachment(message.id, attachment.id);
                      }}
                      aria-label={t.common.delete}
                      title={t.common.delete}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ))}
      {messages.length === 0 ? <div className="m-auto h-full min-h-24" /> : null}
    </section>
  );
}
