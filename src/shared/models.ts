export type AttachmentKind = 'selectionText' | 'pageText' | 'screenshot';

export type TabSource = {
  tabId?: number;
  url?: string;
  title?: string;
};

export type ContextAttachment =
  | {
      id: string;
      kind: 'selectionText';
      text: string;
      source: TabSource;
    }
  | {
      id: string;
      kind: 'pageText';
      text: string;
      source: TabSource;
    }
  | {
      id: string;
      kind: 'screenshot';
      imageDataUrl: string;
      source: TabSource;
    };

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ContextAttachment[];
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  baseUrl: string;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  modelId: 'gpt-4.1-mini',
  systemPrompt: '',
  baseUrl: 'https://api.openai.com/v1/chat/completions',
};
