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
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="eyebrow">Sessions</div>
            <h1>Sidepanel LLM</h1>
          </div>
          <button className="ghost-button" onClick={() => void createNewSession()}>
            New
          </button>
        </div>
        <div className="session-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <span>{session.title}</span>
              <small>{new Date(session.updatedAt).toLocaleString()}</small>
            </button>
          ))}
          {sessions.length === 0 && <p className="empty">No sessions yet.</p>}
        </div>
      </aside>

      <main className="panel">
        <header className="panel-header">
          <div>
            <div className="eyebrow">Model</div>
            <strong>{settings?.modelId ?? 'Not configured'}</strong>
          </div>
          <div className="header-actions">
            <button className="ghost-button" onClick={() => chrome.runtime.openOptionsPage()}>
              Settings
            </button>
            <button className="ghost-button danger" onClick={() => void deleteCurrentSession()}>
              Delete
            </button>
          </div>
        </header>

        <section className="message-list">
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <div className="message-role">{message.role}</div>
              <div className="message-content">{message.content}</div>
              {message.attachments?.length ? (
                <div className="attachment-group">
                  {message.attachments.map((attachment) => (
                    <div key={attachment.id} className="attachment-chip subtle">
                      {attachmentLabel(attachment)}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {messages.length === 0 && <p className="empty">Start a chat, then attach page context if needed.</p>}
        </section>

        <section className="composer-panel">
          <div className="context-actions">
            <button className="ghost-button" onClick={() => void captureAttachment('context.captureSelection')}>
              Capture selection
            </button>
            <button className="ghost-button" onClick={() => void captureAttachment('context.capturePage')}>
              Capture page
            </button>
            <button className="ghost-button" onClick={() => void captureAttachment('context.captureScreenshot')}>
              Capture screenshot
            </button>
          </div>

          {attachments.length > 0 && (
            <div className="attachment-group">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="attachment-chip">
                  {attachmentLabel(attachment)}
                  <button
                    className="chip-dismiss"
                    onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  >
                    ×
                  </button>
                </div>
              ))}
              {attachments
                .filter((attachment) => attachment.kind === 'screenshot')
                .map((attachment) => (
                  <img
                    key={`${attachment.id}-preview`}
                    className="screenshot-preview"
                    src={attachment.imageDataUrl}
                    alt="Attached screenshot preview"
                  />
                ))}
            </div>
          )}

          <textarea
            className="composer"
            placeholder="Ask about the current page..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          {error && <div className="status error">{error}</div>}

          <div className="composer-footer">
            <span className="status">{loading ? 'Waiting for response...' : 'Ready'}</span>
            <button className="primary-button" disabled={loading || !draft.trim()} onClick={() => void submit()}>
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
