import { vi } from 'vitest';

type TabMessage = { text?: string };

type ChromeContextCaptureMockOptions = {
  activeTab?: Partial<chrome.tabs.Tab>;
  manifestFiles?: string[];
  sendMessageResults?: Array<TabMessage | Error>;
  screenshotDataUrl?: string;
};

export function createContextCaptureChromeMock(options: ChromeContextCaptureMockOptions = {}) {
  const activeTab = {
    id: 11,
    index: 0,
    windowId: 22,
    title: 'Fixture Article',
    url: 'https://example.com/articles/fixture',
    active: true,
    highlighted: true,
    pinned: false,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    groupId: -1,
    ...options.activeTab,
  } as chrome.tabs.Tab;
  const sendMessageResults = [...(options.sendMessageResults ?? [])];
  const manifestFiles = options.manifestFiles ?? ['src/content/index.ts'];

  const tabsQuery = vi.fn(async () => [activeTab]);
  const tabsSendMessage = vi.fn(async () => {
    const next = sendMessageResults.shift();
    if (next instanceof Error) {
      throw next;
    }

    return next ?? { text: '' };
  });
  const tabsCaptureVisibleTab = vi.fn(async () => options.screenshotDataUrl ?? 'data:image/png;base64,mock');
  const executeScript = vi.fn(async () => undefined);
  const getManifest = vi.fn(() => ({
    content_scripts: [{ js: manifestFiles }],
  }));

  return {
    chrome: {
      tabs: {
        query: tabsQuery,
        sendMessage: tabsSendMessage,
        captureVisibleTab: tabsCaptureVisibleTab,
      },
      scripting: {
        executeScript,
      },
      runtime: {
        getManifest,
      },
    },
  };
}
