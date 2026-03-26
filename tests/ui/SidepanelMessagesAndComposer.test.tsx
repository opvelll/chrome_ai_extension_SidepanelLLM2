import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTranslations } from '../../src/lib/i18n';
import { ComposerPanel } from '../../src/sidepanel/components/ComposerPanel';
import { MessageList } from '../../src/sidepanel/components/MessageList';
import type { ChatMessage, Settings } from '../../src/shared/models';

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
    autoAttachPageStructureOnAutomation: true,
    automationMaxSteps: 12,
    automationMode: false,
    ...overrides,
  };
}

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    role: overrides.role ?? 'assistant',
    content: overrides.content ?? 'message',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

describe('MessageList', () => {
  it('renders consecutive logs inside a single collapsible group without per-log delete buttons', () => {
    const translations = getTranslations({ locale: 'en' });

    render(
      <MessageList
        messages={[
          createMessage({ id: 'user-1', role: 'user', content: 'Do the task.' }),
          createMessage({
            id: 'log-1',
            role: 'log',
            content: 'inspect',
            log: { title: 'Tool call', summary: 'browser_inspect_page', level: 'info', category: 'tool' },
          }),
          createMessage({
            id: 'log-2',
            role: 'log',
            content: 'result',
            log: { title: 'Tool result', summary: 'ok', level: 'success', category: 'result' },
          }),
        ]}
        settings={createSettings()}
        translations={translations}
        scrollTargetMessageId=""
        onScrollTargetHandled={() => undefined}
        onDeleteMessage={() => undefined}
        onDeleteAttachment={() => undefined}
        onPreviewAttachment={() => undefined}
      />,
    );

    expect(screen.queryByText('Logs (2)')).toBeNull();
    expect(screen.getByText('Tool call')).toBeTruthy();
    expect(screen.getByText('Tool result')).toBeTruthy();

    const logRegion = document.querySelector('details');
    expect(logRegion).toBeTruthy();
    expect((logRegion as HTMLElement).textContent).toContain('2');
    expect((logRegion as HTMLElement).textContent).toContain('browser_inspect_page');
    expect((logRegion as HTMLDetailsElement).hasAttribute('open')).toBe(false);
    expect(within(logRegion as HTMLElement).queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

describe('ComposerPanel', () => {
  it('shows the current mode label and toggles automation from the icon button', () => {
    const translations = getTranslations({ locale: 'en' });
    const onToggleAutomationMode = vi.fn();

    render(
      <ComposerPanel
        attachments={[]}
        draft=""
        loading={false}
        autoAttachPage={false}
        automationMode={false}
        composerPlaceholder={translations.sidepanel.composerPlaceholder}
        contextError=""
        error=""
        settings={createSettings()}
        translations={translations}
        onCaptureSelection={() => undefined}
        onCapturePage={() => undefined}
        onCaptureScreenshot={() => undefined}
        onToggleAutoAttachPage={() => undefined}
        onToggleAutomationMode={onToggleAutomationMode}
        onPreviewAttachment={() => undefined}
        onDeleteAttachment={() => undefined}
        onDraftChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Mode')).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Automatic browser actions' }));
    expect(onToggleAutomationMode).toHaveBeenCalledWith(true);
  });
});
