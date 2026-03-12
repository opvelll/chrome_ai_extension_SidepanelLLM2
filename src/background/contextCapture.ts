import type { ContextAttachment, TabSource } from '../shared/models';

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }
  return tab;
}

function canInjectContentScript(tab: chrome.tabs.Tab): boolean {
  const url = tab.url ?? '';
  return Boolean(url) && /^https?:\/\//.test(url);
}

export function getTabSource(tab: chrome.tabs.Tab): TabSource {
  const parsedUrl = (() => {
    try {
      return new URL(tab.url ?? 'about:blank');
    } catch {
      return new URL('about:blank');
    }
  })();

  return {
    title: tab.title ?? '',
    url: tab.url ?? '',
    hostname: parsedUrl.hostname,
    pathname: parsedUrl.pathname || '/',
    capturedAt: new Date().toISOString(),
    tabId: tab.id,
  };
}

async function sendContentRequest(
  type: 'content.getSelection' | 'content.getPageText',
): Promise<{ text: string; source: TabSource }> {
  const tab = await getActiveTab();
  const tabId = tab.id;
  if (tabId === undefined) {
    throw new Error('No active tab found.');
  }

  let result: { text?: string } | undefined;

  try {
    result = (await chrome.tabs.sendMessage(tabId, { type })) as { text?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (!message.includes('Receiving end does not exist')) {
      throw error;
    }

    if (!canInjectContentScript(tab)) {
      throw new Error('This page does not allow context capture. Open a regular website tab and try again.');
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.ts'],
    });

    result = (await chrome.tabs.sendMessage(tabId, { type })) as { text?: string };
  }

  return {
    text: result?.text?.trim() ?? '',
    source: getTabSource(tab),
  };
}

export async function captureSelection(): Promise<ContextAttachment> {
  const { text, source } = await sendContentRequest('content.getSelection');
  if (!text) {
    throw new Error('No selected text found on the active page.');
  }

  return {
    id: crypto.randomUUID(),
    kind: 'selectionText',
    text,
    source,
  };
}

export async function capturePage(): Promise<ContextAttachment> {
  const { text, source } = await sendContentRequest('content.getPageText');
  if (!text) {
    throw new Error('No readable page text found on the active page.');
  }

  return {
    id: crypto.randomUUID(),
    kind: 'pageText',
    text,
    source,
  };
}

export async function captureScreenshot(): Promise<ContextAttachment> {
  const tab = await getActiveTab();
  const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

  return {
    id: crypto.randomUUID(),
    kind: 'screenshot',
    imageDataUrl,
    source: getTabSource(tab),
  };
}
