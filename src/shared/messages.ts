import { z } from 'zod';
import type { ChatMessage, ChatSession, ContextAttachment, Settings, TokenUsage } from './models';

export type SuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
  };
};

export type AsyncResponse<T> = SuccessResponse<T> | ErrorResponse;

const contextAttachmentSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('selectionText'),
    text: z.string(),
    source: z.object({
      title: z.string(),
      url: z.string(),
      hostname: z.string(),
      pathname: z.string(),
      capturedAt: z.string(),
      tabId: z.number().optional(),
    }),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('pageText'),
    text: z.string(),
    source: z.object({
      title: z.string(),
      url: z.string(),
      hostname: z.string(),
      pathname: z.string(),
      capturedAt: z.string(),
      tabId: z.number().optional(),
    }),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('screenshot'),
    imageDataUrl: z.string(),
    source: z.object({
      title: z.string(),
      url: z.string(),
      hostname: z.string(),
      pathname: z.string(),
      capturedAt: z.string(),
      tabId: z.number().optional(),
    }),
  }),
]);

export const chatSendRequestSchema = z.object({
  type: z.literal('chat.send'),
  payload: z.object({
    sessionId: z.string(),
    message: z.string().min(1),
    attachments: z.array(contextAttachmentSchema),
    modelId: z.string().optional(),
  }),
});

export const sessionGetRequestSchema = z.object({
  type: z.literal('session.get'),
  payload: z.object({
    sessionId: z.string(),
  }),
});

export const sessionDeleteRequestSchema = z.object({
  type: z.literal('session.delete'),
  payload: z.object({
    sessionId: z.string(),
  }),
});

export const messageDeleteRequestSchema = z.object({
  type: z.literal('message.delete'),
  payload: z.object({
    sessionId: z.string(),
    messageId: z.string(),
  }),
});

export const messageAttachmentDeleteRequestSchema = z.object({
  type: z.literal('message.attachmentDelete'),
  payload: z.object({
    sessionId: z.string(),
    messageId: z.string(),
    attachmentId: z.string(),
  }),
});

export const sessionCreateRequestSchema = z.object({
  type: z.literal('session.create'),
  payload: z
    .object({
      title: z.string().optional(),
    })
    .optional(),
});

export const settingsTestConnectionRequestSchema = z.object({
  type: z.literal('settings.testConnection'),
  payload: z.object({
    apiKey: z.string().min(1),
    modelId: z.string().optional(),
    responseTool: z.enum(['none', 'web_search']).optional(),
    reasoningEffort: z.enum(['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
  }),
});

export const settingsListModelsRequestSchema = z.object({
  type: z.literal('settings.listModels'),
  payload: z.object({
    apiKey: z.string().min(1),
  }),
});

export type ChatSendRequest = z.infer<typeof chatSendRequestSchema>;
export type SessionGetRequest = z.infer<typeof sessionGetRequestSchema>;
export type SessionDeleteRequest = z.infer<typeof sessionDeleteRequestSchema>;
export type MessageDeleteRequest = z.infer<typeof messageDeleteRequestSchema>;
export type MessageAttachmentDeleteRequest = z.infer<typeof messageAttachmentDeleteRequestSchema>;
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>;
export type SettingsTestConnectionRequest = z.infer<typeof settingsTestConnectionRequestSchema>;
export type SettingsListModelsRequest = z.infer<typeof settingsListModelsRequestSchema>;

export type SessionListRequest = {
  type: 'session.list';
};

export type ContextCaptureSelectionRequest = {
  type: 'context.captureSelection';
};

export type ContextCapturePageRequest = {
  type: 'context.capturePage';
};

export type ContextCaptureScreenshotRequest = {
  type: 'context.captureScreenshot';
};

export type ContextConsumePendingSelectionRequest = {
  type: 'context.consumePendingSelection';
};

export type ContextSelectionChangedRequest = {
  type: 'context.selectionChanged';
  payload: {
    text: string;
  };
};

export type SettingsGetRequest = {
  type: 'settings.get';
};

export type SettingsSaveRequest = {
  type: 'settings.save';
  payload: Settings;
};

export type SettingsListModelsResponse = AsyncResponse<{
  models: string[];
}>;

export type BackgroundRequest =
  | ChatSendRequest
  | SessionCreateRequest
  | SessionListRequest
  | SessionGetRequest
  | SessionDeleteRequest
  | MessageDeleteRequest
  | MessageAttachmentDeleteRequest
  | ContextCaptureSelectionRequest
  | ContextCapturePageRequest
  | ContextCaptureScreenshotRequest
  | ContextConsumePendingSelectionRequest
  | ContextSelectionChangedRequest
  | SettingsGetRequest
  | SettingsSaveRequest
  | SettingsTestConnectionRequest
  | SettingsListModelsRequest;

export type ChatSendResponse = AsyncResponse<{
  assistantMessage: ChatMessage;
  usage?: TokenUsage;
}>;

export type SessionListResponse = AsyncResponse<{
  sessions: ChatSession[];
}>;

export type SessionCreateResponse = AsyncResponse<{
  session: ChatSession;
}>;

export type SessionGetResponse = AsyncResponse<{
  session: ChatSession;
  messages: ChatMessage[];
}>;

export type ContextCaptureResponse = AsyncResponse<{
  attachment: ContextAttachment;
}>;

export type ContextConsumePendingSelectionResponse = AsyncResponse<{
  attachment: ContextAttachment | null;
}>;

export type SettingsGetResponse = AsyncResponse<{
  settings: Settings;
}>;

export type SettingsSaveResponse = AsyncResponse<{
  settings: Settings;
}>;
