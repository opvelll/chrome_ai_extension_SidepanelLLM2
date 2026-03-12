import OpenAI from 'openai';
import type { EasyInputMessage, Response, ResponseInputContent, Tool } from 'openai/resources/responses/responses';
import { attachmentPromptText } from './attachments';
import type { ChatMessage, ContextAttachment, Settings, TokenUsage } from '../shared/models';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

type ProviderResult = {
  assistantMessage: ChatMessage;
  usage?: TokenUsage;
};

function createClient(settings: Settings): OpenAI {
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: OPENAI_BASE_URL,
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
    systemPrompt: '',
    locale: 'auto',
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

  const response = await client.responses.create({
    model: modelId || settings.modelId,
    input: messages,
    instructions: settings.systemPrompt.trim() || undefined,
    tools: getResponseTools(settings),
  });
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

function getResponseTools(settings: Settings): Tool[] | undefined {
  if (settings.responseTool !== 'web_search') {
    return undefined;
  }

  return [{ type: 'web_search_preview' }];
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
