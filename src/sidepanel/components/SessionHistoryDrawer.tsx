import { MessageSquarePlus, Trash2, X } from 'lucide-react';
import { formatTimestamp } from '../../lib/i18n';
import type { ChatSession, Settings } from '../../shared/models';
import { subtleButtonClassName } from '../styles';

type SessionHistoryDrawerProps = {
  open: boolean;
  sessions: ChatSession[];
  activeSessionId: string;
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onClose: () => void;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export function SessionHistoryDrawer({
  open,
  sessions,
  activeSessionId,
  settings,
  translations: t,
  onClose,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
}: SessionHistoryDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex">
      <button
        className="flex-1 bg-slate-950/24 backdrop-blur-[2px]"
        aria-label={t.sidepanel.sessionsLabel}
        title={t.sidepanel.sessionsLabel}
        onClick={onClose}
      />
      <aside className="w-[min(88vw,320px)] border-l border-stone-200/70 bg-white/96 p-2.5 shadow-2xl shadow-stone-900/15 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
            onClick={onCreateSession}
            aria-label={t.sidepanel.newChat}
            title={t.sidepanel.newChat}
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
          <button
            className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
            onClick={onClose}
            aria-label={t.sidepanel.sessionsLabel}
            title={t.sidepanel.sessionsLabel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex max-h-[calc(100vh-96px)] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`rounded-[18px] border p-1.5 transition ${
                session.id === activeSessionId
                  ? 'border-teal-200 bg-teal-50 shadow-sm shadow-teal-900/8'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  className="session-item min-w-0 flex-1 rounded-[14px] px-2 py-1.5 text-left hover:bg-white/70"
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="line-clamp-2 text-sm font-medium text-stone-900">{session.title}</div>
                  <div className="mt-1 text-xs text-stone-500">{formatTimestamp(session.updatedAt, settings)}</div>
                </button>
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 transition hover:bg-white hover:text-rose-600"
                  onClick={() => onDeleteSession(session.id)}
                  aria-label={t.common.delete}
                  title={t.common.delete}
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          ))}
          {sessions.length === 0 ? (
            <p className="rounded-[22px] border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm leading-6 text-stone-500">
              {t.sidepanel.emptySessions}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
