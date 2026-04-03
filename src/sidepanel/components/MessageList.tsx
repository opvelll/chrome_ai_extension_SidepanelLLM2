import { ChevronRight, Info, Search, TerminalSquare, Trash2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { attachmentSourceDetails } from '../../lib/attachments';
import { attachmentLabel } from '../../lib/i18n';
import type { ChatMessage, ContextAttachment, Settings } from '../../shared/models';
import { attachmentIcon, isAttachmentActivationKey } from '../utils/attachments';
import { groupMessagesForDisplay } from '../utils/messageGroups';

type MessageListProps = {
  messages: ChatMessage[];
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  scrollTargetMessageId: string;
  onScrollTargetHandled: () => void;
  onDeleteMessage: (messageId: string) => void;
  onDeleteAttachment: (messageId: string, attachmentId: string) => void;
  onPreviewAttachment: (attachment: ContextAttachment) => void;
};

export function MessageList({
  messages,
  settings,
  translations: t,
  scrollTargetMessageId,
  onScrollTargetHandled,
  onDeleteMessage,
  onDeleteAttachment,
  onPreviewAttachment,
}: MessageListProps) {
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});
  const groups = groupMessagesForDisplay(messages);

  useEffect(() => {
    if (!scrollTargetMessageId) {
      return;
    }

    const target = messageRefs.current[scrollTargetMessageId];
    if (!target) {
      return;
    }

    if (target instanceof HTMLDetailsElement) {
      target.open = true;
    }

    target.scrollIntoView({ block: 'start', behavior: 'auto' });
    onScrollTargetHandled();
  }, [groups, onScrollTargetHandled, scrollTargetMessageId]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto rounded-[20px] border border-stone-200/50 bg-white/78 p-2 shadow-inner shadow-stone-900/4 backdrop-blur-sm">
      {groups.map((group) => {
        if (group.type === 'log-group') {
          const firstLogLabel = group.messages[0]?.log?.summary || group.messages[0]?.log?.title;
          return (
            <details
              key={group.key}
              ref={(element) => {
                for (const message of group.messages) {
                  messageRefs.current[message.id] = element;
                }
              }}
              className="message log group/logs max-w-full self-stretch overflow-hidden rounded-[16px] border border-stone-200 bg-stone-50/80 text-stone-800 shadow-sm"
            >
              <summary className="group/summary flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[11px] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-stone-500 group-hover/summary:hidden group-open/logs:hidden">
                  <TerminalSquare className="h-3.5 w-3.5" />
                </span>
                <span className="hidden h-5 w-5 shrink-0 items-center justify-center text-stone-400 group-hover/summary:inline-flex group-open/logs:inline-flex">
                  <ChevronRight className="h-3.5 w-3.5 transition group-open/logs:rotate-90" />
                </span>
                <div className="min-w-0 flex-1 truncate font-medium text-stone-600">
                  <span className="font-semibold text-stone-700">{group.messages.length}</span>
                  {firstLogLabel ? <span className="ml-1.5 truncate text-stone-500">{firstLogLabel}</span> : null}
                </div>
              </summary>
              <div className="border-t border-stone-200 px-2 py-2">
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {group.messages.map((message, index) => (
                    <details
                      key={message.id}
                      ref={(element) => {
                        messageRefs.current[message.id] = element;
                      }}
                      className={`group/item rounded-[12px] border text-[11px] shadow-sm ${getLogTone(message).container}`}
                      open
                    >
                      <summary className="group/item-summary flex cursor-pointer list-none items-start gap-2 px-2 py-1.5 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-[22px] pt-0.5 text-[10px] font-medium text-current/55">{index + 1}</span>
                        <span className="mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center text-current/70 group-hover/item-summary:hidden group-open/item:hidden">
                          {logIcon(message)}
                        </span>
                        <span className="mt-0.5 hidden h-4.5 w-4.5 shrink-0 items-center justify-center text-current/55 group-hover/item-summary:inline-flex group-open/item:inline-flex">
                          <ChevronRight className="h-3.5 w-3.5 transition group-open/item:rotate-90" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <div className="shrink-0 font-semibold">{message.log?.title}</div>
                            <div className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${getLogTone(message).summary}`}>
                              {message.log?.summary || message.content}
                            </div>
                          </div>
                        </div>
                      </summary>
                      {message.log?.body || message.log?.details?.length ? (
                        <div className="ml-[30px] mt-1.5 space-y-1.5 border-t border-current/10 px-2 pb-1.5 pt-1.5">
                          {message.log.body ? (
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[10px] bg-black/[0.04] px-2 py-1.5 font-mono text-[10px] leading-4">
                              {message.log.body}
                            </pre>
                          ) : null}
                          {message.log.details?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {message.log.details.map((detail) => (
                                <div
                                  key={`${detail.label}:${detail.value}`}
                                  className="rounded-full bg-black/[0.04] px-2 py-1 text-[10px] leading-4"
                                  title={detail.value}
                                >
                                  <span className="font-medium">{detail.label}</span>
                                  <span className="text-current/60">: </span>
                                  <span className="whitespace-pre-wrap break-words">{detail.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </details>
                  ))}
                </div>
              </div>
            </details>
          );
        }

        const { message } = group;
        return (
          <article
            key={group.key}
            ref={(element) => {
              messageRefs.current[message.id] = element;
            }}
            className={`message group ${message.role} max-w-[95%] rounded-[18px] px-2.5 py-2 shadow-sm ${
              message.role === 'user'
                ? 'self-end bg-teal-700 text-white shadow-teal-900/20'
                : 'border border-stone-200 bg-white text-stone-900 shadow-stone-900/5'
            }`}
          >
            <div className="mb-0.5 flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                {message.role === 'assistant' ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.content}</div>
                )}
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
        );
      })}
      {messages.length === 0 ? <div className="m-auto h-full min-h-24" /> : null}
    </section>
  );
}

function getLogTone(message: ChatMessage) {
  return {
    container: 'border-stone-200 bg-white text-stone-800',
    icon: 'text-stone-500',
    chevron: 'text-stone-500',
    summary: 'text-stone-500',
  };
}

function logIcon(message: ChatMessage) {
  if (message.log?.level === 'error') {
    return <TriangleAlert className="h-3.5 w-3.5" />;
  }

  if (message.log?.category === 'tool' || message.log?.category === 'result') {
    if (message.log.title.toLowerCase().includes('search')) {
      return <Search className="h-3.5 w-3.5" />;
    }

    return <TerminalSquare className="h-3.5 w-3.5" />;
  }

  return <Info className="h-3.5 w-3.5" />;
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="min-w-0 text-[13px] leading-5 text-inherit [&_a]:text-teal-700 [&_a]:underline [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-1 [&_p]:my-0 [&_p+*]:mt-2 [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[12px] [&_pre]:bg-stone-900 [&_pre]:p-2 [&_pre]:text-stone-50 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[11px] [&_pre_code]:leading-4 [&_table]:mt-2 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-[10px] [&_table]:text-left [&_td]:border [&_td]:border-stone-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-stone-200 [&_th]:bg-stone-50 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
