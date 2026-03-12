export type AttachmentKind = 'selectionText' | 'pageText' | 'screenshot';

export type TabSource = {
  title: string;
  url: string;
  hostname: string;
  pathname: string;
  capturedAt: string;
  tabId?: number;
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
  responseTool: 'none' | 'web_search';
  systemPrompt: string;
  locale: 'auto' | 'en' | 'ja';
  autoAttachPage: boolean;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
