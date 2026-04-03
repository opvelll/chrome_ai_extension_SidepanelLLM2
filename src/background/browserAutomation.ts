import { captureScreenshot } from './contextCapture';
import { parseAutomationToolCall } from '../lib/automation';

type AutomationContentRequest =
  | {
      type: 'content.automationInspectPage';
      payload?: {
        maxElements?: number;
      };
    }
  | {
      type: 'content.automationClick';
      payload: {
        selector: string;
      };
    }
  | {
      type: 'content.automationType';
      payload: {
        selector: string;
        text: string;
        clear?: boolean;
        submit?: boolean;
      };
    }
  | {
      type: 'content.automationGetValue';
      payload: {
        selector: string;
      };
    }
  | {
      type: 'content.automationSetValue';
      payload: {
        selector: string;
        text: string;
        clear?: boolean;
      };
    }
  | {
      type: 'content.automationScroll';
      payload: {
        direction: 'up' | 'down';
        amount?: number;
      };
    }
  | {
      type: 'content.automationPressKey';
      payload: {
        key: string;
      };
    }
  | {
      type: 'content.automationWait';
      payload: {
        timeoutMs?: number;
        selector?: string;
        text?: string;
      };
    };

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

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }
  return tab;
}

async function sendAutomationRequest<TResponse>(request: AutomationContentRequest): Promise<TResponse> {
  const tab = await getActiveTab();
  const tabId = tab.id;

  if (tabId === undefined) {
    throw new Error('No active tab found.');
  }

  try {
    return (await chrome.tabs.sendMessage(tabId, request)) as TResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (!message.includes('Receiving end does not exist')) {
      throw error;
    }

    if (!canInjectContentScript(tab)) {
      throw new Error('This page does not allow automatic browser interaction. Open a regular website tab and try again.');
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: getContentScriptFiles(),
    });

    return (await chrome.tabs.sendMessage(tabId, request)) as TResponse;
  }
}

export async function executeAutomationToolCall(name: string, rawArguments: string): Promise<unknown> {
  const toolCall = parseAutomationToolCall(name, rawArguments);

  switch (toolCall.name) {
    case 'browser_inspect_page':
      return sendAutomationRequest({
        type: 'content.automationInspectPage',
        payload: {
          maxElements: toolCall.args.maxElements ?? undefined,
        },
      });
    case 'browser_click':
      return sendAutomationRequest({
        type: 'content.automationClick',
        payload: toolCall.args,
      });
    case 'browser_type':
      return sendAutomationRequest({
        type: 'content.automationType',
        payload: {
          selector: toolCall.args.selector,
          text: toolCall.args.text,
          clear: toolCall.args.clear ?? undefined,
          submit: toolCall.args.submit ?? undefined,
        },
      });
    case 'browser_get_value':
      return sendAutomationRequest({
        type: 'content.automationGetValue',
        payload: {
          selector: toolCall.args.selector,
        },
      });
    case 'browser_set_value':
      return sendAutomationRequest({
        type: 'content.automationSetValue',
        payload: {
          selector: toolCall.args.selector,
          text: toolCall.args.text,
          clear: toolCall.args.clear ?? undefined,
        },
      });
    case 'browser_scroll':
      return sendAutomationRequest({
        type: 'content.automationScroll',
        payload: {
          direction: toolCall.args.direction,
          amount: toolCall.args.amount ?? undefined,
        },
      });
    case 'browser_press_key':
      return sendAutomationRequest({
        type: 'content.automationPressKey',
        payload: toolCall.args,
      });
    case 'browser_capture_screenshot':
      return captureScreenshot();
    case 'browser_wait':
      return sendAutomationRequest({
        type: 'content.automationWait',
        payload: {
          timeoutMs: toolCall.args.timeoutMs ?? undefined,
          selector: toolCall.args.selector ?? undefined,
          text: toolCall.args.text ?? undefined,
        },
      });
  }
}
