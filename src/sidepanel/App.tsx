import { AttachmentPreviewDialog } from './components/AttachmentPreviewDialog';
import { ComposerPanel } from './components/ComposerPanel';
import { MessageList } from './components/MessageList';
import { SessionHistoryDrawer } from './components/SessionHistoryDrawer';
import { SidepanelHeader } from './components/SidepanelHeader';
import { useSidepanelState } from './hooks/useSidepanelState';

export function App() {
  const sidepanel = useSidepanelState();

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-stone-900">
      <SessionHistoryDrawer
        open={sidepanel.historyOpen}
        sessions={sidepanel.sessions}
        activeSessionId={sidepanel.activeSessionId}
        settings={sidepanel.settings}
        translations={sidepanel.t}
        onClose={() => sidepanel.setHistoryOpen(false)}
        onCreateSession={() => void sidepanel.createNewSession()}
        onSelectSession={sidepanel.selectSession}
        onDeleteSession={(sessionId) => void sidepanel.deleteSessionById(sessionId)}
      />

      <AttachmentPreviewDialog
        attachment={sidepanel.previewAttachment}
        previewScale={sidepanel.previewScale}
        settings={sidepanel.settings}
        translations={sidepanel.t}
        onClose={() => sidepanel.setPreviewAttachment(null)}
        onUpdateScale={sidepanel.updatePreviewScale}
      />

      <main className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)_auto] gap-2 bg-sand-100 p-2.5 sm:p-3">
        <SidepanelHeader
          settings={sidepanel.settings}
          translations={sidepanel.t}
          onOpenHistory={() => sidepanel.setHistoryOpen(true)}
          onCreateSession={() => void sidepanel.createNewSession()}
          onOpenSettings={() => chrome.runtime.openOptionsPage()}
        />

        <MessageList
          messages={sidepanel.messages}
          settings={sidepanel.settings}
          translations={sidepanel.t}
          onDeleteMessage={(messageId) => void sidepanel.deleteStoredMessage(messageId)}
          onDeleteAttachment={(messageId, attachmentId) =>
            void sidepanel.deleteStoredAttachment(messageId, attachmentId)
          }
          onPreviewAttachment={sidepanel.setPreviewAttachment}
        />

        <ComposerPanel
          attachments={sidepanel.attachments}
          draft={sidepanel.draft}
          loading={sidepanel.loading}
          autoAttachPage={sidepanel.autoAttachPage}
          composerPlaceholder={sidepanel.composerPlaceholder}
          contextError={sidepanel.contextError}
          error={sidepanel.error}
          settings={sidepanel.settings}
          translations={sidepanel.t}
          onCaptureSelection={() => void sidepanel.captureSelection()}
          onCapturePage={() => void sidepanel.capturePage()}
          onCaptureScreenshot={() => void sidepanel.captureScreenshot()}
          onToggleAutoAttachPage={(nextValue) => void sidepanel.updateAutoAttachPage(nextValue)}
          onPreviewAttachment={sidepanel.setPreviewAttachment}
          onDeleteAttachment={sidepanel.removeDraftAttachment}
          onDraftChange={sidepanel.setDraft}
          onSubmit={() => void sidepanel.submit()}
        />
      </main>
    </div>
  );
}
