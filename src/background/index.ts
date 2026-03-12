import {
  chatSendRequestSchema,
  sessionCreateRequestSchema,
  sessionDeleteRequestSchema,
  sessionGetRequestSchema,
  settingsTestConnectionRequestSchema,
  type BackgroundRequest,
  type ErrorResponse,
} from '../shared/messages';
import type { ChatMessage, ContextAttachment, TabSource } from '../shared/models';
import { appendMessages, createSession, deleteSession, getSession, getSettings, listMessages, listSessions, saveSettings } from '../lib/storage';
import { sendChatCompletion } from '../lib/provider';

type MessageResponse =
  | Awaited<ReturnType<typeof handleChatSend>>
  | { ok: true; data: { session: Awaited<ReturnType<typeof createSession>> } }
  | { ok: true; data: { sessions: Awaited<ReturnType<typeof listSessions>> } }
  | { ok: true; data: { session: NonNullable<Awaited<ReturnType<typeof getSession>>>; messages: Awaited<ReturnType<typeof listMessages>> } }
  | { ok: true; data: { sessionId: string } }
  | { ok: true; data: { attachment: ContextAttachment } }
  | { ok: true; data: { settings: Awaited<ReturnType<typeof getSettings>> } }
  | { ok: true; data: { message: string } }
  | ErrorResponse;

function errorResponse(message: string, code = 'unknown_error', retryable = false): ErrorResponse {
  return {
    ok: false,
    error: { code, message, retryable },
  };
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }
  return tab;
}

function getTabSource(tab: chrome.tabs.Tab): TabSource {
  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title,
  };
}

async function sendContentRequest<T>(type: 'content.getSelection' | 'content.getPageText'): Promise<{ text: string; source: TabSource }> {
  const tab = await getActiveTab();
  const result = (await chrome.tabs.sendMessage(tab.id!, { type: type })) as { text?: string };
  return {
    text: result?.text?.trim() ?? '',
    source: getTabSource(tab),
  };
}

async function captureSelection(): Promise<ContextAttachment> {
  const { text, source } = await sendContentRequest('content.getSelection');
  if (!text) {
    throw new Error('No selected text found on the active page.');
  }
  return {
    id: crypto.randomUUID(),
    kind: 'selectionText',
    text,
    source,
  };
}

async function capturePage(): Promise<ContextAttachment> {
  const { text, source } = await sendContentRequest('content.getPageText');
  if (!text) {
    throw new Error('No readable page text found on the active page.');
  }
  return {
    id: crypto.randomUUID(),
    kind: 'pageText',
    text,
    source,
  };
}

async function captureScreenshot(): Promise<ContextAttachment> {
  const tab = await getActiveTab();
  const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  return {
    id: crypto.randomUUID(),
    kind: 'screenshot',
    imageDataUrl,
    source: getTabSource(tab),
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

async function handleContextCapture(type: 'context.captureSelection' | 'context.capturePage' | 'context.captureScreenshot'): Promise<MessageResponse> {
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
      systemPrompt: '',
      locale: 'auto',
    },
    userMessage,
    history: [],
    attachments: [],
  });

  return { ok: true, data: { message: result.assistantMessage.content } };
}

async function routeMessage(request: BackgroundRequest): Promise<MessageResponse> {
  switch (request.type) {
    case 'session.create':
      return handleSessionCreate(request);
    case 'session.list':
      return handleSessionList();
    case 'session.get':
      return handleSessionGet(request);
    case 'session.delete':
      return handleSessionDelete(request);
    case 'context.captureSelection':
    case 'context.capturePage':
    case 'context.captureScreenshot':
      return handleContextCapture(request.type);
    case 'settings.get':
      return handleSettingsGet();
    case 'settings.save':
      return handleSettingsSave(request);
    case 'settings.testConnection':
      return handleSettingsTestConnection(request);
    case 'chat.send':
      return handleChatSend(request);
    default:
      return errorResponse('Unsupported message type.', 'unsupported_message');
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  (async () => {
    try {
      sendResponse(await routeMessage(request));
    } catch (error) {
      sendResponse(
        errorResponse(
          error instanceof Error ? error.message : 'Unexpected error.',
          'unexpected_error',
        ),
      );
    }
  })();

  return true;
});
