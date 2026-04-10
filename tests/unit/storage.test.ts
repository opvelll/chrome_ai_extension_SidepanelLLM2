import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendMessages,
  deleteMessage,
  deleteMessageAttachment,
  getSettings,
  listMessages,
  listSessions,
  saveSettings,
} from '../../src/lib/storage';
import type { ChatMessage, ChatSession } from '../../src/shared/models';

type LocalStore = Record<string, unknown>;

const FIXED_NOW = '2026-03-13T12:00:00.000Z';

function createChromeStorage(store: LocalStore) {
  return {
    storage: {
      local: {
        async get(key: string) {
          return { [key]: store[key] };
        },
        async set(values: LocalStore) {
          Object.assign(store, values);
        },
      },
    },
  };
}

function createSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session-1',
    title: 'New chat',
    createdAt: '2026-03-12T10:00:00.000Z',
    updatedAt: '2026-03-12T10:00:00.000Z',
    ...overrides,
  };
}

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    role: 'user',
    content: 'First prompt from the user',
    createdAt: '2026-03-12T10:05:00.000Z',
    ...overrides,
  };
}

describe('storage session syncing', () => {
  let store: LocalStore;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('chrome', createChromeStorage(store));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('updates the session title from the first user message when appending messages', async () => {
    store.sessions_v2 = [createSession()];
    store.messages_v2 = {};

    await appendMessages('session-1', [createMessage({ content: 'A'.repeat(60) })]);

    const [session] = await listSessions();
    const [message] = await listMessages('session-1');

    expect(message.content).toHaveLength(60);
    expect(session.title).toBe('A'.repeat(40));
    expect(session.updatedAt).toBe(FIXED_NOW);
  });

  it('recomputes the session title after deleting the first user message', async () => {
    store.sessions_v2 = [createSession({ title: 'Original title' })];
    store.messages_v2 = {
      'session-1': [
        createMessage({ id: 'message-1', content: 'First user title' }),
        createMessage({ id: 'message-2', content: 'Second user title' }),
      ],
    };

    const nextMessages = await deleteMessage('session-1', 'message-1');
    const [session] = await listSessions();

    expect(nextMessages).toHaveLength(1);
    expect(nextMessages[0]?.id).toBe('message-2');
    expect(session.title).toBe('Second user title');
    expect(session.updatedAt).toBe(FIXED_NOW);
  });

  it('preserves the session title when only an attachment is removed', async () => {
    store.sessions_v2 = [createSession({ title: 'Pinned title' })];
    store.messages_v2 = {
      'session-1': [
        createMessage({
          attachments: [
            {
              id: 'attachment-1',
              kind: 'pageText',
              text: 'Page body',
              source: {
                title: 'Example',
                url: 'https://example.com',
                hostname: 'example.com',
                pathname: '/',
                capturedAt: '2026-03-12T10:00:00.000Z',
              },
            },
          ],
        }),
      ],
    };

    const nextMessages = await deleteMessageAttachment('session-1', 'message-1', 'attachment-1');
    const [session] = await listSessions();

    expect(nextMessages[0]?.attachments).toEqual([]);
    expect(session.title).toBe('Pinned title');
    expect(session.updatedAt).toBe(FIXED_NOW);
  });

  it('defaults automation settings and restores saved values from storage', async () => {
    expect((await getSettings()).automationMode).toBe(false);
    expect((await getSettings()).autoAttachPageStructureOnAutomation).toBe(true);
    expect((await getSettings()).automationMaxSteps).toBe(12);
    expect((await getSettings()).preferLatexMathOutput).toBe(false);
    expect((await getSettings()).composerSubmitBehavior).toBe('ctrl_enter_to_send');

    await saveSettings({
      ...(await getSettings()),
      autoAttachPage: true,
      autoAttachPageStructureOnAutomation: false,
      automationMaxSteps: 7,
      preferLatexMathOutput: true,
      composerSubmitBehavior: 'enter_to_send',
      automationMode: true,
    });

    await expect(getSettings()).resolves.toMatchObject({
      autoAttachPage: true,
      autoAttachPageStructureOnAutomation: false,
      automationMaxSteps: 7,
      preferLatexMathOutput: true,
      composerSubmitBehavior: 'enter_to_send',
      automationMode: true,
    });
  });
});
