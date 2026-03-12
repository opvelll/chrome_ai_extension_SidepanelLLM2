import {
  Camera,
  FileText,
  Image as ImageIcon,
  MessageSquarePlus,
  Send,
  Settings as SettingsIcon,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { attachmentLabel, formatTimestamp, getTranslations } from '../lib/i18n';
import { sendRuntimeMessage } from '../lib/runtime';
import type { ChatMessage, ChatSession, ContextAttachment, Settings } from '../shared/models';

function attachmentIcon(attachment: ContextAttachment) {
  switch (attachment.kind) {
    case 'selectionText':
      return <Type className="h-3.5 w-3.5" />;
    case 'pageText':
      return <FileText className="h-3.5 w-3.5" />;
    case 'screenshot':
      return <ImageIcon className="h-3.5 w-3.5" />;
  }
}

const subtleButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50';

export function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachment[]>([]);
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = getTranslations(settings);

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
    await loadSessions(true);
  }

  async function deleteCurrentSession() {
    if (!activeSessionId) {
      return;
    }
    if (!window.confirm(t.sidepanel.deleteConfirm)) {
      return;
    }
    const response = await sendRuntimeMessage<{ sessionId: string }>({
      type: 'session.delete',
      payload: { sessionId: activeSessionId },
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setAttachments([]);
    setDraft('');
    setActiveSessionId('');
    await loadSessions();
  }

  async function captureAttachment(
    type: 'context.captureSelection' | 'context.capturePage' | 'context.captureScreenshot',
  ) {
    setError('');
    const response = await sendRuntimeMessage<{ attachment: ContextAttachment }>({ type });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setAttachments((current) => [...current, response.data.attachment]);
  }

  async function submit() {
    if (!draft.trim()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sessionId = await ensureSession();
      const response = await sendRuntimeMessage<{
        assistantMessage: ChatMessage;
      }>({
        type: 'chat.send',
        payload: {
          sessionId,
          message: draft.trim(),
          attachments,
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
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[290px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="border-b border-white/50 bg-slate-950 px-4 py-4 text-slate-50 lg:border-r lg:border-b-0 lg:px-5 lg:py-5">
          <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                  {t.sidepanel.sessionsLabel}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.common.appName}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {t.sidepanel.workspaceLabel}
                </p>
              </div>
              <button className={`${primaryButtonClassName} w-full whitespace-nowrap`} onClick={() => void createNewSession()}>
                <MessageSquarePlus className="h-4 w-4" />
                {t.sidepanel.newChat}
              </button>
            </div>

            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                  {t.sidepanel.messageCount}
                </div>
                <div className="mt-1 text-lg font-semibold">{messages.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                  {t.sidepanel.attachmentsCount}
                </div>
                <div className="mt-1 text-lg font-semibold">{attachments.length}</div>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/7 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                  {t.sidepanel.activeModel}
                </div>
                <div className="mt-1 line-clamp-1 text-sm font-semibold">
                  {settings?.modelId ?? t.sidepanel.modelNotConfigured}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-240px)]">
            {sessions.map((session) => (
              <button
                key={session.id}
                className={`session-item rounded-[26px] border px-4 py-3 text-left transition ${
                  session.id === activeSessionId
                    ? 'border-cyan-300/40 bg-cyan-400/18 shadow-lg shadow-cyan-900/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                }`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <div className="line-clamp-2 text-sm font-medium text-white">{session.title}</div>
                <div className="mt-2 text-xs text-slate-300">{formatTimestamp(session.updatedAt, settings)}</div>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="rounded-[26px] border border-dashed border-white/15 bg-white/4 px-4 py-5 text-sm leading-6 text-slate-300">
                {t.sidepanel.emptySessions}
              </p>
            )}
          </div>
        </aside>

        <main className="grid min-h-[calc(100vh-96px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(232,242,247,0.92))] p-4 lg:min-h-screen lg:p-5">
          <header className="rounded-[30px] border border-slate-200/80 bg-white/86 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/80">
                  {t.sidepanel.modelLabel}
                </div>
                <strong className="mt-2 block text-lg font-semibold text-slate-900">
                  {settings?.modelId ?? t.sidepanel.modelNotConfigured}
                </strong>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  {t.sidepanel.contextHint}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className={subtleButtonClassName} onClick={() => chrome.runtime.openOptionsPage()}>
                  <SettingsIcon className="h-4 w-4" />
                  {t.common.settings}
                </button>
                <button className={subtleButtonClassName} onClick={() => void deleteCurrentSession()}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                  <span className="text-rose-700">{t.common.delete}</span>
                </button>
              </div>
            </div>
          </header>

          <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-[32px] border border-white/70 bg-white/72 p-3 shadow-inner shadow-white/70 backdrop-blur-sm lg:p-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`message ${message.role} max-w-[94%] rounded-[28px] px-4 py-3 shadow-sm ${
                    message.role === 'user'
                      ? 'self-end bg-slate-900 text-white shadow-slate-900/15'
                      : 'border border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                >
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                    {message.role === 'user' ? t.sidepanel.userRole : t.sidepanel.assistantRole}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                  {message.attachments?.length ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {message.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="inline-flex items-center gap-2 self-start rounded-full border border-current/10 bg-black/5 px-3 py-1.5 text-xs"
                        >
                          {attachmentIcon(attachment)}
                          {attachmentLabel(attachment, settings)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              {messages.length === 0 && (
                <p className="m-auto max-w-md text-center text-sm leading-7 text-slate-500">
                  {t.sidepanel.emptyMessages}
                </p>
              )}
            </div>

            <aside className="rounded-[32px] border border-slate-200/80 bg-white/86 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/80">
                {t.sidepanel.contextLabel}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <button className={subtleButtonClassName} onClick={() => void captureAttachment('context.captureSelection')}>
                  <Type className="h-4 w-4" />
                  {t.sidepanel.captureSelection}
                </button>
                <button className={subtleButtonClassName} onClick={() => void captureAttachment('context.capturePage')}>
                  <FileText className="h-4 w-4" />
                  {t.sidepanel.capturePage}
                </button>
                <button className={subtleButtonClassName} onClick={() => void captureAttachment('context.captureScreenshot')}>
                  <Camera className="h-4 w-4" />
                  {t.sidepanel.captureScreenshot}
                </button>
              </div>

              <div className="mt-5">
                <div className="text-sm font-medium text-slate-800">{t.sidepanel.attachedItems}</div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {attachments.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                      {t.sidepanel.contextHint}
                    </div>
                  ) : (
                    attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="rounded-[24px] border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5">{attachmentIcon(attachment)}</span>
                          <span className="min-w-0 flex-1">{attachmentLabel(attachment, settings)}</span>
                          <button
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-900"
                            onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {attachment.kind === 'screenshot' ? (
                          <img
                            className="mt-3 w-full rounded-[20px] border border-slate-200 object-cover shadow-sm"
                            src={attachment.imageDataUrl}
                            alt={t.sidepanel.attachmentPreviewAlt}
                          />
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </section>

          <section className="rounded-[32px] border border-slate-200/80 bg-white/88 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
            <textarea
              className="min-h-[120px] w-full rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white"
              placeholder={t.sidepanel.composerPlaceholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />

            {error && <div className="mt-3 text-sm text-rose-700">{error}</div>}

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">{loading ? t.common.waiting : t.common.ready}</span>
              <button className={primaryButtonClassName} disabled={loading || !draft.trim()} onClick={() => void submit()}>
                <Send className="h-4 w-4" />
                {t.sidepanel.send}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
