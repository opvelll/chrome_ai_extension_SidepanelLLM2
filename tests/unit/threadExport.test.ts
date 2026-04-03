import { describe, expect, it } from 'vitest';
import { createThreadExportPayload, serializeThreadExport } from '../../src/sidepanel/utils/threadExport';
import type { ChatMessage, ChatSession, Settings } from '../../src/shared/models';

function createSettings(): Settings {
  return {
    apiKey: 'test-key',
    modelId: 'gpt-5.4',
    responseTool: 'web_search',
    reasoningEffort: 'medium',
    systemPrompt: 'system',
    automationSystemPrompt: 'automation',
    locale: 'ja',
    includeCurrentDateTime: true,
    includeResponseLanguageInstruction: true,
    preferLatexMathOutput: false,
    autoAttachPage: false,
    autoAttachPageStructureOnAutomation: true,
    automationMaxSteps: 12,
    automationMode: false,
  };
}

function createSession(): ChatSession {
  return {
    id: 'session-1',
    title: 'Test session',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
  };
}

function createMessages(): ChatMessage[] {
  return [
    {
      id: 'message-1',
      role: 'user',
      content: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

describe('threadExport', () => {
  it('keeps the current session, messages, and a minimal settings subset', () => {
    const payload = createThreadExportPayload(createSession(), createMessages(), createSettings());

    expect(payload.session?.id).toBe('session-1');
    expect(payload.settings).toEqual({
      modelId: 'gpt-5.4',
      reasoningEffort: 'medium',
      responseTool: 'web_search',
      automationMode: false,
    });
    expect(payload.messages).toHaveLength(1);
    expect(payload.exportedAt).toMatch(/T/);
  });

  it('serializes the export payload as pretty JSON', () => {
    const serialized = serializeThreadExport(createSession(), createMessages(), createSettings());

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized).toContain('\n  "session"');
    expect(serialized).toContain('"message-1"');
  });
});
