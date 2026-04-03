import { Copy, History, MessageSquarePlus, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Settings } from '../../shared/models';
import { subtleButtonClassName } from '../styles';

type SidepanelHeaderProps = {
  settings: Settings | null;
  translations: ReturnType<typeof import('../../lib/i18n').getTranslations>;
  onOpenHistory: () => void;
  onCreateSession: () => void;
  onOpenSettings: () => void;
  onReasoningEffortChange: (value: Settings['reasoningEffort']) => void;
  onCopyThreadData: () => Promise<boolean>;
};

export function SidepanelHeader({
  settings,
  translations: t,
  onOpenHistory,
  onCreateSession,
  onOpenSettings,
  onReasoningEffortChange,
  onCopyThreadData,
}: SidepanelHeaderProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'done'>('idle');

  useEffect(() => {
    if (copyStatus !== 'done') {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  return (
    <header className="rounded-[20px] border border-stone-200/70 bg-white/90 p-2 shadow-md shadow-stone-900/6 backdrop-blur-xl">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1 rounded-lg bg-stone-100 px-2 py-1 text-[13px] font-medium text-stone-600">
          <span className="line-clamp-1">{settings?.modelId ?? t.sidepanel.modelNotConfigured}</span>
        </div>
        <select
          aria-label={t.sidepanel.reasoningEffort}
          className="min-w-0 max-w-28 shrink rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12px] text-stone-600 outline-none transition focus:border-stone-400"
          disabled={!settings}
          value={settings?.reasoningEffort ?? 'default'}
          onChange={(event) => onReasoningEffortChange(event.target.value as Settings['reasoningEffort'])}
        >
          <option value="default">{t.options.reasoningDefault}</option>
          <option value="none">{t.options.reasoningNone}</option>
          <option value="minimal">{t.options.reasoningMinimal}</option>
          <option value="low">{t.options.reasoningLow}</option>
          <option value="medium">{t.options.reasoningMedium}</option>
          <option value="high">{t.options.reasoningHigh}</option>
          <option value="xhigh">{t.options.reasoningXHigh}</option>
        </select>
        <button
          className={`${subtleButtonClassName} h-8 w-8 shrink-0 rounded-lg px-0`}
          onClick={() => {
            void onCopyThreadData().then((copied) => {
              if (copied) {
                setCopyStatus('done');
              }
            });
          }}
          aria-label={copyStatus === 'done' ? t.sidepanel.copyThreadDataDone : t.sidepanel.copyThreadData}
          title={copyStatus === 'done' ? t.sidepanel.copyThreadDataDone : t.sidepanel.copyThreadData}
          type="button"
        >
          <Copy className="h-4.5 w-4.5" />
        </button>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            className={`${subtleButtonClassName} h-8 w-8 rounded-lg px-0`}
            onClick={onOpenHistory}
            aria-label={t.sidepanel.sessionsLabel}
            title={t.sidepanel.sessionsLabel}
            type="button"
          >
            <History className="h-4.5 w-4.5" />
          </button>
          <button
            className={`${subtleButtonClassName} h-8 w-8 rounded-lg px-0`}
            onClick={onCreateSession}
            aria-label={t.sidepanel.newChat}
            title={t.sidepanel.newChat}
            type="button"
          >
            <MessageSquarePlus className="h-4.5 w-4.5" />
          </button>
          <button
            className={`${subtleButtonClassName} h-8 w-8 rounded-lg px-0`}
            onClick={onOpenSettings}
            aria-label={t.common.settings}
            title={t.common.settings}
            type="button"
          >
            <SettingsIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
