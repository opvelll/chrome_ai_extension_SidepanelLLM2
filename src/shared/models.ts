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
  locale: 'auto' | 'en' | 'ja';
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
