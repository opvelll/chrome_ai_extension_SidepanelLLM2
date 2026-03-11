import { CheckCircle2, KeyRound, MessageSquareText, Server, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AsyncResponse } from '../shared/messages';
import { getDefaultSettings, hasDevDefaultApiKey } from '../lib/defaultSettings';
import type { Settings } from '../shared/models';

async function sendMessage<T>(payload: unknown): Promise<AsyncResponse<T>> {
  return chrome.runtime.sendMessage(payload) as Promise<AsyncResponse<T>>;
}

export function App() {
  const [settings, setSettings] = useState<Settings>(getDefaultSettings());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const devDefaultApiKey = hasDevDefaultApiKey();

  useEffect(() => {
    void (async () => {
      const response = await sendMessage<{ settings: Settings }>({ type: 'settings.get' });
      if (response.ok) {
        setSettings(response.data.settings);
      }
    })();
  }, []);

  async function save() {
    setError('');
    const response = await sendMessage<{ settings: Settings }>({
      type: 'settings.save',
      payload: settings,
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setStatus('Saved.');
  }

  async function testConnection() {
    setTesting(true);
    setError('');
    setStatus('');

    const response = await sendMessage<{ message: string }>({
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

    setStatus(`Connection ok: ${response.data.message}`);
  }

  const subtleButtonClassName =
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink-900 shadow-sm backdrop-blur-sm transition hover:border-ink-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

  const primaryButtonClassName =
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="options-shell grid min-h-screen place-items-center bg-transparent px-6 py-8 text-ink-900">
      <div className="options-card w-full max-w-2xl rounded-[32px] border border-white/60 bg-white/65 p-6 shadow-xl shadow-ink-900/8 backdrop-blur-xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">Settings</div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Sidepanel LLM</h1>
            <p className="options-copy mt-2 max-w-xl text-sm leading-6 text-ink-400">
              Configure the OpenAI API used by the side panel.
            </p>
          </div>
          <div className="rounded-2xl bg-amber-100/70 p-3 text-accent-500">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>
        <p className="storage-note mt-5 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-ink-700">
          Production builds require the user to enter an API key. Saved settings are stored in <code>chrome.storage.local</code> on this browser profile only.
        </p>
        {devDefaultApiKey ? (
          <p className="storage-note mt-3 rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-ink-700">
            Development mode detected: the API key field was prefilled from <code>.env</code>. Saving will persist the current value to local extension storage.
          </p>
        ) : null}

        <label className="field mt-6 flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-accent-500" />
            API key
          </span>
          <input
            className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm shadow-inner shadow-white/40 outline-none transition placeholder:text-ink-400 focus:border-ink-200"
            type="password"
            value={settings.apiKey}
            onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
          />
        </label>

        <label className="field mt-4 flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Server className="h-4 w-4 text-accent-500" />
            Model
          </span>
          <input
            className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm shadow-inner shadow-white/40 outline-none transition placeholder:text-ink-400 focus:border-ink-200"
            type="text"
            value={settings.modelId}
            onChange={(event) => setSettings((current) => ({ ...current, modelId: event.target.value }))}
          />
        </label>

        <label className="field mt-4 flex flex-col gap-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="h-4 w-4 text-accent-500" />
            System prompt
          </span>
          <textarea
            className="min-h-[160px] rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm leading-6 shadow-inner shadow-white/40 outline-none transition placeholder:text-ink-400 focus:border-ink-200"
            rows={6}
            value={settings.systemPrompt}
            onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
          />
        </label>

        {error && <div className="status error mt-4 text-sm text-red-700">{error}</div>}
        {status && (
          <div className="status mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {status}
          </div>
        )}

        <div className="options-actions mt-6 flex items-center justify-end gap-3">
          <button className={subtleButtonClassName} disabled={testing} onClick={() => void testConnection()}>
            <Server className="h-4 w-4" />
            {testing ? 'Testing...' : 'Test connection'}
          </button>
          <button className={primaryButtonClassName} onClick={() => void save()}>
            <CheckCircle2 className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
