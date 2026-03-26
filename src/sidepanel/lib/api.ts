import { sendRuntimeMessage } from '../../lib/runtime';
import type { ChatMessage, ContextAttachment, ChatSession, Settings } from '../../shared/models';

export type CaptureRequestType =
  | 'context.captureSelection'
  | 'context.capturePage'
  | 'context.capturePageStructure'
  | 'context.captureScreenshot';

export function getSettings() {
  return sendRuntimeMessage<{ settings: Settings }>({ type: 'settings.get' });
}

export function saveSettings(settings: Settings) {
  return sendRuntimeMessage<{ settings: Settings }>({
    type: 'settings.save',
    payload: settings,
  });
}

export function listSessions() {
  return sendRuntimeMessage<{ sessions: ChatSession[] }>({ type: 'session.list' });
}

export function getSession(sessionId: string) {
  return sendRuntimeMessage<{ session: ChatSession; messages: ChatMessage[] }>({
    type: 'session.get',
    payload: { sessionId },
  });
}

export function createSession(title: string) {
  return sendRuntimeMessage<{ session: ChatSession }>({
    type: 'session.create',
    payload: { title },
  });
}

export function deleteSession(sessionId: string) {
  return sendRuntimeMessage<{ sessionId: string }>({
    type: 'session.delete',
    payload: { sessionId },
  });
}

export function deleteMessage(sessionId: string, messageId: string) {
  return sendRuntimeMessage<{ messages: ChatMessage[] }>({
    type: 'message.delete',
    payload: { sessionId, messageId },
  });
}

export function deleteMessageAttachment(sessionId: string, messageId: string, attachmentId: string) {
  return sendRuntimeMessage<{ messages: ChatMessage[] }>({
    type: 'message.attachmentDelete',
    payload: { sessionId, messageId, attachmentId },
  });
}

export function captureAttachment(type: CaptureRequestType) {
  return sendRuntimeMessage<{ attachment: ContextAttachment }>({ type });
}

export function sendChatMessage(
  sessionId: string,
  message: string,
  attachments: ContextAttachment[],
  modelId?: string,
) {
  return sendRuntimeMessage<{ assistantMessage: ChatMessage; userMessageId: string }>({
    type: 'chat.send',
    payload: {
      sessionId,
      message,
      attachments,
      modelId,
    },
  });
}

export function runAutomationMessage(
  sessionId: string,
  message: string,
  attachments: ContextAttachment[],
  modelId?: string,
) {
  return sendRuntimeMessage<{ assistantMessage: ChatMessage; userMessageId: string }>({
    type: 'automation.run',
    payload: {
      sessionId,
      message,
      attachments,
      modelId,
    },
  });
}

export function getDefaultSessionTitle(translations: { sidepanel: { defaultSessionTitle: string } }) {
  return translations.sidepanel.defaultSessionTitle;
}

export function getSessionListActiveId(
  sessions: ChatSession[],
  activeSessionId: string,
  selectNewest = false,
) {
  if (selectNewest) {
    return sessions[0]?.id ?? '';
  }

  if (activeSessionId && sessions.some((session) => session.id === activeSessionId)) {
    return activeSessionId;
  }

  return sessions[0]?.id ?? '';
}
