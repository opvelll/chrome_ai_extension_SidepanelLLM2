import {
  chatSendRequestSchema,
  messageAttachmentDeleteRequestSchema,
  messageDeleteRequestSchema,
  sessionCreateRequestSchema,
  sessionDeleteRequestSchema,
  sessionGetRequestSchema,
  settingsTestConnectionRequestSchema,
  type BackgroundRequest,
  type ErrorResponse,
} from '../shared/messages';
import type { ChatMessage, ContextAttachment, TabSource } from '../shared/models';
import { appendMessages, createSession, deleteMessage, deleteMessageAttachment, deleteSession, getSession, getSettings, listMessages, listSessions, saveSettings } from '../lib/storage';
import { sendChatCompletion } from '../lib/provider';

const SESSION_STORAGE_KEYS = {
  pendingSelections: 'pendingSelections',
} as const;

type PendingSelectionStore = Record<string, { text: string; source: TabSource; updatedAt: string }>;

type MessageResponse =
  | Awaited<ReturnType<typeof handleChatSend>>
  | { ok: true; data: { session: Awaited<ReturnType<typeof createSession>> } }
  | { ok: true; data: { sessions: Awaited<ReturnType<typeof listSessions>> } }
  | { ok: true; data: { session: NonNullable<Awaited<ReturnType<typeof getSession>>>; messages: Awaited<ReturnType<typeof listMessages>> } }
  | { ok: true; data: { sessionId: string } }
  | { ok: true; data: { messages: ChatMessage[] } }
  | { ok: true; data: { attachment: ContextAttachment } }
  | { ok: true; data: { attachment: ContextAttachment | null } }
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

function canInjectContentScript(tab: chrome.tabs.Tab): boolean {
  const url = tab.url ?? '';

  if (!url) {
    return false;
  }

  return /^https?:\/\//.test(url);
}

function getTabSource(tab: chrome.tabs.Tab): TabSource {
  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title,
  };
}

async function readPendingSelections(): Promise<PendingSelectionStore> {
  const result = await chrome.storage.session.get(SESSION_STORAGE_KEYS.pendingSelections);
  return (result[SESSION_STORAGE_KEYS.pendingSelections] as PendingSelectionStore | undefined) ?? {};
}

async function writePendingSelections(store: PendingSelectionStore): Promise<void> {
  await chrome.storage.session.set({ [SESSION_STORAGE_KEYS.pendingSelections]: store });
}

function installContentBridge() {
  const globalState = window as Window & {
    __sidepanelContextBridgeInstalled__?: boolean;
    __sidepanelLastSelection__?: string;
  };

  if (globalState.__sidepanelContextBridgeInstalled__) {
    return;
  }

  globalState.__sidepanelContextBridgeInstalled__ = true;

  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

  const getPageText = () => {
    const article = document.querySelector('main, article, [role="main"]');
    const source = article?.textContent || document.body?.innerText || '';
    return normalizeText(source).slice(0, 12000);
  };

  const publishSelectionSnapshot = async () => {
    const nextSelection = normalizeText(window.getSelection()?.toString() ?? '');

    if (nextSelection === globalState.__sidepanelLastSelection__) {
      return;
    }

    globalState.__sidepanelLastSelection__ = nextSelection;

    try {
      await chrome.runtime.sendMessage({
        type: 'context.selectionChanged',
        payload: { text: nextSelection },
      });
    } catch {
      // Ignore transient runtime disconnects.
    }
  };

  document.addEventListener('selectionchange', () => {
    void publishSelectionSnapshot();
  });

  document.addEventListener('mouseup', () => {
    void publishSelectionSnapshot();
  });

  document.addEventListener('keyup', () => {
    void publishSelectionSnapshot();
  });

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.type === 'content.getSelection') {
      const selection = window.getSelection()?.toString() ?? '';
      sendResponse({ text: normalizeText(selection) });
      return;
    }

    if (request?.type === 'content.getPageText') {
      sendResponse({ text: getPageText() });
    }
  });
}

async function sendContentRequest<T>(type: 'content.getSelection' | 'content.getPageText'): Promise<{ text: string; source: TabSource }> {
  const tab = await getActiveTab();
  const tabId = tab.id;
  if (tabId === undefined) {
    throw new Error('No active tab found.');
  }
  let result: { text?: string } | undefined;

  try {
    result = (await chrome.tabs.sendMessage(tabId, { type })) as { text?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (!message.includes('Receiving end does not exist')) {
      throw error;
    }

    if (!canInjectContentScript(tab)) {
      throw new Error('This page does not allow context capture. Open a regular website tab and try again.');
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: installContentBridge,
    });

    result = (await chrome.tabs.sendMessage(tabId, { type })) as { text?: string };
  }

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

async function handleContextCapture(type: 'context.captureSelection' | 'context.capturePage' | 'context.captureScreenshot'): Promise<MessageResponse> {
  const attachment =
    type === 'context.captureSelection'
      ? await captureSelection()
      : type === 'context.capturePage'
        ? await capturePage()
        : await captureScreenshot();

  return { ok: true, data: { attachment } };
}

async function handlePendingSelectionChanged(
  rawRequest: Extract<BackgroundRequest, { type: 'context.selectionChanged' }>,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return { ok: true, data: { attachment: null } };
  }

  const store = await readPendingSelections();
  const nextStore = { ...store };
  const text = rawRequest.payload.text.trim();

  if (!text) {
    delete nextStore[String(tabId)];
  } else {
    nextStore[String(tabId)] = {
      text,
      source: getTabSource(sender.tab!),
      updatedAt: new Date().toISOString(),
    };
  }

  await writePendingSelections(nextStore);
  return { ok: true, data: { attachment: null } };
}

async function handleConsumePendingSelection(): Promise<MessageResponse> {
  const tab = await getActiveTab();
  const tabId = tab.id;
  const store = await readPendingSelections();
  const directMatch = tabId === undefined ? undefined : store[String(tabId)];
  const pendingEntry = directMatch
    ? [String(tabId), directMatch] as const
    : Object.entries(store).sort(([, left], [, right]) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (!pendingEntry?.[1]?.text) {
    return { ok: true, data: { attachment: null } };
  }

  const [pendingKey, pending] = pendingEntry;
  const nextStore = { ...store };
  delete nextStore[pendingKey];
  await writePendingSelections(nextStore);

  return {
    ok: true,
    data: {
      attachment: {
        id: crypto.randomUUID(),
        kind: 'selectionText',
        text: pending.text,
        source: pending.source,
      },
    },
  };
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

async function routeMessage(
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
      return handleConsumePendingSelection();
    case 'context.selectionChanged':
      return handlePendingSelectionChanged(request, sender);
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

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  (async () => {
    try {
      sendResponse(await routeMessage(request, sender));
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
