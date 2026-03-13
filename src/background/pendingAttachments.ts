import type { ContextAttachment } from '../shared/models';
import { getActiveTab } from './contextCapture';

const SESSION_STORAGE_KEYS = {
  pendingAttachments: 'pendingAttachments',
} as const;

type PendingAttachmentEntry = {
  attachment: ContextAttachment;
  updatedAt: string;
};

type PendingAttachmentStore = Record<string, PendingAttachmentEntry>;

async function readPendingAttachments(): Promise<PendingAttachmentStore> {
  const result = await chrome.storage.session.get(SESSION_STORAGE_KEYS.pendingAttachments);
  return (result[SESSION_STORAGE_KEYS.pendingAttachments] as PendingAttachmentStore | undefined) ?? {};
}

async function writePendingAttachments(store: PendingAttachmentStore): Promise<void> {
  await chrome.storage.session.set({ [SESSION_STORAGE_KEYS.pendingAttachments]: store });
}

export async function enqueuePendingAttachment(attachment: ContextAttachment): Promise<void> {
  const tabId = attachment.source.tabId;
  if (tabId === undefined) {
    return;
  }

  const store = await readPendingAttachments();
  await writePendingAttachments({
    ...store,
    [String(tabId)]: {
      attachment,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function consumePendingAttachment(): Promise<ContextAttachment | null> {
  const tab = await getActiveTab();
  const store = await readPendingAttachments();
  const directMatch = tab.id === undefined ? undefined : store[String(tab.id)];
  const pendingEntry = directMatch
    ? ([String(tab.id), directMatch] as const)
    : Object.entries(store).sort(([, left], [, right]) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (!pendingEntry?.[1]?.attachment) {
    return null;
  }

  const [pendingKey, pending] = pendingEntry;
  const nextStore = { ...store };
  delete nextStore[pendingKey];
  await writePendingAttachments(nextStore);
  return pending.attachment;
}
