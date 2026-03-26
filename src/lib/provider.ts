import OpenAI from 'openai';
import type {
  EasyInputMessage,
  Response,
  ResponseFunctionToolCall,
  ResponseInputContent,
  ResponseInputItem,
  Tool,
} from 'openai/resources/responses/responses';
import type { Reasoning } from 'openai/resources/shared';
import { attachmentPromptText } from './attachments';
import {
  AUTOMATION_MAX_STEPS,
  formatAutomationResult,
  getAutomationTools,
  parseAutomationToolCall,
} from './automation';
import { buildSystemInstructions } from './defaultSystemPrompt';
import { resolveLocale } from './i18n';
import type { ChatLogData, ChatMessage, ChatMessageToolUsage, ContextAttachment, Settings, TokenUsage } from '../shared/models';

type ProviderResult = {
  assistantMessage: ChatMessage;
  logMessages: ChatMessage[];
  usage?: TokenUsage;
};

function createClient(settings: Settings): OpenAI {
  return new OpenAI({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });
}

function assertApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }
}

export async function listAvailableModels(apiKey: string): Promise<string[]> {
  assertApiKey(apiKey);

  const client = createClient({
    apiKey,
    modelId: '',
    responseTool: 'web_search',
    reasoningEffort: 'default',
    systemPrompt: '',
    automationSystemPrompt: '',
    locale: 'auto',
    includeCurrentDateTime: true,
    includeResponseLanguageInstruction: true,
    autoAttachPage: false,
    autoAttachPageStructureOnAutomation: true,
    automationMaxSteps: AUTOMATION_MAX_STEPS,
    automationMode: false,
  });

  const response = await client.models.list();
  return response.data
    .map((model) => model.id)
    .filter((modelId, index, list) => Boolean(modelId) && list.indexOf(modelId) === index)
    .sort((left, right) => left.localeCompare(right));
}

