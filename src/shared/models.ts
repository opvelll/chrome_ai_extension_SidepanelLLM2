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

export type ChatRole = 'system' | 'user' | 'assistant' | 'log';

export type ChatLogLevel = 'info' | 'success' | 'warning' | 'error';

export type ChatLogCategory = 'event' | 'reasoning' | 'tool' | 'result' | 'error';

export type ChatLogDetail = {
  label: string;
  value: string;
};

export type ChatLogData = {
  title: string;
  summary?: string;
  body?: string;
  level: ChatLogLevel;
  category: ChatLogCategory;
  details?: ChatLogDetail[];
  expandedByDefault?: boolean;
};

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
  log?: ChatLogData;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ComposerSubmitBehavior = 'enter_to_send' | 'ctrl_enter_to_send';

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
  preferLatexMathOutput: boolean;
  composerSubmitBehavior: ComposerSubmitBehavior;
  autoAttachPage: boolean;
  autoAttachPageStructureOnAutomation: boolean;
  automationMaxSteps: number;
  automationMode: boolean;
};

export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
