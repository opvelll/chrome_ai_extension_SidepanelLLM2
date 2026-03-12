import OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
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
  const messages: ChatCompletionMessageParam[] = [];

  if (settings.systemPrompt.trim()) {
    messages.push({
      role: 'system',
      content: settings.systemPrompt,
    });
  }

  for (const message of history) {
    messages.push({
      role: message.role,
      content: message.content,
    });
  }

  const contentParts: ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: userMessage.content,
    },
  ];

  for (const attachment of attachments) {
    if (attachment.kind === 'screenshot') {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: attachment.imageDataUrl,
        },
      });
      continue;
    }

    contentParts.push({
      type: 'text',
      text: attachmentPromptText(attachment),
    });
  }

  messages.push({
    role: 'user',
    content: contentParts,
  });

  const response = await client.chat.completions.create({
    model: modelId || settings.modelId,
    messages,
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';

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
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
}
