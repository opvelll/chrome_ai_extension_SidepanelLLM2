import { History, MessageSquarePlus, Settings as SettingsIcon } from 'lucide-react';
import type { Settings } from '../../shared/models';
import { subtleButtonClassName } from '../styles';

type SidepanelHeaderProps = {
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onOpenHistory: () => void;
  onCreateSession: () => void;
  onOpenSettings: () => void;
};

export function SidepanelHeader({
  settings,
  translations: t,
  onOpenHistory,
  onCreateSession,
  onOpenSettings,
}: SidepanelHeaderProps) {
  return (
    <header className="rounded-[22px] border border-stone-200/70 bg-white/90 p-2.5 shadow-md shadow-stone-900/6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 rounded-xl bg-stone-100 px-2.5 py-1.5 text-sm font-medium text-stone-600">
          <span className="line-clamp-1">{settings?.modelId ?? t.sidepanel.modelNotConfigured}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            className={`${subtleButtonClassName} h-9 w-9 rounded-xl px-0`}
            onClick={onOpenHistory}
            aria-label={t.sidepanel.sessionsLabel}
            title={t.sidepanel.sessionsLabel}
          >
            <History className="h-5 w-5" />
          </button>
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
            onClick={onOpenSettings}
            aria-label={t.common.settings}
            title={t.common.settings}
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
