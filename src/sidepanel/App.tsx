import {
  Camera,
  FileText,
  History,
  Image as ImageIcon,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  Settings as SettingsIcon,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50';

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
  const didConsumePendingSelectionRef = useRef(false);

  const t = getTranslations(settings);
  const composerPlaceholder = autoAttachPage
    ? t.sidepanel.composerPlaceholderAuto
    : t.sidepanel.composerPlaceholder;

  async function loadSettings() {
    const response = await sendRuntimeMessage<{ settings: Settings }>({ type: 'settings.get' });
    if (response.ok) {
      setSettings(response.data.settings);
    }
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
    setAutoAttachPage(false);
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
      setAutoAttachPage(false);
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
      setAutoAttachPage(false);
      await loadSessions();
      await loadSession(sessionId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.errors.sendFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-slate-900">
      {historyOpen ? (
        <div className="absolute inset-0 z-20 flex">
          <button
            className="flex-1 bg-slate-950/24 backdrop-blur-[2px]"
            aria-label={t.sidepanel.sessionsLabel}
            title={t.sidepanel.sessionsLabel}
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="w-[min(88vw,320px)] border-l border-slate-200/80 bg-white/96 p-2.5 shadow-2xl shadow-slate-900/20 backdrop-blur-xl">
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
                  className={`rounded-[18px] border p-1.5 transition ${
                    session.id === activeSessionId
                      ? 'border-cyan-300 bg-cyan-50 shadow-sm shadow-cyan-900/5'
                      : 'border-slate-200 bg-white'
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
                      <div className="line-clamp-2 text-sm font-medium text-slate-900">{session.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatTimestamp(session.updatedAt, settings)}</div>
                    </button>
                    <button
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-rose-700"
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
                <p className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                  {t.sidepanel.emptySessions}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      <main className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-2 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(232,242,247,0.92))] p-2.5 sm:p-3">
        <header className="rounded-[22px] border border-slate-200/80 bg-white/88 p-2.5 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 rounded-xl bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-600">
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

        <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-[24px] border border-white/70 bg-white/72 p-2.5 shadow-inner shadow-white/70 backdrop-blur-sm">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`message ${message.role} max-w-[95%] rounded-[22px] px-3 py-2.5 shadow-sm ${
                message.role === 'user'
                  ? 'self-end bg-slate-900 text-white shadow-slate-900/15'
                  : 'border border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-5.5">{message.content}</div>
                <button
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                    message.role === 'user'
                      ? 'text-white/60 hover:bg-white/10 hover:text-white'
                      : 'text-slate-400 hover:bg-white hover:text-rose-700'
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
                      className={`max-w-full self-start rounded-[16px] border px-2.5 py-2 text-xs ${
                        message.role === 'user'
                          ? 'border-white/10 bg-white/10'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">{attachmentIcon(attachment)}</span>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{attachmentLabel(attachment, settings)}</span>
                        <button
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${
                            message.role === 'user'
                              ? 'text-white/60 hover:bg-white/10 hover:text-white'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-rose-700'
                          }`}
                          onClick={() => void deleteStoredAttachment(message.id, attachment.id)}
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

        <section className="rounded-[24px] border border-slate-200/80 bg-white/86 p-2.5 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm font-semibold text-slate-900" title={t.sidepanel.contextHint}>
              {t.sidepanel.contextLabel}
            </div>
            <label
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
              aria-label={t.sidepanel.autoAttachPage}
              title={t.sidepanel.autoAttachPage}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                checked={autoAttachPage}
                onChange={(event) => setAutoAttachPage(event.target.checked)}
              />
              <span>{t.sidepanel.autoAttachPageShort}</span>
            </label>
          </div>

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
          </div>

          {contextError ? (
            <div className="mt-2 rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {contextError}
            </div>
          ) : null}

          <div className="mt-2 min-w-0 rounded-[20px] border border-slate-200 bg-slate-50/80">
            {attachments.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">{t.sidepanel.attachedItems}</div>
            ) : (
              <div className="flex max-h-56 min-w-0 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="min-w-0 w-full max-w-full rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">{attachmentIcon(attachment)}</span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere] font-medium">{attachmentLabel(attachment, settings)}</span>
                      <button
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        aria-label={t.common.delete}
                        title={t.common.delete}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {attachment.kind === 'screenshot' ? (
                      <div className="mt-2 overflow-hidden rounded-[16px] border border-slate-200 bg-slate-100 p-2">
                        <img
                          className="max-h-32 w-auto max-w-full rounded-[12px] object-contain shadow-sm"
                          src={attachment.imageDataUrl}
                          alt={t.sidepanel.attachmentPreviewAlt}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 max-h-28 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">
                        {attachment.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200/80 bg-white/88 p-2.5 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
          <div className="flex items-end gap-2">
            <textarea
              className="min-h-[92px] flex-1 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-5.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white"
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

          {error && <div className="mt-2 text-sm text-rose-700">{error}</div>}
        </section>
      </main>
    </div>
  );
}
