import { DEFAULT_SETTINGS, type ChatMessage, type ChatSession, type Settings } from '../shared/models';

const STORAGE_KEYS = {
  settings: 'settings',
  sessions: 'sessions',
  messages: 'messages',
} as const;

type MessageStore = Record<string, ChatMessage[]>;

async function readStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

async function writeStorage<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const settings = await readStorage<Partial<Settings>>(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...settings };
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
  const now = new Date().toISOString();
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

  if (session) {
    const titleSource = updatedMessages[sessionId][0]?.content?.trim();
    await updateSession({
      ...session,
      title: session.title === 'New chat' && titleSource ? titleSource.slice(0, 40) : session.title,
      updatedAt: new Date().toISOString(),
    });
  }
}
