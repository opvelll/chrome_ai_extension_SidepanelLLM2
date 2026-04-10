import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUTOMATION_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from '../../src/lib/defaultSystemPrompt';
import { runAutomationCompletion, sendChatCompletion } from '../../src/lib/provider';
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
  const defaults: Settings = {
    apiKey: 'test-key',
    modelId: 'gpt-4.1-mini',
    responseTool: 'none',
    reasoningEffort: 'default',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    automationSystemPrompt: DEFAULT_AUTOMATION_SYSTEM_PROMPT,
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

  return { ...defaults, ...overrides };
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

  it('adds a latex math formatting instruction when enabled', async () => {
    await sendChatCompletion({
      settings: createSettings({
        preferLatexMathOutput: true,
      }),
      userMessage: {
        id: 'message-math-1',
        role: 'user',
        content: 'Explain the formula.',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      history: [],
      attachments: [],
    });

    const request = createMock.create.mock.calls[0]?.[0];
    expect(request.instructions).toContain('Use $...$ for inline math and $$...$$ for block math.');
  });

  it('records whether web search actually ran', async () => {
    createMock.create.mockResolvedValueOnce({
      output_text: 'Verified reply',
      output: [
        {
          id: 'ws_123',
          type: 'web_search_call',
          status: 'completed',
          action: {
            type: 'search',
            query: 'today weather tokyo',
            queries: ['today weather tokyo'],
            sources: [],
          },
        },
        {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: 'Verified reply',
              annotations: [],
            },
          ],
        },
      ],
      usage: {
        input_tokens: 11,
        output_tokens: 4,
        total_tokens: 15,
      },
    });

    const result = await sendChatCompletion({
      settings: createSettings({
        responseTool: 'web_search',
      }),
      userMessage: {
        id: 'message-1',
        role: 'user',
        content: 'What is the weather in Tokyo today?',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      history: [],
      attachments: [],
    });

    const request = createMock.create.mock.calls[0]?.[0];
    expect(request.include).toEqual(['web_search_call.action.sources']);
    expect(result.assistantMessage.toolUsage).toEqual({
      webSearchUsed: true,
      webSearchQueries: ['today weather tokyo'],
    });
  });

  it('stores an explicit no-search marker when web search is enabled but unused', async () => {
    const result = await sendChatCompletion({
      settings: createSettings({
        responseTool: 'web_search',
      }),
      userMessage: {
        id: 'message-1',
        role: 'user',
        content: 'Say hello.',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      history: [],
      attachments: [],
    });

    expect(result.assistantMessage.toolUsage).toEqual({
      webSearchUsed: false,
      webSearchQueries: [],
    });
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

  it('runs the automation tool loop until the model returns a final message', async () => {
    createMock.create
      .mockResolvedValueOnce({
        id: 'resp_auto_1',
        output_text: '',
        output: [
          {
            id: 'fc_1',
            type: 'function_call',
            call_id: 'call_1',
            name: 'browser_inspect_page',
            arguments: '{"maxElements":8}',
            status: 'completed',
          },
        ],
        usage: {
          input_tokens: 21,
          output_tokens: 6,
          total_tokens: 27,
        },
      })
      .mockResolvedValueOnce({
        id: 'resp_auto_2',
        output_text: 'Completed the browser task.',
        output: [
          {
            id: 'msg_2',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: 'Completed the browser task.',
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 9,
          output_tokens: 3,
          total_tokens: 12,
        },
      });

    const executeToolCall = vi.fn().mockResolvedValue({
      title: 'Fixture Article',
      url: 'https://example.com/articles/fixture',
      elements: [],
    });

    const result = await runAutomationCompletion({
      settings: createSettings({ responseTool: 'web_search' }),
      userMessage: {
        id: 'message-1',
        role: 'user',
        content: 'Open the search box and type penguin.',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      history: [],
      attachments: [],
      executeToolCall,
    });

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(executeToolCall.mock.calls[0]?.[0]).toMatchObject({
      name: 'browser_inspect_page',
      call_id: 'call_1',
    });

    const firstRequest = createMock.create.mock.calls[0]?.[0];
    expect(firstRequest.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'web_search_preview' }),
        expect.objectContaining({ type: 'function', name: 'browser_inspect_page' }),
        expect.objectContaining({ type: 'function', name: 'browser_click' }),
        expect.objectContaining({ type: 'function', name: 'browser_get_value' }),
        expect.objectContaining({ type: 'function', name: 'browser_set_value' }),
      ]),
    );
    expect(firstRequest.instructions).toContain('You are an autonomous browser operator');
    expect(firstRequest.instructions).toContain('Interpret the user request as something they want accomplished on the current page');
    expect(firstRequest.instructions).toContain('Use browser_get_value when you need to verify or read the current contents');
    expect(firstRequest.instructions).toContain('Use browser_set_value when you need to directly rewrite or replace the contents');
    expect(firstRequest.instructions).toContain('If pageChange indicates an on-page update');
    expect(firstRequest.tools).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'computer' }),
      ]),
    );

    const secondRequest = createMock.create.mock.calls[1]?.[0];
    expect(secondRequest.previous_response_id).toBe('resp_auto_1');
    expect(secondRequest.input).toEqual([
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: JSON.stringify({
          ok: true,
          result: {
            title: 'Fixture Article',
            url: 'https://example.com/articles/fixture',
            elements: [],
          },
        }),
      },
    ]);

    expect(result.assistantMessage.content).toBe('Completed the browser task.');
  });

  it('uses the configured automation step limit in the stop condition', async () => {
    createMock.create.mockResolvedValue({
      id: 'resp_auto_limit',
      output_text: '',
      output: [
        {
          id: 'fc_limit',
          type: 'function_call',
          call_id: 'call_limit',
          name: 'browser_wait',
          arguments: '{"timeoutMs":100,"selector":null,"text":null}',
          status: 'completed',
        },
      ],
      usage: {
        input_tokens: 5,
        output_tokens: 2,
        total_tokens: 7,
      },
    });

    await expect(runAutomationCompletion({
      settings: createSettings({ automationMaxSteps: 2 }),
      userMessage: {
        id: 'message-limit-1',
        role: 'user',
        content: 'Keep going.',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      history: [],
      attachments: [],
      executeToolCall: vi.fn().mockResolvedValue({ ok: true }),
    })).rejects.toThrow('Automation stopped after reaching the 2-step limit.');
  });

  it('feeds captured screenshots back into the automation loop as an image input', async () => {
    createMock.create
      .mockResolvedValueOnce({
        id: 'resp_auto_shot_1',
        output_text: '',
        output: [
          {
            id: 'fc_shot_1',
            type: 'function_call',
            call_id: 'call_shot_1',
            name: 'browser_capture_screenshot',
            arguments: '{}',
            status: 'completed',
          },
        ],
        usage: {
          input_tokens: 20,
          output_tokens: 5,
          total_tokens: 25,
        },
      })
      .mockResolvedValueOnce({
        id: 'resp_auto_shot_2',
        output_text: 'Checked the screenshot.',
        output: [
          {
            id: 'msg_shot_2',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: 'Checked the screenshot.',
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 8,
          output_tokens: 3,
          total_tokens: 11,
        },
      });

    const screenshotAttachment: ContextAttachment = {
      id: 'attachment-shot-1',
      kind: 'screenshot',
      imageDataUrl: 'data:image/png;base64,shot',
      source: createSource(),
    };

    await runAutomationCompletion({
      settings: createSettings(),
      userMessage: {
        id: 'message-shot-1',
        role: 'user',
        content: 'Check what is visible.',
        createdAt: '2026-03-13T00:00:00.000Z',
      },
      history: [],
      attachments: [],
      executeToolCall: vi.fn().mockResolvedValue(screenshotAttachment),
    });

    const secondRequest = createMock.create.mock.calls[1]?.[0];
    expect(secondRequest.input).toEqual([
      {
        type: 'function_call_output',
        call_id: 'call_shot_1',
        output: JSON.stringify({
          ok: true,
          result: {
            kind: 'screenshot',
            source: createSource(),
          },
        }),
      },
      {
        type: 'message',
        role: 'user',
        content: [
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
            image_url: 'data:image/png;base64,shot',
          },
        ],
      },
    ]);
  });
});
