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
import type { AsyncResponse } from '../shared/messages';
import type { ChatMessage, ChatSession, ContextAttachment, Settings } from '../shared/models';

async function sendMessage<T>(payload: unknown): Promise<AsyncResponse<T>> {
  return chrome.runtime.sendMessage(payload) as Promise<AsyncResponse<T>>;
}

function attachmentLabel(attachment: ContextAttachment): string {
  switch (attachment.kind) {
    case 'selectionText':
      return `Selection: ${attachment.text.slice(0, 48)}`;
    case 'pageText':
      return `Page: ${attachment.source.title ?? attachment.source.url ?? 'Current page'}`;
    case 'screenshot':
      return `Screenshot: ${attachment.source.title ?? attachment.source.url ?? 'Current page'}`;
  }
}

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
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-3.5 py-2 text-sm font-medium text-ink-900 shadow-sm backdrop-blur-sm transition hover:border-ink-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50';

export function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachment[]>([]);
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadSettings() {
    const response = await sendMessage<{ settings: Settings }>({ type: 'settings.get' });
    if (response.ok) {
      setSettings(response.data.settings);
    }
  }

  async function loadSessions(selectNewest = false) {
    const response = await sendMessage<{ sessions: ChatSession[] }>({ type: 'session.list' });
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
    const response = await sendMessage<{ session: ChatSession; messages: ChatMessage[] }>({
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

    const response = await sendMessage<{ session: ChatSession }>({
      type: 'session.create',
      payload: { title: 'New chat' },
    });
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    await loadSessions(true);
    return response.data.session.id;
  }

  async function createNewSession() {
    setError('');
    const response = await sendMessage<{ session: ChatSession }>({
      type: 'session.create',
      payload: { title: 'New chat' },
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
    if (!window.confirm('Delete this session and all saved messages?')) {
      return;
    }
    const response = await sendMessage<{ sessionId: string }>({
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

  async function captureAttachment(type: 'context.captureSelection' | 'context.capturePage' | 'context.captureScreenshot') {
    setError('');
    const response = await sendMessage<{ attachment: ContextAttachment }>({ type });
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
      const response = await sendMessage<{
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
      setError(submitError instanceof Error ? submitError.message : 'Unable to send message.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell min-h-screen bg-transparent text-ink-900 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sidebar border-b border-white/60 bg-white/55 p-4 backdrop-blur-xl lg:border-r lg:border-b-0 lg:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">Sessions</div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Sidepanel LLM</h1>
          </div>
          <button className={subtleButtonClassName} onClick={() => void createNewSession()}>
            <MessageSquarePlus className="h-4 w-4" />
            New
          </button>
        </div>
        <div className="session-list flex flex-col gap-2.5">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`session-item rounded-3xl border px-3.5 py-3 text-left shadow-sm transition ${
                session.id === activeSessionId
                  ? 'active border-ink-900 bg-ink-900 text-sand-100 shadow-xl shadow-ink-900/15'
                  : 'border-white/60 bg-white/75 text-ink-900 backdrop-blur-sm hover:border-ink-200 hover:bg-white'
              }`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <span className="line-clamp-2 text-sm font-medium">{session.title}</span>
              <small className={`mt-1 text-xs ${session.id === activeSessionId ? 'text-sand-300' : 'text-ink-400'}`}>
                {new Date(session.updatedAt).toLocaleString()}
              </small>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="rounded-3xl border border-dashed border-ink-200 bg-white/50 px-4 py-5 text-sm leading-6 text-ink-400">
              No sessions yet.
            </p>
          )}
        </div>
      </aside>

      <main className="panel grid min-h-[calc(100vh-96px)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 p-4 lg:min-h-screen lg:p-5">
        <header className="panel-header flex items-start justify-between gap-3 rounded-[28px] border border-white/60 bg-white/60 px-4 py-4 shadow-sm backdrop-blur-xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">Model</div>
            <strong className="mt-1 block text-sm font-semibold text-ink-900">
              {settings?.modelId ?? 'Not configured'}
            </strong>
          </div>
          <div className="header-actions flex items-center gap-2">
            <button className={subtleButtonClassName} onClick={() => chrome.runtime.openOptionsPage()}>
              <SettingsIcon className="h-4 w-4" />
              Settings
            </button>
            <button className={subtleButtonClassName} onClick={() => void deleteCurrentSession()}>
              <Trash2 className="h-4 w-4 text-red-700" />
              <span className="text-red-700">Delete</span>
            </button>
          </div>
        </header>

        <section className="message-list flex min-h-0 flex-col gap-3 overflow-y-auto rounded-[32px] border border-white/50 bg-white/35 p-3 backdrop-blur-sm lg:p-4">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`message ${message.role} max-w-[92%] rounded-[24px] px-4 py-3 shadow-sm ${
                message.role === 'user'
                  ? 'self-end bg-ink-900 text-sand-100 shadow-ink-900/15'
                  : 'border border-white/70 bg-white/85 text-ink-900'
              }`}
            >
              <div className="message-role mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                {message.role}
              </div>
              <div className="message-content whitespace-pre-wrap text-sm leading-6">{message.content}</div>
              {message.attachments?.length ? (
                <div className="attachment-group mt-3 flex flex-col gap-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="attachment-chip subtle inline-flex items-center gap-2 self-start rounded-full border border-current/10 bg-black/5 px-3 py-1.5 text-xs"
                    >
                      {attachmentIcon(attachment)}
                      {attachmentLabel(attachment)}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {messages.length === 0 && (
            <p className="empty m-auto max-w-md text-center text-sm leading-7 text-ink-400">
              Start a chat, then attach page context if needed.
            </p>
          )}
        </section>

        <section className="composer-panel rounded-[32px] border border-white/60 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
          <div className="context-actions flex flex-wrap gap-2">
            <button className={subtleButtonClassName} onClick={() => void captureAttachment('context.captureSelection')}>
              <Type className="h-4 w-4" />
              Capture selection
            </button>
            <button className={subtleButtonClassName} onClick={() => void captureAttachment('context.capturePage')}>
              <FileText className="h-4 w-4" />
              Capture page
            </button>
            <button className={subtleButtonClassName} onClick={() => void captureAttachment('context.captureScreenshot')}>
              <Camera className="h-4 w-4" />
              Capture screenshot
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="attachment-group mt-3 flex flex-col gap-2.5">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="attachment-chip inline-flex items-center gap-2 self-start rounded-full border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-700"
                >
                  {attachmentIcon(attachment)}
                  {attachmentLabel(attachment)}
                  <button
                    className="chip-dismiss inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-400 transition hover:bg-white hover:text-ink-900"
                    onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {attachments
                .filter((attachment) => attachment.kind === 'screenshot')
                .map((attachment) => (
                  <img
                    key={`${attachment.id}-preview`}
                    className="screenshot-preview mt-1 w-full max-w-[240px] rounded-[24px] border border-ink-200 object-cover shadow-sm"
                    src={attachment.imageDataUrl}
                    alt="Attached screenshot preview"
                  />
                ))}
            </div>
          )}

          <textarea
            className="composer mt-3 min-h-[120px] w-full rounded-[28px] border border-ink-100 bg-white px-4 py-3 text-sm leading-6 text-ink-900 shadow-inner shadow-white/40 outline-none transition placeholder:text-ink-400 focus:border-ink-200"
            placeholder="Ask about the current page..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          {error && <div className="status error mt-3 text-sm text-red-700">{error}</div>}

          <div className="composer-footer mt-3 flex items-center justify-between gap-3">
            <span className="status text-sm text-ink-400">{loading ? 'Waiting for response...' : 'Ready'}</span>
            <button className={primaryButtonClassName} disabled={loading || !draft.trim()} onClick={() => void submit()}>
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
