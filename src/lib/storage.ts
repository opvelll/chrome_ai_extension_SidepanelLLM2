import { getDefaultSettings } from './defaultSettings';
import type { ChatMessage, ChatSession, Settings } from '../shared/models';

const STORAGE_KEYS = {
  settings: 'settings',
  sessions: 'sessions_v2',
  messages: 'messages_v2',
} as const;

type MessageStore = Record<string, ChatMessage[]>;

function getNowIso() {
  return new Date().toISOString();
}

function getSessionTitle(messages: ChatMessage[], fallbackTitle: string) {
  const titleSource = messages.find((message) => message.role === 'user')?.content?.trim();
  return titleSource ? titleSource.slice(0, 40) : fallbackTitle;
}

async function readStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

async function writeStorage<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const settings = await readStorage<Partial<Settings>>(STORAGE_KEYS.settings, {});
  return { ...getDefaultSettings(), ...settings };
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await writeStorage(STORAGE_KEYS.settings, settings);
  return settings;
}

export async function listSessions(): Promise<ChatSession[]> {
  const sessions = await readStorage<ChatSession[]>(STORAGE_KEYS.sessions, []);
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSession(sessionId: string): Promise<ChatSession | undefined> {
  const sessions = await listSessions();
  return sessions.find((session) => session.id === sessionId);
}

export async function createSession(title?: string): Promise<ChatSession> {
  const now = getNowIso();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: title?.trim() || 'New chat',
    createdAt: now,
    updatedAt: now,
  };

  const sessions = await listSessions();
  sessions.unshift(session);
  await writeStorage(STORAGE_KEYS.sessions, sessions);
  return session;
}

export async function updateSession(updatedSession: ChatSession): Promise<void> {
  const sessions = await listSessions();
  const next = sessions.map((session) => (session.id === updatedSession.id ? updatedSession : session));
  await writeStorage(STORAGE_KEYS.sessions, next);
}

async function syncSessionAfterMessageChange(
  session: ChatSession | undefined,
  nextSessionMessages: ChatMessage[],
  options?: { refreshTitle?: boolean },
): Promise<void> {
  if (!session) {
    return;
  }

  await updateSession({
    ...session,
    title: options?.refreshTitle ? getSessionTitle(nextSessionMessages, session.title) : session.title,
    updatedAt: getNowIso(),
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const [sessions, messages] = await Promise.all([
    listSessions(),
    readStorage<MessageStore>(STORAGE_KEYS.messages, {}),
  ]);

  const nextSessions = sessions.filter((session) => session.id !== sessionId);
  const nextMessages = { ...messages };
  delete nextMessages[sessionId];

  await Promise.all([
    writeStorage(STORAGE_KEYS.sessions, nextSessions),
    writeStorage(STORAGE_KEYS.messages, nextMessages),
  ]);
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const messages = await readStorage<MessageStore>(STORAGE_KEYS.messages, {});
  return messages[sessionId] ?? [];
}

export async function appendMessages(sessionId: string, nextMessages: ChatMessage[]): Promise<void> {
  const [messages, session] = await Promise.all([
    readStorage<MessageStore>(STORAGE_KEYS.messages, {}),
    getSession(sessionId),
  ]);

  const updatedMessages = {
    ...messages,
    [sessionId]: [...(messages[sessionId] ?? []), ...nextMessages],
  };

  await writeStorage(STORAGE_KEYS.messages, updatedMessages);
  await syncSessionAfterMessageChange(session, updatedMessages[sessionId], { refreshTitle: true });
}

export async function deleteMessage(sessionId: string, messageId: string): Promise<ChatMessage[]> {
  const [messages, session] = await Promise.all([
    readStorage<MessageStore>(STORAGE_KEYS.messages, {}),
    getSession(sessionId),
  ]);

  const nextSessionMessages = (messages[sessionId] ?? []).filter((message) => message.id !== messageId);
  const nextMessages = {
    ...messages,
    [sessionId]: nextSessionMessages,
  };

  await writeStorage(STORAGE_KEYS.messages, nextMessages);
  await syncSessionAfterMessageChange(session, nextSessionMessages, { refreshTitle: true });

  return nextSessionMessages;
}

export async function deleteMessageAttachment(
  sessionId: string,
  messageId: string,
  attachmentId: string,
): Promise<ChatMessage[]> {
  const [messages, session] = await Promise.all([
    readStorage<MessageStore>(STORAGE_KEYS.messages, {}),
    getSession(sessionId),
  ]);

  const nextSessionMessages = (messages[sessionId] ?? []).map((message) =>
    message.id === messageId
      ? {
          ...message,
          attachments: message.attachments?.filter((attachment) => attachment.id !== attachmentId) ?? [],
        }
      : message,
  );

  const nextMessages = {
    ...messages,
    [sessionId]: nextSessionMessages,
  };

  await writeStorage(STORAGE_KEYS.messages, nextMessages);
  await syncSessionAfterMessageChange(session, nextSessionMessages);

  return nextSessionMessages;
}
