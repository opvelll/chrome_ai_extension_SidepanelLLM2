import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureAreaScreenshot,
  capturePage,
  captureSelection,
  captureScreenshot,
} from '../../src/background/contextCapture';
import { createContextCaptureChromeMock } from '../helpers/chrome';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contextCapture', () => {
  it('reinjects the content script when the first message target is unavailable', async () => {
    const { chrome } = createContextCaptureChromeMock({
      sendMessageResults: [new Error('Receiving end does not exist.'), { text: ' Selected text ' }],
    });
    vi.stubGlobal('chrome', chrome);

    const attachment = await captureSelection();

    expect(chrome.scripting.executeScript).toHaveBeenCalledOnce();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(attachment.kind).toBe('selectionText');
    if (attachment.kind !== 'selectionText') {
      throw new Error('Expected a selection attachment.');
    }
    expect(attachment.text).toBe('Selected text');
    expect(attachment.source.url).toBe('https://example.com/articles/fixture');
  });

  it('rejects context capture on unsupported pages instead of trying to inject', async () => {
    const { chrome } = createContextCaptureChromeMock({
      activeTab: {
        id: 11,
        index: 0,
        windowId: 22,
        title: 'Chrome Extensions',
        url: 'chrome://extensions',
        active: true,
        highlighted: true,
        pinned: false,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        frozen: false,
        groupId: -1,
      },
      sendMessageResults: [new Error('Receiving end does not exist.')],
    });
    vi.stubGlobal('chrome', chrome);

    await expect(capturePage()).rejects.toThrow(
      'This page does not allow context capture. Open a regular website tab and try again.',
    );
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('captures a screenshot from the active tab metadata', async () => {
    const { chrome } = createContextCaptureChromeMock({
      screenshotDataUrl: 'data:image/png;base64,screenshot',
    });
    vi.stubGlobal('chrome', chrome);

    const attachment = await captureScreenshot();

    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(22, { format: 'png' });
    expect(attachment.kind).toBe('screenshot');
    if (attachment.kind !== 'screenshot') {
      throw new Error('Expected a screenshot attachment.');
    }
    expect(attachment.imageDataUrl).toBe('data:image/png;base64,screenshot');
    expect(attachment.source.tabId).toBe(11);
  });

  it('crops an area from the visible tab screenshot', async () => {
    const { chrome } = createContextCaptureChromeMock({
      screenshotDataUrl: 'data:image/png;base64,fixture',
    });
    const drawImage = vi.fn();
    const convertToBlob = vi.fn(async () => new Blob(['cropped'], { type: 'image/png' }));
    const getContext = vi.fn(() => ({ drawImage }));

    vi.stubGlobal('chrome', chrome);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => new Blob(['fixture'], { type: 'image/png' }),
      })),
    );
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 400,
        height: 200,
      })),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number;
        height: number;

        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
        }

        getContext() {
          return getContext();
        }

        convertToBlob() {
          return convertToBlob();
        }
      },
    );
    vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'));

    const attachment = await captureAreaScreenshot({
      x: 10,
      y: 12,
      width: 40,
      height: 24,
      devicePixelRatio: 2,
    });

    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(22, { format: 'png' });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 20, 24, 80, 48, 0, 0, 80, 48);
    expect(convertToBlob).toHaveBeenCalledOnce();
    expect(attachment.kind).toBe('screenshot');
    if (attachment.kind !== 'screenshot') {
      throw new Error('Expected a screenshot attachment.');
    }
    expect(attachment.imageDataUrl).toBe('data:image/png;base64,Y3JvcHBlZA==');
  });
});
