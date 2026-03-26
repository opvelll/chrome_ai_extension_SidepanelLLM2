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
import type { ChatMessage, ChatMessageToolUsage, ContextAttachment, Settings, TokenUsage } from '../shared/models';

type ProviderResult = {
  assistantMessage: ChatMessage;
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
  let response = await client.responses.create({
    model: modelId || settings.modelId,
    input: buildInputMessages(history, userMessage, attachments),
    instructions,
    tools,
    include: getResponseIncludes(settings),
    reasoning: getReasoning(settings),
    parallel_tool_calls: false,
  });

  for (let step = 0; step < AUTOMATION_MAX_STEPS; step += 1) {
    const functionCalls = response.output.filter((item): item is ResponseFunctionToolCall => item.type === 'function_call');

    if (functionCalls.length === 0) {
      const content = extractResponseText(response);
      if (!content) {
        throw new Error('Provider returned an empty response.');
      }

      return {
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
      try {
        parseAutomationToolCall(functionCall.name, functionCall.arguments);
        const result = await executeToolCall(functionCall);
        toolOutputs.push({
          type: 'function_call_output',
          call_id: functionCall.call_id,
          output: formatAutomationResult({
            ok: true,
            result,
          }),
        });
      } catch (error) {
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

  throw new Error(`Automation stopped after reaching the ${AUTOMATION_MAX_STEPS}-step limit.`);
}

function buildInputMessages(
  history: ChatMessage[],
  userMessage: ChatMessage,
  attachments: ContextAttachment[],
): EasyInputMessage[] {
  const messages: EasyInputMessage[] = history.map((message) => ({
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
    if (attachment.kind === 'screenshot') {
      contentParts.push({
        type: 'input_text',
        text: attachmentPromptText(attachment),
      });
      contentParts.push({
        type: 'input_image',
        detail: 'auto',
        image_url: attachment.imageDataUrl,
      });
      continue;
    }

    contentParts.push({
      type: 'input_text',
      text: attachmentPromptText(attachment),
    });
  }

  messages.push({
    type: 'message',
    role: 'user',
    content: contentParts,
  });

  return messages;
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
