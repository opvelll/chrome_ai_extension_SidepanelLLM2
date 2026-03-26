import { Brain, CheckCircle2, FileText, Globe2, KeyRound, MessageSquareText, RefreshCcw, Server, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTranslations } from '../lib/i18n';
import { getDefaultSettings, hasDevDefaultApiKey } from '../lib/defaultSettings';
import { sendRuntimeMessage } from '../lib/runtime';
import type { Settings } from '../shared/models';

export function App() {
  const defaultSettings = getDefaultSettings();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelInputMode, setModelInputMode] = useState<'list' | 'manual'>('manual');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const devDefaultApiKey = hasDevDefaultApiKey();
  const showDevelopmentNotes = import.meta.env.DEV;
  const t = getTranslations(settings);

  useEffect(() => {
    void (async () => {
      const response = await sendRuntimeMessage<{ settings: Settings }>({ type: 'settings.get' });
      if (response.ok) {
        setSettings(response.data.settings);
        setModelInputMode('manual');
        void loadModels(response.data.settings.apiKey, response.data.settings.modelId);
      }
      setHydrated(true);
    })();
  }, []);

  async function loadModels(apiKey: string, currentModelId = settings.modelId) {
    if (!apiKey.trim()) {
      setAvailableModels([]);
      setModelsError('');
      return;
    }

    setModelsLoading(true);
    setModelsError('');

    const response = await sendRuntimeMessage<{ models: string[] }>({
      type: 'settings.listModels',
      payload: { apiKey },
    });

    setModelsLoading(false);

    if (!response.ok) {
      setAvailableModels([]);
      setModelsError(response.error.message);
      setModelInputMode('manual');
      return;
    }

    setAvailableModels(response.data.models);
    setModelsError('');
    if (!response.data.models.includes(currentModelId)) {
      setModelInputMode(currentModelId.trim().length > 0 ? 'manual' : 'list');
    } else {
      setModelInputMode('list');
    }
  }

  async function persistSettings(nextSettings: Settings) {
    setError('');
    const response = await sendRuntimeMessage<{ settings: Settings }>({
      type: 'settings.save',
      payload: nextSettings,
    });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setSettings(response.data.settings);
    setStatus(t.options.saved);
  }

  async function save() {
    await persistSettings(settings);
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
        responseTool: settings.responseTool,
        reasoningEffort: settings.reasoningEffort,
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
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-700 active:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50';

  const modelSelectEnabled = hydrated && modelInputMode === 'list' && availableModels.length > 0;

  return (
    <div className="grid min-h-screen place-items-center bg-transparent px-6 py-8 text-slate-900">
      <div className="w-full max-w-3xl overflow-hidden rounded-[36px] border border-white/60 bg-white/72 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="bg-slate-950 px-6 py-7 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-200/80">{t.options.title}</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="rounded-2xl bg-teal-400/18 p-3 text-teal-200">
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
              {showDevelopmentNotes && devDefaultApiKey ? (
                <div className="rounded-[24px] border border-teal-400/20 bg-teal-400/10 px-4 py-4">
                  {t.options.devNote}
                </div>
              ) : null}
            </div>
          </section>

          <section className="px-6 py-7">
            <label className="mt-1 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Globe2 className="h-4 w-4 text-teal-600" />
                {t.options.language}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                aria-label={t.options.language}
                disabled={!hydrated}
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
                <KeyRound className="h-4 w-4 text-teal-600" />
                {t.options.apiKey}
              </span>
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                type="password"
                disabled={!hydrated}
                value={settings.apiKey}
                onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </label>

            <div className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4 text-teal-600" />
                {t.options.model}
              </span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.options.modelInputMethod}>
                <button
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    modelInputMode === 'list'
                      ? 'border-teal-500 bg-teal-50 text-teal-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  role="radio"
                  aria-checked={modelInputMode === 'list'}
                  disabled={!hydrated}
                  onClick={() => setModelInputMode('list')}
                >
                  {t.options.modelInputList}
                </button>
                <button
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    modelInputMode === 'manual'
                      ? 'border-teal-500 bg-teal-50 text-teal-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  role="radio"
                  aria-checked={modelInputMode === 'manual'}
                  disabled={!hydrated}
                  onClick={() => setModelInputMode('manual')}
                >
                  {t.options.modelInputManual}
                </button>
              </div>
              {modelInputMode === 'list' ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={t.options.model}
                    disabled={!modelSelectEnabled}
                    value={modelSelectEnabled ? settings.modelId : ''}
                    onChange={(event) => {
                      const nextModelId = event.target.value;
                      const nextSettings = { ...settings, modelId: nextModelId };
                      setSettings(nextSettings);
                      setModelInputMode('list');
                      void persistSettings(nextSettings);
                    }}
                  >
                    {!modelSelectEnabled ? <option value="">{modelsLoading ? t.options.refreshingModels : t.options.modelInputList}</option> : null}
                    {availableModels.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                  </select>
                  <button
                    className={subtleButtonClassName}
                    disabled={!hydrated || modelsLoading || !settings.apiKey.trim()}
                    onClick={() => void loadModels(settings.apiKey)}
                    title={t.options.refreshModels}
                  >
                    <RefreshCcw className={`h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`} />
                    {modelsLoading ? t.options.refreshingModels : t.options.refreshModels}
                  </button>
                </div>
              ) : (
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                  type="text"
                  aria-label={t.options.modelManualEntry}
                  disabled={!hydrated}
                  value={settings.modelId}
                  onChange={(event) => setSettings((current) => ({ ...current, modelId: event.target.value }))}
                />
              )}
              <div className="text-xs leading-5 text-slate-500">{t.options.modelHelp}</div>
              <div className="text-xs leading-5 text-amber-700">{t.options.modelCompatibilityNote}</div>
              {modelsError ? <div className="text-xs text-amber-700">{t.options.modelListUnavailable} {modelsError}</div> : null}
            </div>

            <label className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Wrench className="h-4 w-4 text-teal-600" />
                {t.options.tool}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                aria-label={t.options.tool}
                disabled={!hydrated}
                value={settings.responseTool}
                onChange={(event) => {
                  const nextSettings = {
                    ...settings,
                    responseTool: event.target.value as Settings['responseTool'],
                  };
                  setSettings(nextSettings);
                  void persistSettings(nextSettings);
                }}
              >
                <option value="web_search">{t.options.toolWebSearch}</option>
                <option value="none">{t.options.toolNone}</option>
              </select>
              <div className="text-xs leading-5 text-slate-500">{t.options.toolHelp}</div>
            </label>

            <label className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4 text-teal-600" />
                {t.options.reasoning}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                aria-label={t.options.reasoning}
                disabled={!hydrated}
                value={settings.reasoningEffort}
                onChange={(event) => {
                  const nextSettings = {
                    ...settings,
                    reasoningEffort: event.target.value as Settings['reasoningEffort'],
                  };
                  setSettings(nextSettings);
                  void persistSettings(nextSettings);
                }}
              >
                <option value="default">{t.options.reasoningDefault}</option>
                <option value="none">{t.options.reasoningNone}</option>
                <option value="minimal">{t.options.reasoningMinimal}</option>
                <option value="low">{t.options.reasoningLow}</option>
                <option value="medium">{t.options.reasoningMedium}</option>
                <option value="high">{t.options.reasoningHigh}</option>
                <option value="xhigh">{t.options.reasoningXHigh}</option>
              </select>
              <div className="text-xs leading-5 text-slate-500">{t.options.reasoningHelp}</div>
            </label>

            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-teal-600" />
                  {t.options.systemPrompt}
                </span>
                <button
                  type="button"
                  className={subtleButtonClassName}
                  disabled={!hydrated || settings.systemPrompt === defaultSettings.systemPrompt}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      systemPrompt: defaultSettings.systemPrompt,
                    }))
                  }
                >
                  {t.common.reset}
                </button>
              </div>
              <textarea
                className="min-h-[160px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                rows={6}
                disabled={!hydrated}
                value={settings.systemPrompt}
                onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4 text-amber-600" />
                  {t.options.automationSystemPrompt}
                </span>
                <button
                  type="button"
                  className={subtleButtonClassName}
                  disabled={!hydrated || settings.automationSystemPrompt === defaultSettings.automationSystemPrompt}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      automationSystemPrompt: defaultSettings.automationSystemPrompt,
                    }))
                  }
                >
                  {t.common.reset}
                </button>
              </div>
              <textarea
                className="min-h-[220px] rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-6 shadow-inner shadow-white/50 outline-none transition focus:border-amber-300 focus:bg-white"
                rows={10}
                disabled={!hydrated}
                value={settings.automationSystemPrompt}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    automationSystemPrompt: event.target.value,
                  }))
                }
              />
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4 text-teal-600" />
                {t.options.promptContext}
              </span>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50">
                <span className="min-w-0 flex-1 font-medium">{t.options.includeCurrentDateTime}</span>
                <input
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  type="checkbox"
                  disabled={!hydrated}
                  checked={settings.includeCurrentDateTime}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      includeCurrentDateTime: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50">
                <span className="min-w-0 flex-1 font-medium">{t.options.includeResponseLanguageInstruction}</span>
                <input
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  type="checkbox"
                  disabled={!hydrated}
                  checked={settings.includeResponseLanguageInstruction}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      includeResponseLanguageInstruction: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50">
              <FileText className="h-4 w-4 shrink-0 text-teal-600" />
              <span className="min-w-0 flex-1 font-medium">{t.options.autoAttachPage}</span>
              <input
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                type="checkbox"
                disabled={!hydrated}
                checked={settings.autoAttachPage}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    autoAttachPage: event.target.checked,
                  }))
                }
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
              <button className={subtleButtonClassName} disabled={testing || !hydrated} onClick={() => void testConnection()}>
                <Server className="h-4 w-4" />
                {testing ? t.options.testingConnection : t.options.testConnection}
              </button>
              <button className={primaryButtonClassName} disabled={!hydrated} onClick={() => void save()}>
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
