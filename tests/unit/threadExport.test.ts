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
    composerSubmitBehavior: 'ctrl_enter_to_send',
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
    {
      id: 'message-2',
      role: 'assistant',
      content: 'reply',
      createdAt: '2026-01-01T00:00:05.000Z',
      providerTrace: {
        api: 'responses',
        mode: 'chat',
        requests: [
          {
            sequence: 1,
            request: {
              model: 'gpt-5.4',
              instructions: 'system',
              previousResponseId: null,
              input: [{ type: 'message', role: 'user', content: 'hello' }],
            },
            response: {
              responseId: 'resp_1',
              previousResponseId: null,
              outputText: 'reply',
              status: 'completed',
              usage: {
                promptTokens: 10,
                completionTokens: 5,
                totalTokens: 15,
              },
            },
          },
        ],
      },
    },
  ];
}

describe('threadExport', () => {
  it('keeps the current session, messages, settings, and provider request trace', () => {
    const payload = createThreadExportPayload(createSession(), createMessages(), createSettings());

    expect(payload.session?.id).toBe('session-1');
    expect(payload.sessionId).toBe('session-1');
    expect(payload.settings?.modelId).toBe('gpt-5.4');
    expect(payload.settings?.systemPrompt).toBe('system');
    expect(payload.settings?.automationSystemPrompt).toBe('automation');
    expect(payload.settings).not.toHaveProperty('apiKey');
    expect(payload.providerRequests).toEqual([
      expect.objectContaining({
        mode: 'chat',
        sequence: 1,
        request: expect.objectContaining({
          previousResponseId: null,
        }),
        response: expect.objectContaining({
          responseId: 'resp_1',
        }),
      }),
    ]);
    expect(payload.messages).toHaveLength(2);
    expect(payload.exportedAt).toMatch(/T/);
  });

  it('serializes the export payload as pretty JSON', () => {
    const serialized = serializeThreadExport(createSession(), createMessages(), createSettings());

    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized).toContain('\n  "session"');
    expect(serialized).toContain('"message-1"');
    expect(serialized).toContain('"sessionId": "session-1"');
    expect(serialized).toContain('"providerRequests"');
  });
});
