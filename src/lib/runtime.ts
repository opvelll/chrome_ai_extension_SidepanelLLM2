import type { AsyncResponse } from '../shared/messages';

export async function sendRuntimeMessage<T>(payload: unknown): Promise<AsyncResponse<T>> {
  return chrome.runtime.sendMessage(payload) as Promise<AsyncResponse<T>>;
}
