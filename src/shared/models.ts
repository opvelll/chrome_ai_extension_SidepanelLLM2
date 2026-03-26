export type AttachmentKind = 'selectionText' | 'pageText' | 'pageStructure' | 'screenshot';

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
      kind: 'pageStructure';
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

export type ChatMessageToolUsage = {
  webSearchUsed?: boolean;
  webSearchQueries?: string[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ContextAttachment[];
  toolUsage?: ChatMessageToolUsage;
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
  reasoningEffort: 'default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  systemPrompt: string;
  automationSystemPrompt: string;
  locale: 'auto' | 'en' | 'ja';
  includeCurrentDateTime: boolean;
  includeResponseLanguageInstruction: boolean;
  autoAttachPage: boolean;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
