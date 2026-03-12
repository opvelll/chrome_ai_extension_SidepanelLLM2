import { CheckCircle2, Globe2, KeyRound, MessageSquareText, Server, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTranslations } from '../lib/i18n';
import { getDefaultSettings, hasDevDefaultApiKey } from '../lib/defaultSettings';
import { sendRuntimeMessage } from '../lib/runtime';
import type { Settings } from '../shared/models';

export function App() {
  const [settings, setSettings] = useState<Settings>(getDefaultSettings());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const devDefaultApiKey = hasDevDefaultApiKey();
  const t = getTranslations(settings);

  useEffect(() => {
    void (async () => {
      const response = await sendRuntimeMessage<{ settings: Settings }>({ type: 'settings.get' });
      if (response.ok) {
        setSettings(response.data.settings);
      }
    })();
  }, []);

  async function save() {
    setError('');
    const response = await sendRuntimeMessage<{ settings: Settings }>({
      type: 'settings.save',
      payload: settings,
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setStatus(t.options.saved);
  }

  async function testConnection() {
    setTesting(true);
    setError('');
    setStatus('');

    const response = await sendRuntimeMessage<{ message: string }>({
      type: 'settings.testConnection',
      payload: {
        apiKey: settings.apiKey,
        modelId: settings.modelId,
      },
    });

    setTesting(false);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setStatus(`${t.options.connectionOk} ${response.data.message}`);
  }

  const subtleButtonClassName =
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

  const primaryButtonClassName =
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="grid min-h-screen place-items-center bg-transparent px-6 py-8 text-slate-900">
      <div className="w-full max-w-3xl overflow-hidden rounded-[36px] border border-white/60 bg-white/72 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="bg-slate-950 px-6 py-7 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">{t.options.title}</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/18 p-3 text-cyan-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Sidepanel LLM</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t.options.description}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
              <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">
                {t.options.storageNote}
              </div>
              {devDefaultApiKey ? (
                <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-4">
                  {t.options.devNote}
                </div>
              ) : null}
            </div>
          </section>

          <section className="px-6 py-7">
            <label className="mt-1 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 text-cyan-600" />
                {t.options.language}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-cyan-300 focus:bg-white"
                value={settings.locale}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    locale: event.target.value as Settings['locale'],
                  }))
                }
              >
                <option value="auto">{t.options.languageAuto}</option>
                <option value="en">{t.options.languageEn}</option>
                <option value="ja">{t.options.languageJa}</option>
              </select>
            </label>

            <label className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-cyan-600" />
                {t.options.apiKey}
              </span>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-cyan-300 focus:bg-white"
                type="password"
                value={settings.apiKey}
                onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </label>

            <label className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4 text-cyan-600" />
                {t.options.model}
              </span>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-cyan-300 focus:bg-white"
                type="text"
                value={settings.modelId}
                onChange={(event) => setSettings((current) => ({ ...current, modelId: event.target.value }))}
              />
            </label>

            <label className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4 text-cyan-600" />
                {t.options.systemPrompt}
              </span>
              <textarea
                className="min-h-[160px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 shadow-inner shadow-white/50 outline-none transition focus:border-cyan-300 focus:bg-white"
                rows={6}
                value={settings.systemPrompt}
                onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
              />
            </label>

            {error && <div className="mt-4 text-sm text-rose-700">{error}</div>}
            {status && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {status}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button className={subtleButtonClassName} disabled={testing} onClick={() => void testConnection()}>
                <Server className="h-4 w-4" />
                {testing ? t.options.testingConnection : t.options.testConnection}
              </button>
              <button className={primaryButtonClassName} onClick={() => void save()}>
                <CheckCircle2 className="h-4 w-4" />
                {t.common.save}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
