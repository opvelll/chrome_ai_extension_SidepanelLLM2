import type { Settings } from '../shared/models';
import { DEFAULT_AUTOMATION_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from './defaultSystemPrompt';

const DEV_DEFAULT_SETTINGS: Settings = {
  apiKey: import.meta.env.DEV ? import.meta.env.VITE_DEV_OPENAI_API_KEY ?? '' : '',
  modelId: 'gpt-5.4',
  responseTool: 'web_search',
  reasoningEffort: 'default',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  automationSystemPrompt: DEFAULT_AUTOMATION_SYSTEM_PROMPT,
  locale: 'auto',
  includeCurrentDateTime: true,
  includeResponseLanguageInstruction: true,
  preferLatexMathOutput: false,
  composerSubmitBehavior: 'ctrl_enter_to_send',
  autoAttachPage: false,
  autoAttachPageStructureOnAutomation: true,
  automationMaxSteps: 12,
  automationMode: false,
};

export function getDefaultSettings(): Settings {
  return { ...DEV_DEFAULT_SETTINGS };
}

export function hasDevDefaultApiKey(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_DEV_OPENAI_API_KEY);
}
