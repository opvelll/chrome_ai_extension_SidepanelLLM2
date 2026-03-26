import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTranslations } from '../../src/lib/i18n';
import { SidepanelHeader } from '../../src/sidepanel/components/SidepanelHeader';
import type { Settings } from '../../src/shared/models';

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    apiKey: 'test-key',
    modelId: 'gpt-4.1-mini',
    responseTool: 'none',
    reasoningEffort: 'default',
    systemPrompt: '',
    automationSystemPrompt: '',
    locale: 'en',
    includeCurrentDateTime: true,
    includeResponseLanguageInstruction: true,
    autoAttachPage: false,
    ...overrides,
  };
}

describe('SidepanelHeader', () => {
  it('renders the current model and exposes icon actions with accessible labels', () => {
    const onOpenHistory = vi.fn();
    const onCreateSession = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <SidepanelHeader
        settings={createSettings()}
        translations={getTranslations({ locale: 'en' })}
        onOpenHistory={onOpenHistory}
        onCreateSession={onCreateSession}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByText('gpt-4.1-mini')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onOpenHistory).toHaveBeenCalledOnce();
    expect(onCreateSession).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('falls back to the untranslated empty-state label when no model is configured', () => {
    const translations = getTranslations({ locale: 'ja' });

    render(
      <SidepanelHeader
        settings={null}
        translations={translations}
        onOpenHistory={() => undefined}
        onCreateSession={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );

    expect(screen.getByText(translations.sidepanel.modelNotConfigured)).toBeTruthy();
  });
});
