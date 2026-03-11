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

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  (async () => {
    try {
      switch (request.type) {
        case 'session.create': {
          const parsed = sessionCreateRequestSchema.parse(request);
          const session = await createSession(parsed.payload?.title);
          sendResponse({ ok: true, data: { session } });
          return;
        }
        case 'session.list': {
          const sessions = await listSessions();
          sendResponse({ ok: true, data: { sessions } });
          return;
        }
        case 'session.get': {
          const parsed = sessionGetRequestSchema.parse(request);
          const session = await getSession(parsed.payload.sessionId);
          if (!session) {
            sendResponse(errorResponse('Session not found.', 'session_not_found'));
            return;
          }
          const messages = await listMessages(parsed.payload.sessionId);
          sendResponse({ ok: true, data: { session, messages } });
          return;
        }
        case 'session.delete': {
          const parsed = sessionDeleteRequestSchema.parse(request);
          await deleteSession(parsed.payload.sessionId);
          sendResponse({ ok: true, data: { sessionId: parsed.payload.sessionId } });
          return;
        }
        case 'context.captureSelection': {
          const attachment = await captureSelection();
          sendResponse({ ok: true, data: { attachment } });
          return;
        }
        case 'context.capturePage': {
          const attachment = await capturePage();
          sendResponse({ ok: true, data: { attachment } });
          return;
        }
        case 'context.captureScreenshot': {
          const attachment = await captureScreenshot();
          sendResponse({ ok: true, data: { attachment } });
          return;
        }
        case 'settings.get': {
          const settings = await getSettings();
          sendResponse({ ok: true, data: { settings } });
          return;
        }
        case 'settings.save': {
          const settings = await saveSettings(request.payload);
          sendResponse({ ok: true, data: { settings } });
          return;
        }
        case 'settings.testConnection': {
          const parsed = settingsTestConnectionRequestSchema.parse(request);
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
              baseUrl: parsed.payload.baseUrl ?? 'https://api.openai.com/v1/chat/completions',
            },
            userMessage,
            history: [],
            attachments: [],
          });
          sendResponse({ ok: true, data: { message: result.assistantMessage.content } });
          return;
        }
        case 'chat.send': {
          const response = await handleChatSend(request);
          sendResponse(response);
          return;
        }
        default: {
          sendResponse(errorResponse('Unsupported message type.', 'unsupported_message'));
        }
      }
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
