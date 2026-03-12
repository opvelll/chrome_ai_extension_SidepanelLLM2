import {
  chatSendRequestSchema,
  messageAttachmentDeleteRequestSchema,
  messageDeleteRequestSchema,
  sessionCreateRequestSchema,
  sessionDeleteRequestSchema,
  sessionGetRequestSchema,
  settingsListModelsRequestSchema,
  settingsTestConnectionRequestSchema,
  type BackgroundRequest,
  type ErrorResponse,
} from '../shared/messages';
import type { ChatMessage, ContextAttachment } from '../shared/models';
import {
  appendMessages,
  createSession,
  deleteMessage,
  deleteMessageAttachment,
  deleteSession,
  getSession,
  getSettings,
  listMessages,
  listSessions,
  saveSettings,
} from '../lib/storage';
import { listAvailableModels, sendChatCompletion } from '../lib/provider';
import { capturePage, captureScreenshot, captureSelection } from './contextCapture';
import { consumePendingSelection, updatePendingSelection } from './pendingSelections';

type MessageResponse =
  | Awaited<ReturnType<typeof handleChatSend>>
  | { ok: true; data: { session: Awaited<ReturnType<typeof createSession>> } }
  | { ok: true; data: { sessions: Awaited<ReturnType<typeof listSessions>> } }
  | {
      ok: true;
      data: {
        session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
        messages: Awaited<ReturnType<typeof listMessages>>;
      };
    }
  | { ok: true; data: { sessionId: string } }
  | { ok: true; data: { messages: ChatMessage[] } }
  | { ok: true; data: { attachment: ContextAttachment } }
  | { ok: true; data: { attachment: ContextAttachment | null } }
  | { ok: true; data: { settings: Awaited<ReturnType<typeof getSettings>> } }
  | { ok: true; data: { models: string[] } }
  | { ok: true; data: { message: string } }
  | ErrorResponse;

function errorResponse(message: string, code = 'unknown_error', retryable = false): ErrorResponse {
  return {
    ok: false,
    error: { code, message, retryable },
  };
}

async function handleChatSend(rawRequest: unknown) {
  const request = chatSendRequestSchema.parse(rawRequest);
  const settings = await getSettings();
  const session = await getSession(request.payload.sessionId);

  if (!session) {
    return errorResponse('Session not found.', 'session_not_found');
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: request.payload.message,
    createdAt: new Date().toISOString(),
    attachments: request.payload.attachments,
  };

  const history = await listMessages(session.id);
  await appendMessages(session.id, [userMessage]);

  try {
    const result = await sendChatCompletion({
      settings,
      userMessage,
      history,
      attachments: request.payload.attachments,
      modelId: request.payload.modelId,
    });

    await appendMessages(session.id, [result.assistantMessage]);
    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Chat request failed.',
      'provider_error',
      true,
    );
  }
}

async function handleSessionCreate(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = sessionCreateRequestSchema.parse(rawRequest);
  const session = await createSession(parsed.payload?.title);
  return { ok: true, data: { session } };
}

async function handleSessionList(): Promise<MessageResponse> {
  const sessions = await listSessions();
  return { ok: true, data: { sessions } };
}

async function handleSessionGet(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = sessionGetRequestSchema.parse(rawRequest);
  const session = await getSession(parsed.payload.sessionId);
  if (!session) {
    return errorResponse('Session not found.', 'session_not_found');
  }

  const messages = await listMessages(parsed.payload.sessionId);
  return { ok: true, data: { session, messages } };
}

async function handleSessionDelete(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = sessionDeleteRequestSchema.parse(rawRequest);
  await deleteSession(parsed.payload.sessionId);
  return { ok: true, data: { sessionId: parsed.payload.sessionId } };
}

async function handleMessageDelete(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = messageDeleteRequestSchema.parse(rawRequest);
  const messages = await deleteMessage(parsed.payload.sessionId, parsed.payload.messageId);
  return { ok: true, data: { messages } };
}

async function handleMessageAttachmentDelete(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = messageAttachmentDeleteRequestSchema.parse(rawRequest);
  const messages = await deleteMessageAttachment(
    parsed.payload.sessionId,
    parsed.payload.messageId,
    parsed.payload.attachmentId,
  );
  return { ok: true, data: { messages } };
}

async function handleContextCapture(
  type: 'context.captureSelection' | 'context.capturePage' | 'context.captureScreenshot',
): Promise<MessageResponse> {
  const attachment =
    type === 'context.captureSelection'
      ? await captureSelection()
      : type === 'context.capturePage'
        ? await capturePage()
        : await captureScreenshot();

  return { ok: true, data: { attachment } };
}

async function handleSettingsGet(): Promise<MessageResponse> {
  const settings = await getSettings();
  return { ok: true, data: { settings } };
}

async function handleSettingsSave(
  rawRequest: Extract<BackgroundRequest, { type: 'settings.save' }>,
): Promise<MessageResponse> {
  const settings = await saveSettings(rawRequest.payload);
  return { ok: true, data: { settings } };
}

async function handleSettingsTestConnection(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = settingsTestConnectionRequestSchema.parse(rawRequest);
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: 'Reply with the word "ok".',
    createdAt: new Date().toISOString(),
  };
  const result = await sendChatCompletion({
    settings: {
      apiKey: parsed.payload.apiKey,
      modelId: parsed.payload.modelId ?? 'gpt-4.1-mini',
      responseTool: parsed.payload.responseTool ?? 'web_search',
      systemPrompt: '',
      locale: 'auto',
      autoAttachPage: false,
    },
    userMessage,
    history: [],
    attachments: [],
  });

  return { ok: true, data: { message: result.assistantMessage.content } };
}

async function handleSettingsListModels(rawRequest: unknown): Promise<MessageResponse> {
  const parsed = settingsListModelsRequestSchema.parse(rawRequest);
  const models = await listAvailableModels(parsed.payload.apiKey);
  return { ok: true, data: { models } };
}

export async function routeMessage(
  request: BackgroundRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  switch (request.type) {
    case 'session.create':
      return handleSessionCreate(request);
    case 'session.list':
      return handleSessionList();
    case 'session.get':
      return handleSessionGet(request);
    case 'session.delete':
      return handleSessionDelete(request);
    case 'message.delete':
      return handleMessageDelete(request);
    case 'message.attachmentDelete':
      return handleMessageAttachmentDelete(request);
    case 'context.captureSelection':
    case 'context.capturePage':
    case 'context.captureScreenshot':
      return handleContextCapture(request.type);
    case 'context.consumePendingSelection':
      return { ok: true, data: { attachment: await consumePendingSelection() } };
    case 'context.selectionChanged':
      return { ok: true, data: { attachment: await updatePendingSelection(request, sender) } };
    case 'settings.get':
      return handleSettingsGet();
    case 'settings.save':
      return handleSettingsSave(request);
    case 'settings.testConnection':
      return handleSettingsTestConnection(request);
    case 'settings.listModels':
      return handleSettingsListModels(request);
    case 'chat.send':
      return handleChatSend(request);
    default:
      return errorResponse('Unsupported message type.', 'unsupported_message');
  }
}

export function toUnexpectedErrorResponse(error: unknown): ErrorResponse {
  return errorResponse(
    error instanceof Error ? error.message : 'Unexpected error.',
    'unexpected_error',
  );
}
