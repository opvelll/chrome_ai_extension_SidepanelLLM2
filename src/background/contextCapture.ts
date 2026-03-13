import type { ContextAttachment, TabSource } from '../shared/models';
import type { ContextCaptureAreaRequest } from '../shared/messages';

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

function getContentScriptFiles(): string[] {
  const scriptFiles =
    chrome.runtime
      .getManifest()
      .content_scripts?.flatMap((entry) => entry.js ?? [])
      .filter((value, index, values) => values.indexOf(value) === index) ?? [];

  if (scriptFiles.length === 0) {
    throw new Error('Content script is not configured in the extension manifest.');
  }

  return scriptFiles;
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
      files: getContentScriptFiles(),
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

export async function getActiveSelection(): Promise<ContextAttachment | null> {
  const { text, source } = await sendContentRequest('content.getSelection');
  if (!text) {
    return null;
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

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

function normalizeCropRect(
  imageWidth: number,
  imageHeight: number,
  payload: ContextCaptureAreaRequest['payload'],
) {
  const scale = Math.max(payload.devicePixelRatio || 1, 1);
  const left = Math.max(0, Math.min(payload.x, payload.x + payload.width));
  const top = Math.max(0, Math.min(payload.y, payload.y + payload.height));
  const width = Math.max(Math.abs(payload.width), 1);
  const height = Math.max(Math.abs(payload.height), 1);
  const sx = Math.max(0, Math.floor(left * scale));
  const sy = Math.max(0, Math.floor(top * scale));
  const sw = Math.max(1, Math.min(imageWidth - sx, Math.ceil(width * scale)));
  const sh = Math.max(1, Math.min(imageHeight - sy, Math.ceil(height * scale)));

  return { sx, sy, sw, sh };
}

export async function captureAreaScreenshot(
  payload: ContextCaptureAreaRequest['payload'],
  tabOverride?: chrome.tabs.Tab,
): Promise<ContextAttachment> {
  const tab = tabOverride?.id ? tabOverride : await getActiveTab();
  const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const imageBlob = await dataUrlToBlob(imageDataUrl);
  const bitmap = await createImageBitmap(imageBlob);
  const { sx, sy, sw, sh } = normalizeCropRect(bitmap.width, bitmap.height, payload);
  const canvas = new OffscreenCanvas(sw, sh);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to crop the captured image.');
  }

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

  return {
    id: crypto.randomUUID(),
    kind: 'screenshot',
    imageDataUrl: await blobToDataUrl(croppedBlob),
    source: getTabSource(tab),
  };
}
