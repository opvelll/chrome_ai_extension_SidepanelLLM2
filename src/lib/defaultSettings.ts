import type { Settings } from '../shared/models';

const DEV_DEFAULT_SETTINGS: Settings = {
  apiKey: import.meta.env.DEV ? import.meta.env.VITE_DEV_OPENAI_API_KEY ?? '' : '',
  modelId: import.meta.env.DEV ? import.meta.env.VITE_DEV_OPENAI_MODEL_ID ?? 'gpt-5.4' : 'gpt-5.4',
  responseTool: 'web_search',
  reasoningEffort: 'default',
  systemPrompt: import.meta.env.DEV ? import.meta.env.VITE_DEV_SYSTEM_PROMPT ?? '' : '',
  locale: 'auto',
  autoAttachPage: false,
};

export function getDefaultSettings(): Settings {
  return { ...DEV_DEFAULT_SETTINGS };
}

export function hasDevDefaultApiKey(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_DEV_OPENAI_API_KEY);
}