export async function sendChatCompletion(input: {
  settings: Settings;
  userMessage: ChatMessage;
  history: ChatMessage[];
  attachments: ContextAttachment[];
  modelId?: string;
}): Promise<ProviderResult> {
  const { settings, userMessage, history, attachments, modelId } = input;

  assertApiKey(settings.apiKey);

  const client = createClient(settings);
  const messages = buildInputMessages(history, userMessage, attachments);

  const response = await client.responses.create({
    model: modelId || settings.modelId,
    input: messages,
    instructions: buildSystemInstructions(settings, settings.systemPrompt) || undefined,
    tools: getResponseTools(settings),
    include: getResponseIncludes(settings),
    reasoning: getReasoning(settings),
  });
  const content = extractResponseText(response);
  const toolUsage = settings.responseTool === 'web_search'
    ? extractToolUsage(response)
    : undefined;

  if (!content) {
    throw new Error('Provider returned an empty response.');
  }

  return {
    logMessages: extractResponseLogMessages(response, settings),
    assistantMessage: {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      toolUsage,
    },
    usage: {
      promptTokens: response.usage?.input_tokens,
      completionTokens: response.usage?.output_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
}

export async function runAutomationCompletion(input: {
  settings: Settings;
  userMessage: ChatMessage;
  history: ChatMessage[];
  attachments: ContextAttachment[];
  modelId?: string;
  executeToolCall: (toolCall: ResponseFunctionToolCall) => Promise<unknown>;
}): Promise<ProviderResult> {
  const { settings, userMessage, history, attachments, modelId, executeToolCall } = input;

  assertApiKey(settings.apiKey);

  const client = createClient(settings);
  const tools = getResponseTools(settings, { includeAutomation: true });
  const instructions = buildSystemInstructions(settings, settings.automationSystemPrompt);
  const logMessages: ChatMessage[] = [];
  let response = await client.responses.create({
    model: modelId || settings.modelId,
    input: buildInputMessages(history, userMessage, attachments),
    instructions,
    tools,
    include: getResponseIncludes(settings),
    reasoning: getReasoning(settings),
    parallel_tool_calls: false,
  });

  const automationMaxSteps = Math.max(1, settings.automationMaxSteps || AUTOMATION_MAX_STEPS);

  for (let step = 0; step < automationMaxSteps; step += 1) {
    const functionCalls = response.output.filter((item): item is ResponseFunctionToolCall => item.type === 'function_call');
    logMessages.push(...extractResponseLogMessages(response, settings, { step: step + 1, includeFunctionCalls: true }));

    if (functionCalls.length === 0) {
      const content = extractResponseText(response);
      if (!content) {
        throw new Error('Provider returned an empty response.');
      }

      return {
        logMessages,
        assistantMessage: {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          createdAt: new Date().toISOString(),
        },
        usage: {
          promptTokens: response.usage?.input_tokens,
          completionTokens: response.usage?.output_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      };
    }

    const toolOutputs: ResponseInputItem[] = [];

    for (const functionCall of functionCalls) {
      const toolCall = parseAutomationToolCall(functionCall.name, functionCall.arguments);
      try {
        const result = await executeToolCall(functionCall);
        logMessages.push(
          createLogMessage({
            title: translate(settings, 'toolResultTitle'),
            summary: toolCall.name,
            body: safePrettyJson(formatAutomationLogResult(result)),
            level: 'success',
            category: 'result',
            details: [
              { label: translate(settings, 'stepLabel'), value: String(step + 1) },
              { label: translate(settings, 'statusLabel'), value: translate(settings, 'statusSuccess') },
            ],
          }),
        );
        toolOutputs.push({
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: formatAutomationResult(createAutomationToolOutput(result)),
        });
        const toolResultMessage = buildAutomationToolResultMessage(result);
        if (toolResultMessage) {
          toolOutputs.push(toolResultMessage);
        }
      } catch (error) {
        logMessages.push(
          createLogMessage({
            title: translate(settings, 'toolResultTitle'),
            summary: toolCall.name,
            body: error instanceof Error ? error.message : 'Automation tool execution failed.',
            level: 'error',
            category: 'error',
            expandedByDefault: true,
            details: [
              { label: translate(settings, 'stepLabel'), value: String(step + 1) },
              { label: translate(settings, 'statusLabel'), value: translate(settings, 'statusFailed') },
            ],
          }),
        );
        toolOutputs.push({
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: formatAutomationResult({
            ok: false,
            error: error instanceof Error ? error.message : 'Automation tool execution failed.',
          }),
        });
      }
    }

    response = await client.responses.create({
      model: modelId || settings.modelId,
      previous_response_id: response.id,
      input: toolOutputs,
      instructions,
      tools,
      include: getResponseIncludes(settings),
      reasoning: getReasoning(settings),
      parallel_tool_calls: false,
    });
  }

  throw new Error(`Automation stopped after reaching the ${automationMaxSteps}-step limit.`);
}

function buildInputMessages(
  history: ChatMessage[],
  userMessage: ChatMessage,
  attachments: ContextAttachment[],
): EasyInputMessage[] {
  const messages: EasyInputMessage[] = history
    .filter((message): message is ChatMessage & { role: 'system' | 'user' | 'assistant' } => message.role !== 'log')
    .map((message) => ({
      type: 'message',
      role: message.role,
      content: message.content,
    }));

  const contentParts: ResponseInputContent[] = [
    {
      type: 'input_text',
      text: userMessage.content,
    },
  ];

  for (const attachment of attachments) {
    contentParts.push(...buildAttachmentContentParts(attachment));
  }

  messages.push({
    type: 'message',
    role: 'user',
    content: contentParts,
  });

  return messages;
}

function buildAttachmentContentParts(attachment: ContextAttachment): ResponseInputContent[] {
  if (attachment.kind === 'screenshot') {
    return [
      {
        type: 'input_text',
        text: attachmentPromptText(attachment),
      },
      {
        type: 'input_image',
        detail: 'auto',
        image_url: attachment.imageDataUrl,
      },
    ];
  }

  return [
    {
      type: 'input_text',
      text: attachmentPromptText(attachment),
    },
  ];
}

function isScreenshotAttachment(value: unknown): value is Extract<ContextAttachment, { kind: 'screenshot' }> {
  return Boolean(
    value
      && typeof value === 'object'
      && 'kind' in value
      && (value as { kind?: unknown }).kind === 'screenshot'
      && 'imageDataUrl' in value,
  );
}

function createAutomationToolOutput(result: unknown): { ok: true; result: unknown } {
  if (isScreenshotAttachment(result)) {
    return {
      ok: true,
      result: {
        kind: result.kind,
        source: result.source,
      },
    };
  }

  return {
    ok: true,
    result,
  };
}

function buildAutomationToolResultMessage(result: unknown): ResponseInputItem | null {
  if (!isScreenshotAttachment(result)) {
    return null;
  }

  return {
    type: 'message',
    role: 'user',
    content: buildAttachmentContentParts(result),
  };
}

function formatAutomationLogResult(result: unknown): unknown {
  if (isScreenshotAttachment(result)) {
    return {
      kind: result.kind,
      source: result.source,
      imageDataUrl: '[omitted]',
    };
  }

  return result;
}

function getResponseTools(settings: Settings, options?: { includeAutomation?: boolean }): Tool[] | undefined {
  if (options?.includeAutomation) {
    return [{ type: 'computer' }, ...getAutomationTools()];
  }

  const tools: Tool[] = [];

  if (settings.responseTool === 'web_search') {
    tools.push({ type: 'web_search_preview' });
  }

  return tools.length > 0 ? tools : undefined;
}

function getResponseIncludes(settings: Settings): Array<'web_search_call.action.sources'> | undefined {
  if (settings.responseTool !== 'web_search') {
    return undefined;
  }

  return ['web_search_call.action.sources'];
}

function getReasoning(settings: Settings): Reasoning | undefined {
  if (settings.reasoningEffort === 'default') {
    return undefined;
  }

  return { effort: settings.reasoningEffort };
}

function extractResponseText(response: Response): string {
  const directText = response.output_text.trim();
  if (directText) {
    return directText;
  }

  return response.output
    .flatMap((item) => (item.type === 'message' ? item.content : []))
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

function extractToolUsage(response: Response): ChatMessageToolUsage {
  const webSearchCalls = response.output.filter((item) => item.type === 'web_search_call');
  if (webSearchCalls.length === 0) {
    return {
      webSearchUsed: false,
      webSearchQueries: [],
    };
  }

  const webSearchQueries = Array.from(new Set(
    webSearchCalls.flatMap((item) => {
      const queries = 'queries' in item.action && Array.isArray(item.action.queries) ? item.action.queries : [];
      if (queries.length > 0) {
        return queries;
      }

      const query = 'query' in item.action && typeof item.action.query === 'string' ? item.action.query : '';
      return query ? [query] : [];
    }),
  )).filter(Boolean);

  return {
    webSearchUsed: true,
    webSearchQueries,
  };
}

function extractResponseLogMessages(
  response: Response,
  settings: Settings,
  options?: { step?: number; includeFunctionCalls?: boolean },
): ChatMessage[] {
  const logs: ChatMessage[] = [];

  for (const item of response.output) {
    if (item.type === 'reasoning') {
      const summary = extractReasoningSummary(item);
      if (summary) {
        logs.push(
          createLogMessage({
            title: translate(settings, 'reasoningTitle'),
            summary: options?.step ? `${translate(settings, 'stepLabel')} ${options.step}` : undefined,
            body: summary,
            level: 'info',
            category: 'reasoning',
          }),
        );
      }
      continue;
    }

    if (item.type === 'web_search_call') {
      const queries = Array.from(new Set(getWebSearchQueries(item))).filter(Boolean);
      logs.push(
        createLogMessage({
          title: translate(settings, 'webSearchTitle'),
          summary: queries[0] || translate(settings, 'webSearchNoQuery'),
          level: 'info',
          category: 'tool',
          details: [
            ...(options?.step ? [{ label: translate(settings, 'stepLabel'), value: String(options.step) }] : []),
            { label: translate(settings, 'statusLabel'), value: String(item.status ?? 'completed') },
            ...(queries.length > 0
              ? [{ label: translate(settings, 'queriesLabel'), value: queries.join('\n') }]
              : []),
          ],
        }),
      );
      continue;
    }

    if (options?.includeFunctionCalls && item.type === 'function_call') {
      logs.push(
        createLogMessage({
          title: translate(settings, 'toolCallTitle'),
          summary: item.name,
          body: formatToolArguments(item.arguments),
          level: 'info',
          category: 'tool',
          details: [
            ...(options?.step ? [{ label: translate(settings, 'stepLabel'), value: String(options.step) }] : []),
            { label: translate(settings, 'callIdLabel'), value: item.call_id },
            { label: translate(settings, 'statusLabel'), value: String(item.status ?? 'completed') },
          ],
          expandedByDefault: true,
        }),
      );
    }
  }

  return logs;
}

function createLogMessage(log: ChatLogData): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'log',
    content: log.summary || log.title,
    createdAt: new Date().toISOString(),
    log,
  };
}

export function createErrorLogMessage(settings: Settings, error: unknown, summary?: string): ChatMessage {
  const message = error instanceof Error ? error.message : 'Request failed.';
  return createLogMessage({
    title: translate(settings, 'errorTitle'),
    summary,
    body: message,
    level: 'error',
    category: 'error',
    expandedByDefault: true,
  });
}

function extractReasoningSummary(item: Extract<Response['output'][number], { type: 'reasoning' }>): string {
  const candidate = 'summary' in item ? item.summary : undefined;
  if (!Array.isArray(candidate)) {
    return '';
  }

  return candidate
    .map((summaryItem) => {
      if (!summaryItem || typeof summaryItem !== 'object') {
        return '';
      }

      const text = 'text' in summaryItem ? summaryItem.text : undefined;
      return typeof text === 'string' ? text.trim() : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getWebSearchQueries(item: Extract<Response['output'][number], { type: 'web_search_call' }>): string[] {
  const action = item.action as unknown as Record<string, unknown>;
  const queries = Array.isArray(action.queries) ? action.queries.filter((value): value is string => typeof value === 'string') : [];

  if (queries.length > 0) {
    return queries;
  }

  return typeof action.query === 'string' ? [action.query] : [];
}

function formatToolArguments(rawArguments: string): string {
  if (!rawArguments.trim()) {
    return '';
  }

  try {
    return safePrettyJson(JSON.parse(rawArguments));
  } catch {
    return rawArguments;
  }
}

function safePrettyJson(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function translate(settings: Settings, key: ProviderTranslationKey): string {
  return providerTranslations[key][resolveLocale(settings)];
}

type ProviderTranslationKey =
  | 'reasoningTitle'
  | 'webSearchTitle'
  | 'webSearchNoQuery'
  | 'toolCallTitle'
  | 'toolResultTitle'
  | 'errorTitle'
  | 'queriesLabel'
  | 'statusLabel'
  | 'callIdLabel'
  | 'stepLabel'
  | 'statusSuccess'
  | 'statusFailed';

const providerTranslations: Record<ProviderTranslationKey, Record<'en' | 'ja', string>> = {
  reasoningTitle: { en: 'Reasoning', ja: 'Reasoning' },
  webSearchTitle: { en: 'Web search', ja: 'Web 検索' },
  webSearchNoQuery: { en: 'Search request', ja: '検索リクエスト' },
  toolCallTitle: { en: 'Tool call', ja: 'Tool 呼び出し' },
  toolResultTitle: { en: 'Tool result', ja: 'Tool 実行結果' },
  errorTitle: { en: 'Error', ja: 'エラー' },
  queriesLabel: { en: 'Queries', ja: 'Queries' },
  statusLabel: { en: 'Status', ja: 'Status' },
  callIdLabel: { en: 'Call ID', ja: 'Call ID' },
  stepLabel: { en: 'Step', ja: 'Step' },
  statusSuccess: { en: 'success', ja: 'success' },
  statusFailed: { en: 'failed', ja: 'failed' },
};
