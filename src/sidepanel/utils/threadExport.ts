import type { ChatMessage, ChatSession, ProviderTraceStep, Settings } from '../../shared/models';

type ThreadExportPayload = {
  exportedAt: string;
  session: ChatSession | null;
  sessionId: string | null;
  settings: Omit<Settings, 'apiKey'> | null;
  providerRequests: Array<ProviderTraceStep & { mode: 'chat' | 'automation' }>;
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
    sessionId: session?.id ?? null,
    settings: settings
      ? {
          modelId: settings.modelId,
          responseTool: settings.responseTool,
          reasoningEffort: settings.reasoningEffort,
          systemPrompt: settings.systemPrompt,
          automationSystemPrompt: settings.automationSystemPrompt,
          locale: settings.locale,
          includeCurrentDateTime: settings.includeCurrentDateTime,
          includeResponseLanguageInstruction: settings.includeResponseLanguageInstruction,
          preferLatexMathOutput: settings.preferLatexMathOutput,
          composerSubmitBehavior: settings.composerSubmitBehavior,
          autoAttachPage: settings.autoAttachPage,
          autoAttachPageStructureOnAutomation: settings.autoAttachPageStructureOnAutomation,
          automationMaxSteps: settings.automationMaxSteps,
          automationMode: settings.automationMode,
        }
      : null,
    providerRequests: messages.flatMap((message) =>
      message.providerTrace
        ? message.providerTrace.requests.map((request) => ({
            ...request,
            mode: message.providerTrace?.mode ?? 'chat',
          }))
        : [],
    ),
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
