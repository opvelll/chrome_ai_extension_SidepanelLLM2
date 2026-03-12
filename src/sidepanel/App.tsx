import {
  Camera,
  FileText,
  History,
  Image as ImageIcon,
  Minus,
  LoaderCircle,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { attachmentSourceDetails, attachmentSourceSummary } from '../lib/attachments';
import { attachmentLabel, formatTimestamp, getTranslations } from '../lib/i18n';
import { sendRuntimeMessage } from '../lib/runtime';
import type { ChatMessage, ChatSession, ContextAttachment, Settings } from '../shared/models';

function attachmentIcon(attachment: ContextAttachment) {
  switch (attachment.kind) {
    case 'selectionText':
      return <Type className="h-4.5 w-4.5" />;
    case 'pageText':
      return <FileText className="h-4.5 w-4.5" />;
    case 'screenshot':
      return <ImageIcon className="h-4.5 w-4.5" />;
  }
}

const subtleButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-700 active:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50';

function attachmentBody(attachment: ContextAttachment) {
  return attachment.kind === 'screenshot' ? '' : attachment.text;
}

function isAttachmentActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}

export function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachment[]>([]);
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contextError, setContextError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [autoAttachPage, setAutoAttachPage] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<ContextAttachment | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const didConsumePendingSelectionRef = useRef(false);

  const t = getTranslations(settings);
  const composerPlaceholder = autoAttachPage
    ? t.sidepanel.composerPlaceholderAuto
    : t.sidepanel.composerPlaceholder;

  async function loadSettings() {
    const response = await sendRuntimeMessage<{ settings: Settings }>({ type: 'settings.get' });
    if (response.ok) {
      setSettings(response.data.settings);
      setAutoAttachPage(response.data.settings.autoAttachPage);
    }
  }

  async function updateAutoAttachPage(nextValue: boolean) {
    setAutoAttachPage(nextValue);
    setSettings((current) => (current ? { ...current, autoAttachPage: nextValue } : current));

    const currentSettings = settings;
    if (!currentSettings) {
      return;
    }

    const response = await sendRuntimeMessage<{ settings: Settings }>({
      type: 'settings.save',
      payload: { ...currentSettings, autoAttachPage: nextValue },
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setSettings(response.data.settings);
    setAutoAttachPage(response.data.settings.autoAttachPage);
  }

  async function loadSessions(selectNewest = false) {
    const response = await sendRuntimeMessage<{ sessions: ChatSession[] }>({ type: 'session.list' });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setSessions(response.data.sessions);

    const nextSessionId =
      activeSessionId && response.data.sessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : response.data.sessions[0]?.id;

    if (selectNewest && response.data.sessions[0]?.id) {
      setActiveSessionId(response.data.sessions[0].id);
      return;
    }

    if (nextSessionId) {
      setActiveSessionId(nextSessionId);
    }
  }

  async function loadSession(sessionId: string) {
    const response = await sendRuntimeMessage<{ session: ChatSession; messages: ChatMessage[] }>({
      type: 'session.get',
      payload: { sessionId },
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessages(response.data.messages);
  }

  useEffect(() => {
    void loadSettings();
    void loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      void loadSession(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (didConsumePendingSelectionRef.current) {
      return;
    }

    didConsumePendingSelectionRef.current = true;

    void (async () => {
      const response = await sendRuntimeMessage<{ attachment: ContextAttachment | null }>({
        type: 'context.consumePendingSelection',
      });

      if (!response.ok) {
        return;
      }

      if (!response.data.attachment) {
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
  }, []);

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

  async function ensureSession() {
    if (activeSessionId) {
      return activeSessionId;
    }

    const response = await sendRuntimeMessage<{ session: ChatSession }>({
      type: 'session.create',
      payload: { title: t.sidepanel.defaultSessionTitle },
    });
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    await loadSessions(true);
    return response.data.session.id;
  }

  async function createNewSession() {
    setError('');
    setContextError('');
    const response = await sendRuntimeMessage<{ session: ChatSession }>({
      type: 'session.create',
      payload: { title: t.sidepanel.defaultSessionTitle },
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setAttachments([]);
    setDraft('');
    setHistoryOpen(false);
    await loadSessions(true);
  }

  async function deleteSessionById(sessionId: string) {
    if (!sessionId) {
      return;
    }
    if (!window.confirm(t.sidepanel.deleteConfirm)) {
      return;
    }
    const response = await sendRuntimeMessage<{ sessionId: string }>({
      type: 'session.delete',
      payload: { sessionId },
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    if (sessionId === activeSessionId) {
      setAttachments([]);
      setDraft('');
      setActiveSessionId('');
    }
    await loadSessions();
  }

  async function deleteStoredMessage(messageId: string) {
    if (!activeSessionId) {
      return;
    }

    const response = await sendRuntimeMessage<{ messages: ChatMessage[] }>({
      type: 'message.delete',
      payload: { sessionId: activeSessionId, messageId },
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessages(response.data.messages);
    await loadSessions();
  }

  async function deleteStoredAttachment(messageId: string, attachmentId: string) {
    if (!activeSessionId) {
      return;
    }

    const response = await sendRuntimeMessage<{ messages: ChatMessage[] }>({
      type: 'message.attachmentDelete',
      payload: { sessionId: activeSessionId, messageId, attachmentId },
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessages(response.data.messages);
    await loadSessions();
  }

  async function captureAttachment(
    type: 'context.captureSelection' | 'context.capturePage' | 'context.captureScreenshot',
  ) {
    setError('');
    setContextError('');
    const response = await sendRuntimeMessage<{ attachment: ContextAttachment }>({ type });
    if (!response.ok) {
      setContextError(response.error.message);
      return;
    }
    setContextError('');
    setAttachments((current) => [...current, response.data.attachment]);
  }

  async function submit() {
    if (!draft.trim()) {
      return;
    }

    setLoading(true);
    setError('');
    setContextError('');

    try {
      const sessionId = await ensureSession();
      let nextAttachments = [...attachments];

      if (autoAttachPage && messages.length === 0 && !nextAttachments.some((attachment) => attachment.kind === 'pageText')) {
        const pageResponse = await sendRuntimeMessage<{ attachment: ContextAttachment }>({
          type: 'context.capturePage',
        });

        if (!pageResponse.ok) {
          setContextError(pageResponse.error.message);
          return;
        }

        nextAttachments = [...nextAttachments, pageResponse.data.attachment];
      }

      const response = await sendRuntimeMessage<{
        assistantMessage: ChatMessage;
      }>({
        type: 'chat.send',
        payload: {
          sessionId,
          message: draft.trim(),
          attachments: nextAttachments,
        },
      });

      if (!response.ok) {
        setError(response.error.message);
        return;
      }

      setDraft('');
      setAttachments([]);
      await loadSessions();
      await loadSession(sessionId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.errors.sendFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-stone-900">
      {historyOpen ? (
        <div className="absolute inset-0 z-20 flex">
          <button
            className="flex-1 bg-slate-950/24 backdrop-blur-[2px]"
            aria-label={t.sidepanel.sessionsLabel}
            title={t.sidepanel.sessionsLabel}
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="w-[min(88vw,320px)] border-l border-stone-200/70 bg-white/96 p-2.5 shadow-2xl shadow-stone-900/15 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                onClick={() => void createNewSession()}
                aria-label={t.sidepanel.newChat}
                title={t.sidepanel.newChat}
              >
                <MessageSquarePlus className="h-5 w-5" />
              </button>
              <button
                className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                onClick={() => setHistoryOpen(false)}
                aria-label={t.sidepanel.sessionsLabel}
                title={t.sidepanel.sessionsLabel}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex max-h-[calc(100vh-96px)] flex-col gap-1.5 overflow-y-auto pr-0.5">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`rounded-[18px] border p-1.5 transition ${session.id === activeSessionId
                    ? 'border-teal-200 bg-teal-50 shadow-sm shadow-teal-900/8'
                    : 'border-stone-200 bg-white'
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      className="session-item min-w-0 flex-1 rounded-[14px] px-2 py-1.5 text-left hover:bg-white/70"
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setHistoryOpen(false);
                      }}
                    >
                      <div className="line-clamp-2 text-sm font-medium text-stone-900">{session.title}</div>
                      <div className="mt-1 text-xs text-stone-500">{formatTimestamp(session.updatedAt, settings)}</div>
                    </button>
                    <button
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 transition hover:bg-white hover:text-rose-600"
                      onClick={() => void deleteSessionById(session.id)}
                      aria-label={t.common.delete}
                      title={t.common.delete}
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm leading-6 text-stone-500">
                  {t.sidepanel.emptySessions}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {previewAttachment ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-stone-950/50 p-2 backdrop-blur-[2px]">
          <button
            className="absolute inset-0"
            aria-label={t.common.close}
            title={t.common.close}
            onClick={() => setPreviewAttachment(null)}
          />
          <section
            className="relative z-10 flex max-h-[88vh] w-full max-w-[22rem] flex-col overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-2xl shadow-stone-950/20"
            role="dialog"
            aria-modal="true"
            aria-label={attachmentLabel(previewAttachment, settings)}
          >
            <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-stone-900">{attachmentLabel(previewAttachment, settings)}</div>
                <div className="mt-1 line-clamp-2 text-[11px] text-stone-500">
                  {attachmentSourceSummary(previewAttachment.source)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {previewAttachment.kind === 'screenshot' ? (
                  <>
                    <button
                      type="button"
                      className={`${subtleButtonClassName} h-8 w-8 rounded-xl px-0`}
                      onClick={() => updatePreviewScale(previewScale - 0.25)}
                      aria-label={t.common.zoomOut}
                      title={t.common.zoomOut}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={`${subtleButtonClassName} h-8 w-8 rounded-xl px-0`}
                      onClick={() => updatePreviewScale(1)}
                      aria-label={t.common.reset}
                      title={t.common.reset}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={`${subtleButtonClassName} h-8 w-8 rounded-xl px-0`}
                      onClick={() => updatePreviewScale(previewScale + 0.25)}
                      aria-label={t.common.zoomIn}
                      title={t.common.zoomIn}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                  onClick={() => setPreviewAttachment(null)}
                  aria-label={t.common.close}
                  title={t.common.close}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-3 whitespace-pre-wrap rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] leading-5 text-stone-600 [overflow-wrap:anywhere]">
                {attachmentSourceDetails(previewAttachment.source).join('\n')}
              </div>
              {previewAttachment.kind === 'screenshot' ? (
                <div className="overflow-auto rounded-[18px] border border-stone-200 bg-stone-100 p-2">
                  <img
                    className="max-h-none max-w-none rounded-[12px] object-contain"
                    src={previewAttachment.imageDataUrl}
                    alt={t.sidepanel.attachmentPreviewAlt}
                    style={{
                      width: `${previewScale * 100}%`,
                      minWidth: `${previewScale * 100}%`,
                    }}
                  />
                </div>
              ) : (
                <div className="whitespace-pre-wrap rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm leading-6 text-stone-700 [overflow-wrap:anywhere]">
                  {attachmentBody(previewAttachment)}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <main className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)_auto] gap-2 bg-[linear-gradient(180deg,rgba(247,243,237,0.72),rgba(232,242,246,0.60))] p-2.5 sm:p-3">
        <header className="rounded-[22px] border border-stone-200/70 bg-white/90 p-2.5 shadow-md shadow-stone-900/6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 rounded-xl bg-stone-100 px-2.5 py-1.5 text-sm font-medium text-stone-600">
              <span className="line-clamp-1">{settings?.modelId ?? t.sidepanel.modelNotConfigured}</span>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                onClick={() => setHistoryOpen(true)}
                aria-label={t.sidepanel.sessionsLabel}
                title={t.sidepanel.sessionsLabel}
              >
                <History className="h-5 w-5" />
              </button>
              <button
                className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                onClick={() => void createNewSession()}
                aria-label={t.sidepanel.newChat}
                title={t.sidepanel.newChat}
              >
                <MessageSquarePlus className="h-5 w-5" />
              </button>
              <button
                className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                onClick={() => chrome.runtime.openOptionsPage()}
                aria-label={t.common.settings}
                title={t.common.settings}
              >
                <SettingsIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-[24px] border border-stone-200/50 bg-white/78 p-2.5 shadow-inner shadow-stone-900/4 backdrop-blur-sm">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`message group ${message.role} max-w-[95%] rounded-[22px] px-3 py-2.5 shadow-sm ${message.role === 'user'
                ? 'self-end bg-teal-700 text-white shadow-teal-900/20'
                : 'border border-stone-200 bg-white text-stone-900 shadow-stone-900/5'
                }`}
            >
              <div className="mb-0.5 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-5.5">{message.content}</div>
                <button
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 ${message.role === 'user'
                    ? 'text-white/60 hover:bg-white/10 hover:text-white focus:opacity-100'
                    : 'text-stone-400 hover:bg-stone-100 hover:text-rose-600 focus:opacity-100'
                    }`}
                  onClick={() => void deleteStoredMessage(message.id)}
                  aria-label={t.common.delete}
                  title={t.common.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {message.attachments?.length ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={`max-w-full cursor-pointer self-start rounded-[16px] border px-2.5 py-2 text-left text-xs transition ${message.role === 'user'
                        ? 'border-white/15 bg-white/12'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                        }`}
                      onClick={() => setPreviewAttachment(attachment)}
                      onKeyDown={(event) => {
                        if (!isAttachmentActivationKey(event.key)) {
                          return;
                        }
                        event.preventDefault();
                        setPreviewAttachment(attachment);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${t.sidepanel.attachmentOpen}: ${attachmentLabel(attachment, settings)}`}
                      title={t.sidepanel.attachmentOpen}
                    >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5">{attachmentIcon(attachment)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="[overflow-wrap:anywhere]">{attachmentLabel(attachment, settings)}</div>
                            <div className={`mt-1 text-[10px] leading-4 [overflow-wrap:anywhere] ${message.role === 'user' ? 'text-white/70' : 'text-stone-500'}`}>
                              {attachmentSourceDetails(attachment.source).join(' / ')}
                            </div>
                          </div>
                          <button
                          type="button"
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${message.role === 'user'
                            ? 'text-white/60 hover:bg-white/10 hover:text-white'
                            : 'text-stone-400 hover:bg-stone-200 hover:text-rose-600'
                            }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteStoredAttachment(message.id, attachment.id);
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

        <section className="rounded-[24px] border border-stone-200/70 bg-white/92 p-2.5 shadow-md shadow-stone-900/6 backdrop-blur-xl">
          <div className="flex flex-col gap-2.5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                  onClick={() => void captureAttachment('context.captureSelection')}
                  aria-label={t.sidepanel.captureSelection}
                  title={t.sidepanel.captureSelection}
                >
                  <Type className="h-5 w-5" />
                </button>
                <button
                  className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                  onClick={() => void captureAttachment('context.capturePage')}
                  aria-label={t.sidepanel.capturePage}
                  title={t.sidepanel.capturePage}
                >
                  <FileText className="h-5 w-5" />
                </button>
                <button
                  className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
                  onClick={() => void captureAttachment('context.captureScreenshot')}
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
                    onChange={(event) => void updateAutoAttachPage(event.target.checked)}
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
                      <div
                        key={attachment.id}
                        className="min-w-0 w-full max-w-full cursor-pointer rounded-[18px] border border-stone-200 bg-white px-3 py-2.5 text-left text-xs text-stone-700 shadow-sm transition hover:bg-stone-50"
                        onClick={() => setPreviewAttachment(attachment)}
                        onKeyDown={(event) => {
                          if (!isAttachmentActivationKey(event.key)) {
                            return;
                          }
                          event.preventDefault();
                          setPreviewAttachment(attachment);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${t.sidepanel.attachmentOpen}: ${attachmentLabel(attachment, settings)}`}
                        title={t.sidepanel.attachmentOpen}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5">{attachmentIcon(attachment)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium [overflow-wrap:anywhere]">{attachmentLabel(attachment, settings)}</div>
                            <div className="mt-1 text-[10px] leading-4 text-stone-500 [overflow-wrap:anywhere]">
                              {attachmentSourceDetails(attachment.source).join(' / ')}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-800"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAttachments((current) => current.filter((item) => item.id !== attachment.id));
                            }}
                            aria-label={t.common.delete}
                            title={t.common.delete}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {attachment.kind === 'screenshot' ? (
                          <div className="mt-2 overflow-hidden rounded-[16px] border border-stone-200 bg-stone-100 p-2">
                            <img
                              className="max-h-24 w-auto max-w-full rounded-[12px] object-contain shadow-sm"
                              src={attachment.imageDataUrl}
                              alt={t.sidepanel.attachmentPreviewAlt}
                            />
                          </div>
                        ) : (
                          <div className="mt-2 line-clamp-3 min-w-0 w-full max-w-full whitespace-pre-wrap rounded-[14px] border border-stone-200 bg-stone-50 px-2.5 py-2 text-xs leading-5 text-stone-600 [overflow-wrap:anywhere]">
                            {attachmentBody(attachment)}
                          </div>
                        )}
                      </div>
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
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button
                  className={`${primaryButtonClassName} h-10 w-10 shrink-0 rounded-xl px-0`}
                  disabled={loading || !draft.trim()}
                  onClick={() => void submit()}
                  aria-label={t.sidepanel.send}
                  title={t.sidepanel.send}
                >
                  {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
        </section>
      </main>
    </div>
  );
}
