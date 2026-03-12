import type { BackgroundRequest } from '../shared/messages';
import { routeMessage, toUnexpectedErrorResponse } from './router';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  (async () => {
    try {
      sendResponse(await routeMessage(request, sender));
    } catch (error) {
      sendResponse(toUnexpectedErrorResponse(error));
    }
  })();

  return true;
});
