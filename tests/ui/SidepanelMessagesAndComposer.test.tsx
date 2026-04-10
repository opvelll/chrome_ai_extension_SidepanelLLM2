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
    preferLatexMathOutput: false,
    composerSubmitBehavior: 'ctrl_enter_to_send',
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
  it('renders assistant messages as markdown', () => {
    const translations = getTranslations({ locale: 'en' });

    render(
      <MessageList
        messages={[
          createMessage({
            id: 'assistant-1',
            role: 'assistant',
            content: '**Bold** item\n\n- First\n- Second\n\n`const x = 1`',
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

    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('First').closest('li')).toBeTruthy();
    expect(screen.getByText('const x = 1').tagName).toBe('CODE');
  });

  it('renders latex math in assistant messages', () => {
    const translations = getTranslations({ locale: 'en' });

    render(
      <MessageList
        messages={[
          createMessage({
            id: 'assistant-math-1',
            role: 'assistant',
            content: 'Inline math $x^2$ and block math:\n\n$$N=p_1p_2\\cdots p_n+1$$',
          }),
        ]}
        settings={createSettings({ preferLatexMathOutput: true })}
        translations={translations}
        scrollTargetMessageId=""
        onScrollTargetHandled={() => undefined}
        onDeleteMessage={() => undefined}
        onDeleteAttachment={() => undefined}
        onPreviewAttachment={() => undefined}
      />,
    );

    expect(document.querySelectorAll('.message.assistant .katex')).toHaveLength(2);
    expect(screen.queryByText('$$N=p_1p_2\\cdots p_n+1$$')).toBeNull();
  });

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

    const logDetails = document.querySelectorAll('details');
    expect(logDetails).toHaveLength(3);

    const logRegion = logDetails[0] as HTMLDetailsElement;
    expect(logRegion.textContent).toContain('2');
    expect(logRegion.textContent).toContain('browser_inspect_page');
    expect(logRegion.hasAttribute('open')).toBe(false);
    expect(within(logRegion).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(logRegion.className).toContain('shrink-0');
    expect(logRegion.className).not.toContain('rounded-[16px]');
    expect(logRegion.className).not.toContain('border-stone-200');
    expect(logRegion.querySelector('summary')?.className).not.toContain('border-b');
    expect(within(logRegion).getByTestId('log-group-panel').className).toContain('min-h-[112px]');
    expect(within(logRegion).getByTestId('log-group-panel').className).toContain('resize-y');

    const firstLogItem = logDetails[1] as HTMLDetailsElement;
    const secondLogItem = logDetails[2] as HTMLDetailsElement;
    expect(firstLogItem.hasAttribute('open')).toBe(true);
    expect(secondLogItem.hasAttribute('open')).toBe(true);
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

  it('submits with ctrl+enter by default and keeps enter for newlines', () => {
    const translations = getTranslations({ locale: 'en' });
    const onSubmit = vi.fn();

    render(
      <ComposerPanel
        attachments={[]}
        draft="Shortcut send"
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
        onToggleAutomationMode={() => undefined}
        onPreviewAttachment={() => undefined}
        onDeleteAttachment={() => undefined}
        onDraftChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const composer = screen.getByPlaceholderText('Type a message...');
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('submits with cmd+enter in ctrl_enter_to_send mode', () => {
    const translations = getTranslations({ locale: 'en' });
    const onSubmit = vi.fn();

    render(
      <ComposerPanel
        attachments={[]}
        draft="Shortcut send"
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
        onToggleAutomationMode={() => undefined}
        onPreviewAttachment={() => undefined}
        onDeleteAttachment={() => undefined}
        onDraftChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const composer = screen.getByPlaceholderText('Type a message...');
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('submits with enter when the behavior is set to enter_to_send', () => {
    const translations = getTranslations({ locale: 'en' });
    const onSubmit = vi.fn();

    render(
      <ComposerPanel
        attachments={[]}
        draft="Shortcut send"
        loading={false}
        autoAttachPage={false}
        automationMode={false}
        composerPlaceholder={translations.sidepanel.composerPlaceholder}
        contextError=""
        error=""
        settings={createSettings({ composerSubmitBehavior: 'enter_to_send' })}
        translations={translations}
        onCaptureSelection={() => undefined}
        onCapturePage={() => undefined}
        onCaptureScreenshot={() => undefined}
        onToggleAutoAttachPage={() => undefined}
        onToggleAutomationMode={() => undefined}
        onPreviewAttachment={() => undefined}
        onDeleteAttachment={() => undefined}
        onDraftChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const composer = screen.getByPlaceholderText('Type a message...');
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledOnce();

    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
