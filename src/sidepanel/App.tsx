import { AttachmentPreviewDialog } from './components/AttachmentPreviewDialog';
import { ComposerPanel } from './components/ComposerPanel';
import { MessageList } from './components/MessageList';
import { SessionHistoryDrawer } from './components/SessionHistoryDrawer';
import { SidepanelHeader } from './components/SidepanelHeader';
import { useSidepanelState } from './hooks/useSidepanelState';
import { primaryButtonClassName } from './styles';

export function App() {
  const sidepanel = useSidepanelState();

  return (
    <div className="relative h-screen overflow-hidden bg-transparent text-stone-900">
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

      {sidepanel.apiKeyMissing ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-stone-950/45 p-3">
          <div
            aria-modal="true"
            aria-labelledby="setup-required-title"
            className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white p-4 shadow-2xl shadow-stone-900/25"
            role="dialog"
          >
            <div className="space-y-2">
              <h2 id="setup-required-title" className="text-base font-semibold text-stone-900">
                {sidepanel.t.sidepanel.setupRequiredTitle}
              </h2>
              <p className="text-sm leading-6 text-stone-600">{sidepanel.t.sidepanel.setupRequiredBody}</p>
            </div>
            <button
              className={`${primaryButtonClassName} mt-4 w-full justify-center`}
              onClick={() => chrome.runtime.openOptionsPage()}
              type="button"
            >
              {sidepanel.t.sidepanel.openSettings}
            </button>
          </div>
        </div>
      ) : null}

      <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden bg-sand-100 p-1.5 sm:p-2">
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
