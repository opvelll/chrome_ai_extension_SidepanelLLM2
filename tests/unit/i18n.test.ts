import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachmentLabel, getTranslations, isDefaultSessionTitle, resolveLocale } from '../../src/lib/i18n';
import type { ContextAttachment } from '../../src/shared/models';

function setChromeLanguage(language: string | undefined) {
  vi.stubGlobal('chrome', {
    i18n: {
      getUILanguage: language ? () => language : undefined,
    },
  });
}

function setNavigatorLanguage(language: string) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function createSource() {
  return {
    title: 'Fixture Article',
    url: 'https://example.com/articles/fixture',
    hostname: 'example.com',
    pathname: '/articles/fixture',
    capturedAt: '2026-03-13T00:00:00.000Z',
  };
}

describe('resolveLocale', () => {
  it('uses explicit locale when configured', () => {
    setChromeLanguage('en-US');
    setNavigatorLanguage('en-US');

    expect(resolveLocale({ locale: 'ja' })).toBe('ja');
    expect(resolveLocale({ locale: 'en' })).toBe('en');
  });

  it('falls back to browser language when locale is auto', () => {
    setChromeLanguage('ja-JP');
    setNavigatorLanguage('en-US');

    expect(resolveLocale({ locale: 'auto' })).toBe('ja');
  });

  it('falls back to navigator language when chrome i18n is unavailable', () => {
    setChromeLanguage(undefined);
    setNavigatorLanguage('ja-JP');

    expect(resolveLocale({ locale: 'auto' })).toBe('ja');
  });
});

describe('attachmentLabel', () => {
  it('formats labels for text and screenshot attachments', () => {
    const selection: ContextAttachment = {
      id: '1',
      kind: 'selectionText',
      text: 'Selected content for the current page',
      source: createSource(),
    };
    const pageText: ContextAttachment = {
      id: '2',
      kind: 'pageText',
      text: 'Page body',
      source: createSource(),
    };
    const screenshot: ContextAttachment = {
      id: '3',
      kind: 'screenshot',
      imageDataUrl: 'data:image/png;base64,abc',
      source: createSource(),
    };

    expect(attachmentLabel(selection, { locale: 'en' })).toContain('Selection:');
    expect(attachmentLabel(pageText, { locale: 'en' })).toBe('Page: Fixture Article');
    expect(attachmentLabel(screenshot, { locale: 'ja' })).toBe('スクリーンショット: Fixture Article');
  });
});

describe('translations', () => {
  it('returns locale-specific labels', () => {
    expect(getTranslations({ locale: 'en' }).sidepanel.newChat).toBe('New chat');
    expect(getTranslations({ locale: 'ja' }).sidepanel.newChat).toBe('新しいチャット');
  });

  it('detects default session titles across supported locales', () => {
    expect(isDefaultSessionTitle('New chat')).toBe(true);
    expect(isDefaultSessionTitle('新しいチャット')).toBe(true);
    expect(isDefaultSessionTitle('Custom title')).toBe(false);
  });
});
