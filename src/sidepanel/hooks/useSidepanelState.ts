import { useEffect, useMemo, useState } from 'react';
import { getTranslations } from '../../lib/i18n';
import type { ChatMessage, ChatSession, ContextAttachment, Settings } from '../../shared/models';
import {
  captureAttachment as requestCaptureAttachment,
  createSession,
  deleteMessage,
  deleteMessageAttachment,
  deleteSession,
  getDefaultSessionTitle,
  getSession,
  getSessionListActiveId,
  getSettings,
  listSessions,
  saveSettings,
  sendChatMessage,
  type CaptureRequestType,
} from '../lib/api';
import {
  appendDraftAttachment,
  hasPageTextAttachment,
  removeDraftAttachment,
} from '../utils/attachmentState';
import { useAttachmentPreview } from './useAttachmentPreview';
import { usePendingSelection } from './usePendingSelection';

export function useSidepanelState() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachment[]>([]);
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contextError, setContextError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [autoAttachPage, setAutoAttachPage] = useState(false);
  const preview = useAttachmentPreview();
  const t = getTranslations(settings);

  const composerPlaceholder = useMemo(
    () => (autoAttachPage ? t.sidepanel.composerPlaceholderAuto : t.sidepanel.composerPlaceholder),
    [autoAttachPage, t],
  );
  const apiKeyMissing = !settings?.apiKey.trim();

  usePendingSelection({ setAttachments });

  async function loadSettings() {
    const response = await getSettings();
    if (response.ok) {
      setSettings(response.data.settings);
      setAutoAttachPage(response.data.settings.autoAttachPage);
    }
  }

  async function loadSessions(selectNewest = false) {
    const response = await listSessions();
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setSessions(response.data.sessions);
    setActiveSessionId(getSessionListActiveId(response.data.sessions, activeSessionId, selectNewest));
  }

  async function loadSession(sessionId: string) {
    const response = await getSession(sessionId);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessages(response.data.messages);
  }

  useEffect(() => {
    void loadSettings();
    void loadSessions();
  }, []);

  useEffect(() => {
    function handleStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== 'local' || !changes.settings) {
        return;
      }

      void loadSettings();
    }

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      void loadSession(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  async function updateAutoAttachPage(nextValue: boolean) {
    setAutoAttachPage(nextValue);
    setSettings((current) => (current ? { ...current, autoAttachPage: nextValue } : current));

    if (!settings) {
      return;
    }

    const response = await saveSettings({ ...settings, autoAttachPage: nextValue });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setSettings(response.data.settings);
    setAutoAttachPage(response.data.settings.autoAttachPage);
  }

  async function ensureSession() {
    if (activeSessionId) {
      return activeSessionId;
    }

    const response = await createSession(getDefaultSessionTitle(t));
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    await loadSessions(true);
    return response.data.session.id;
  }

  async function createNewSession() {
    setError('');
    setContextError('');
    const response = await createSession(getDefaultSessionTitle(t));
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setAttachments([]);
    setDraft('');
    setHistoryOpen(false);
    await loadSessions(true);
  }

  async function deleteSessionById(sessionId: string) {
    if (!sessionId) {
      return;
    }
    if (!window.confirm(t.sidepanel.deleteConfirm)) {
      return;
    }
    const response = await deleteSession(sessionId);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    if (sessionId === activeSessionId) {
      setAttachments([]);
      setDraft('');
      setActiveSessionId('');
    }
    await loadSessions();
  }

  async function deleteStoredMessage(messageId: string) {
    if (!activeSessionId) {
      return;
    }

    const response = await deleteMessage(activeSessionId, messageId);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessages(response.data.messages);
    await loadSessions();
  }

  async function deleteStoredAttachment(messageId: string, attachmentId: string) {
    if (!activeSessionId) {
      return;
    }

    const response = await deleteMessageAttachment(activeSessionId, messageId, attachmentId);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessages(response.data.messages);
    await loadSessions();
  }

  async function captureAttachment(type: CaptureRequestType) {
    setError('');
    setContextError('');
    const response = await requestCaptureAttachment(type);
    if (!response.ok) {
      setContextError(response.error.message);
      return;
    }
    setContextError('');
    setAttachments((current) => appendDraftAttachment(current, response.data.attachment));
  }

  async function submit() {
    if (!draft.trim()) {
      return;
    }

    setLoading(true);
    setError('');
    setContextError('');

    try {
      const sessionId = await ensureSession();
      let nextAttachments = [...attachments];

      if (
        autoAttachPage &&
        messages.length === 0 &&
        !hasPageTextAttachment(nextAttachments)
      ) {
        const pageResponse = await requestCaptureAttachment('context.capturePage');

        if (!pageResponse.ok) {
          setContextError(pageResponse.error.message);
          return;
        }

        nextAttachments = [...nextAttachments, pageResponse.data.attachment];
      }

      const response = await sendChatMessage(sessionId, draft.trim(), nextAttachments);

      if (!response.ok) {
        setError(response.error.message);
        return;
      }

      setDraft('');
      setAttachments([]);
      await loadSessions();
      await loadSession(sessionId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.errors.sendFailed);
    } finally {
      setLoading(false);
    }
  }

  return {
    t,
    sessions,
    activeSessionId,
    messages,
    attachments,
    draft,
    settings,
    loading,
    error,
    contextError,
    historyOpen,
    autoAttachPage,
    composerPlaceholder,
    previewAttachment: preview.previewAttachment,
    previewScale: preview.previewScale,
    apiKeyMissing,
    setHistoryOpen,
    setDraft,
    setAttachments,
    setPreviewAttachment: preview.setPreviewAttachment,
    updatePreviewScale: preview.updatePreviewScale,
    createNewSession,
    deleteSessionById,
    selectSession(sessionId: string) {
      setActiveSessionId(sessionId);
      setHistoryOpen(false);
    },
    deleteStoredMessage,
    deleteStoredAttachment,
    removeDraftAttachment(attachmentId: string) {
      setAttachments((current) => removeDraftAttachment(current, attachmentId));
    },
    updateAutoAttachPage,
    captureSelection() {
      return captureAttachment('context.captureSelection');
    },
    capturePage() {
      return captureAttachment('context.capturePage');
    },
    captureScreenshot() {
      return captureAttachment('context.captureScreenshot');
    },
    submit,
  };
}
