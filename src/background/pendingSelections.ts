import type { BackgroundRequest } from '../shared/messages';
import type { ContextAttachment, TabSource } from '../shared/models';
import { getActiveTab, getTabSource } from './contextCapture';

const SESSION_STORAGE_KEYS = {
  pendingSelections: 'pendingSelections',
} as const;

type PendingSelection = {
  text: string;
  source: TabSource;
  updatedAt: string;
};

type PendingSelectionStore = Record<string, PendingSelection>;

async function readPendingSelections(): Promise<PendingSelectionStore> {
  const result = await chrome.storage.session.get(SESSION_STORAGE_KEYS.pendingSelections);
  return (result[SESSION_STORAGE_KEYS.pendingSelections] as PendingSelectionStore | undefined) ?? {};
}

async function writePendingSelections(store: PendingSelectionStore): Promise<void> {
  await chrome.storage.session.set({ [SESSION_STORAGE_KEYS.pendingSelections]: store });
}

export async function updatePendingSelection(
  request: Extract<BackgroundRequest, { type: 'context.selectionChanged' }>,
  sender: chrome.runtime.MessageSender,
): Promise<ContextAttachment | null> {
  const tab = sender.tab;
  const tabId = tab?.id;
  if (tabId === undefined || !tab) {
    return null;
  }

  const store = await readPendingSelections();
  const nextStore = { ...store };
  const text = request.payload.text.trim();

  if (!text) {
    delete nextStore[String(tabId)];
  } else {
    nextStore[String(tabId)] = {
      text,
      source: getTabSource(tab),
      updatedAt: new Date().toISOString(),
    };
  }

  await writePendingSelections(nextStore);
  return null;
}

export async function consumePendingSelection(): Promise<ContextAttachment | null> {
  const tab = await getActiveTab();
  const tabId = tab.id;
  const store = await readPendingSelections();
  const directMatch = tabId === undefined ? undefined : store[String(tabId)];
  const pendingEntry = directMatch
    ? ([String(tabId), directMatch] as const)
    : Object.entries(store).sort(([, left], [, right]) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (!pendingEntry?.[1]?.text) {
    return null;
  }

  const [pendingKey, pending] = pendingEntry;
  const nextStore = { ...store };
  delete nextStore[pendingKey];
  await writePendingSelections(nextStore);

  return {
    id: crypto.randomUUID(),
    kind: 'selectionText',
    text: pending.text,
    source: pending.source,
  };
}
