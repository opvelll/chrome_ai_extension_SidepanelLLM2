import { describe, expect, it } from 'vitest';
import { groupMessagesForDisplay } from '../../src/sidepanel/utils/messageGroups';
import type { ChatMessage } from '../../src/shared/models';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    role: overrides.role ?? 'assistant',
    content: overrides.content ?? 'message',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

describe('groupMessagesForDisplay', () => {
  it('merges consecutive logs into one display group and preserves message boundaries', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      createMessage({
        id: 'log-1',
        role: 'log',
        content: 'inspect',
        log: { title: 'Tool call', summary: 'browser_inspect_page', level: 'info', category: 'tool' },
      }),
      createMessage({
        id: 'log-2',
        role: 'log',
        content: 'result',
        log: { title: 'Tool result', summary: 'ok', level: 'success', category: 'result', expandedByDefault: true },
      }),
      createMessage({ id: 'assistant-1', role: 'assistant', content: 'done' }),
    ];

    const groups = groupMessagesForDisplay(messages);

    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ type: 'message', key: 'user-1' });
    expect(groups[1]).toMatchObject({
      type: 'log-group',
      messages: [{ id: 'log-1' }, { id: 'log-2' }],
      expandedByDefault: true,
    });
    expect(groups[2]).toMatchObject({ type: 'message', key: 'assistant-1' });
  });

  it('starts a new log group after a non-log message', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'log-1',
        role: 'log',
        content: 'inspect',
        log: { title: 'Tool call', summary: 'browser_inspect_page', level: 'info', category: 'tool' },
      }),
      createMessage({ id: 'assistant-1', role: 'assistant', content: 'interruption' }),
      createMessage({
        id: 'log-2',
        role: 'log',
        content: 'click',
        log: { title: 'Tool call', summary: 'browser_click', level: 'info', category: 'tool' },
      }),
    ];

    const groups = groupMessagesForDisplay(messages);

    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ type: 'log-group' });
    expect(groups[1]).toMatchObject({ type: 'message', key: 'assistant-1' });
    expect(groups[2]).toMatchObject({ type: 'log-group' });
  });
});
