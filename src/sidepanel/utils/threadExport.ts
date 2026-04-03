import type { ChatMessage, ChatSession, Settings } from '../../shared/models';

type ThreadExportPayload = {
  exportedAt: string;
  session: ChatSession | null;
  settings: Pick<Settings, 'modelId' | 'reasoningEffort' | 'responseTool' | 'automationMode'> | null;
  messages: ChatMessage[];
};

export function createThreadExportPayload(
  session: ChatSession | null,
  messages: ChatMessage[],
  settings: Settings | null,
): ThreadExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    session,
    settings: settings
      ? {
          modelId: settings.modelId,
          reasoningEffort: settings.reasoningEffort,
          responseTool: settings.responseTool,
          automationMode: settings.automationMode,
        }
      : null,
    messages,
  };
}

export function serializeThreadExport(
  session: ChatSession | null,
  messages: ChatMessage[],
  settings: Settings | null,
): string {
  return JSON.stringify(createThreadExportPayload(session, messages, settings), null, 2);
}
