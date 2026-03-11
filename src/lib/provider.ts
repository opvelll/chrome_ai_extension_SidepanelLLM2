import type { ChatMessage, ContextAttachment, Settings, TokenUsage } from '../shared/models';

type ProviderResult = {
  assistantMessage: ChatMessage;
  usage?: TokenUsage;
};

function attachmentToText(attachment: ContextAttachment): string {
  switch (attachment.kind) {
    case 'selectionText':
      return `Selected text from ${attachment.source.title ?? attachment.source.url ?? 'page'}:\n${attachment.text}`;
    case 'pageText':
      return `Page text from ${attachment.source.title ?? attachment.source.url ?? 'page'}:\n${attachment.text}`;
    case 'screenshot':
      return `Screenshot attached from ${attachment.source.title ?? attachment.source.url ?? 'page'}.`;
  }
}

export async function sendChatCompletion(input: {
  settings: Settings;
  userMessage: ChatMessage;
  history: ChatMessage[];
  attachments: ContextAttachment[];
  modelId?: string;
}): Promise<ProviderResult> {
  const { settings, userMessage, history, attachments, modelId } = input;

  if (!settings.apiKey) {
    throw new Error('API key is not configured.');
  }

  const messages: Array<Record<string, unknown>> = [];

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

  const contentParts: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: userMessage.content,
    },
  ];

  for (const attachment of attachments) {
    if (attachment.kind === 'screenshot') {
      contentParts.push({
        type: 'input_image',
        image_url: attachment.imageDataUrl,
      });
    } else {
      contentParts.push({
        type: 'text',
        text: attachmentToText(attachment),
      });
    }
  }

  messages.push({
    role: 'user',
    content: contentParts,
  });

  const response = await fetch(settings.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: modelId || settings.modelId,
      messages,
    }),
  });

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(json.error?.message ?? `Provider request failed with ${response.status}.`);
  }

  const rawContent = json.choices?.[0]?.message?.content;
  const content =
    typeof rawContent === 'string'
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.map((part) => part.text ?? '').join('\n').trim()
        : '';

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
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      totalTokens: json.usage?.total_tokens,
    },
  };
}
