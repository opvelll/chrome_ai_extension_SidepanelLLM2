import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SYSTEM_PROMPT } from '../../src/lib/defaultSystemPrompt';
import { sendChatCompletion } from '../../src/lib/provider';
import type { ChatMessage, ContextAttachment, Settings } from '../../src/shared/models';

const createMock = vi.hoisted(() => {
  const create = vi.fn();
  const list = vi.fn();
  return { create, list };
});

vi.mock('openai', () => {
  class MockOpenAI {
    responses = {
      create: createMock.create,
    };

    models = {
      list: createMock.list,
    };
  }

  return {
    default: MockOpenAI,
  };
});

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    apiKey: 'test-key',
    modelId: 'gpt-4.1-mini',
    responseTool: 'none',
    reasoningEffort: 'default',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    locale: 'ja',
    includeCurrentDateTime: true,
    includeResponseLanguageInstruction: true,
    autoAttachPage: false,
    ...overrides,
  };
}

function createSource() {
  return {
    title: 'Fixture Article',
    url: 'https://example.com/articles/fixture',
    hostname: 'example.com',
    pathname: '/articles/fixture',
    capturedAt: '2026-03-13T00:00:00.000Z',
    tabId: 42,
  };
}

describe('sendChatCompletion', () => {
  beforeEach(() => {
    createMock.create.mockReset();
    createMock.list.mockReset();
    createMock.create.mockResolvedValue({
      output_text: 'Assistant reply',
      output: [],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
    });
  });

  it('sends screenshot source details alongside the image', async () => {
    const attachment: ContextAttachment = {
      id: 'attachment-1',
      kind: 'screenshot',
      imageDataUrl: 'data:image/png;base64,abc',
      source: createSource(),
    };
    const userMessage: ChatMessage = {
      id: 'message-1',
      role: 'user',
      content: 'What is on this page?',
      createdAt: '2026-03-13T00:00:00.000Z',
    };

    await sendChatCompletion({
      settings: createSettings(),
      userMessage,
      history: [],
      attachments: [attachment],
    });

    expect(createMock.create).toHaveBeenCalledTimes(1);

    const request = createMock.create.mock.calls[0]?.[0];
    const userInput = request.input[0];
    expect(userInput.role).toBe('user');
    expect(userInput.content).toEqual([
      {
        type: 'input_text',
        text: 'What is on this page?',
      },
      {
        type: 'input_text',
        text: [
          'Attachment type: Screenshot',
          'Source details:',
          'Title: Fixture Article',
          'URL: https://example.com/articles/fixture',
          'Hostname: example.com',
          'Path: /articles/fixture',
          'Captured at: 2026-03-13T00:00:00.000Z',
          'Tab ID: 42',
          'Content: Screenshot image attached separately.',
        ].join('\n'),
      },
      {
        type: 'input_image',
        detail: 'auto',
        image_url: 'data:image/png;base64,abc',
      },
    ]);
  });

  it('uses the saved system prompt as the main instructions body', async () => {
    const userMessage: ChatMessage = {
      id: 'message-1',
      role: 'user',
      content: 'Summarize this.',
      createdAt: '2026-03-13T00:00:00.000Z',
    };

    await sendChatCompletion({
      settings: createSettings({
        locale: 'en',
        systemPrompt: 'You are a terse assistant.\nPrefer bullet points when helpful.',
      }),
      userMessage,
      history: [],
      attachments: [],
    });

    const request = createMock.create.mock.calls[0]?.[0];
    expect(request.instructions).toContain('You are a terse assistant.');
    expect(request.instructions).toContain('Prefer bullet points when helpful.');
    expect(request.instructions).toContain('Current date and time:');
    expect(request.instructions).toContain('Respond to the user in English.');
    expect(request.instructions).not.toContain('Additional instructions:');
  });

  it('omits optional embedded context when disabled', async () => {
    const userMessage: ChatMessage = {
      id: 'message-1',
      role: 'user',
      content: 'Summarize this.',
      createdAt: '2026-03-13T00:00:00.000Z',
    };

    await sendChatCompletion({
      settings: createSettings({
        includeCurrentDateTime: false,
        includeResponseLanguageInstruction: false,
      }),
      userMessage,
      history: [],
      attachments: [],
    });

    const request = createMock.create.mock.calls[0]?.[0];
    expect(request.instructions).not.toContain('Current date and time:');
    expect(request.instructions).not.toContain('Respond to the user in');
    expect(request.instructions).not.toContain("Respond in the same language as the user's latest message");
  });
});
