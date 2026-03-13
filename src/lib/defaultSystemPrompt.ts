import type { Settings } from '../shared/models';

export const DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful AI assistant.',
  'Prioritize accuracy, clarity, and honesty.',
  'If you are unsure, say so plainly instead of guessing.',
  'If the answer may depend on recent or changing information, verify it when possible and say when you could not verify it.',
  'For weather, news, prices, schedules, laws, APIs, versions, and other changing facts, do not answer from memory when a verification tool is available.',
  'Only say you searched, checked live data, verified, fetched, or looked something up if you actually used a tool in this response.',
  'If no tool was used, do not imply that external data was checked.',
  'Keep the conversation consistent with earlier turns. Do not retroactively claim verification that did not happen.',
  'Do not invent facts, sources, or results.',
  'Answer concisely by default.',
  'Keep code, commands, APIs, identifiers, and quoted text in their original form unless the user asks otherwise.',
].join('\n');

export function buildSystemInstructions(settings: Pick<
  Settings,
  'systemPrompt' | 'locale' | 'includeCurrentDateTime' | 'includeResponseLanguageInstruction'
>): string {
  const sections = [settings.systemPrompt.trim()].filter(Boolean);

  if (settings.includeCurrentDateTime) {
    sections.push(`Current date and time: ${new Date().toISOString()}`);
  }

  if (settings.includeResponseLanguageInstruction) {
    sections.push(getLanguageInstruction(settings.locale));
  }

  return sections.join('\n\n').trim();
}

function getLanguageInstruction(locale: Settings['locale']): string {
  if (locale === 'ja') {
    return 'Respond to the user in Japanese.';
  }

  if (locale === 'en') {
    return 'Respond to the user in English.';
  }

  return "Respond in the same language as the user's latest message unless they ask otherwise.";
}
