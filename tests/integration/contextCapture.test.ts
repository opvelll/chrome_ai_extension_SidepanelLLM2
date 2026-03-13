import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePage, captureSelection, captureScreenshot } from '../../src/background/contextCapture';
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
});
