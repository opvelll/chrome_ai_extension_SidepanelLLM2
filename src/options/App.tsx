import {
  Brain,
  CheckCircle2,
  FileText,
  Globe2,
  KeyRound,
  MessageSquareText,
  RefreshCcw,
  Server,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getDefaultSettings, hasDevDefaultApiKey } from '../lib/defaultSettings';
import { getTranslations } from '../lib/i18n';
import { sendRuntimeMessage } from '../lib/runtime';
import type { Settings } from '../shared/models';

type SettingsSectionId = 'common' | 'chat' | 'automation';
type DraftField = 'apiKey' | 'modelId' | 'systemPrompt' | 'automationSystemPrompt' | 'automationMaxSteps';

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
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('common');
  const [draftApiKey, setDraftApiKey] = useState(defaultSettings.apiKey);
  const [draftModelId, setDraftModelId] = useState(defaultSettings.modelId);
  const [draftSystemPrompt, setDraftSystemPrompt] = useState(defaultSettings.systemPrompt);
  const [draftAutomationSystemPrompt, setDraftAutomationSystemPrompt] = useState(defaultSettings.automationSystemPrompt);
  const [draftAutomationMaxSteps, setDraftAutomationMaxSteps] = useState(String(defaultSettings.automationMaxSteps));
  const devDefaultApiKey = hasDevDefaultApiKey();
  const showDevelopmentNotes = import.meta.env.DEV;
  const t = getTranslations(settings);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    void (async () => {
      const response = await sendRuntimeMessage<{ settings: Settings }>({ type: 'settings.get' });
      if (response.ok) {
        const nextSettings = response.data.settings;
        setSettings(nextSettings);
        settingsRef.current = nextSettings;
        setDraftApiKey(nextSettings.apiKey);
        setDraftModelId(nextSettings.modelId);
        setDraftSystemPrompt(nextSettings.systemPrompt);
        setDraftAutomationSystemPrompt(nextSettings.automationSystemPrompt);
        setDraftAutomationMaxSteps(String(nextSettings.automationMaxSteps));
        setModelInputMode('manual');
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

  async function persistSettings(nextSettings: Settings, successMessage = t.options.saved) {
    setError('');
    setStatus('');

    const response = await sendRuntimeMessage<{ settings: Settings }>({
      type: 'settings.save',
      payload: nextSettings,
    });

    if (!response.ok) {
      setError(response.error.message);
      return null;
    }

    setSettings(response.data.settings);
    settingsRef.current = response.data.settings;
    setStatus(successMessage);
    return response.data.settings;
  }

  async function persistImmediate<K extends keyof Settings>(key: K, value: Settings[K]) {
    const nextSettings = { ...settingsRef.current, [key]: value };
    const saved = await persistSettings(nextSettings, t.options.savedAutomatically);
    if (!saved) {
      return;
    }

    if (key === 'locale') {
      setSettings(saved);
    }

    if (key === 'modelId') {
      setDraftModelId(saved.modelId);
    }
  }

  async function saveDraftField(field: DraftField) {
    switch (field) {
      case 'apiKey': {
        const saved = await persistSettings({ ...settingsRef.current, apiKey: draftApiKey });
        if (saved) {
          setDraftApiKey(saved.apiKey);
        }
        return;
      }
      case 'modelId': {
        const saved = await persistSettings({ ...settingsRef.current, modelId: draftModelId });
        if (saved) {
          setDraftModelId(saved.modelId);
        }
        return;
      }
      case 'systemPrompt': {
        const saved = await persistSettings({ ...settingsRef.current, systemPrompt: draftSystemPrompt });
        if (saved) {
          setDraftSystemPrompt(saved.systemPrompt);
        }
        return;
      }
      case 'automationSystemPrompt': {
        const saved = await persistSettings({
          ...settingsRef.current,
          automationSystemPrompt: draftAutomationSystemPrompt,
        });
        if (saved) {
          setDraftAutomationSystemPrompt(saved.automationSystemPrompt);
        }
        return;
      }
      case 'automationMaxSteps': {
        const parsed = Number.parseInt(draftAutomationMaxSteps.replace(/[^\d]/g, '') || '1', 10) || 1;
        const nextValue = Math.max(1, Math.min(50, parsed));
        const saved = await persistSettings({ ...settingsRef.current, automationMaxSteps: nextValue });
        if (saved) {
          setDraftAutomationMaxSteps(String(saved.automationMaxSteps));
        }
      }
    }
  }

  async function testConnection() {
    setTesting(true);
    setError('');
    setStatus('');

    const response = await sendRuntimeMessage<{ message: string }>({
      type: 'settings.testConnection',
      payload: {
        apiKey: draftApiKey,
        modelId: draftModelId,
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
  const inputClassName =
    'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60';
  const modelSelectEnabled = hydrated && modelInputMode === 'list' && availableModels.length > 0;
  const hasUnsavedApiKey = draftApiKey !== settings.apiKey;
  const hasUnsavedModelId = draftModelId !== settings.modelId;
  const hasUnsavedSystemPrompt = draftSystemPrompt !== settings.systemPrompt;
  const hasUnsavedAutomationSystemPrompt = draftAutomationSystemPrompt !== settings.automationSystemPrompt;
  const hasUnsavedAutomationMaxSteps = draftAutomationMaxSteps !== String(settings.automationMaxSteps);

  const sections: Array<{
    id: SettingsSectionId;
    label: string;
    description: string;
    icon: typeof Sparkles;
  }> = [
    { id: 'common', label: t.options.sectionCommon, description: t.options.sectionCommonDescription, icon: Sparkles },
    { id: 'chat', label: t.options.sectionChat, description: t.options.sectionChatDescription, icon: MessageSquareText },
    {
      id: 'automation',
      label: t.options.sectionAutomation,
      description: t.options.sectionAutomationDescription,
      icon: Wrench,
    },
  ];

  function renderSaveHint(dirty: boolean) {
    return (
      <div className={`text-xs ${dirty ? 'text-amber-700' : 'text-slate-500'}`}>
        {dirty ? t.options.unsavedChanges : t.options.manualSaveHint}
      </div>
    );
  }

  function renderFieldSaveButton(props: {
    dirty: boolean;
    disabled?: boolean;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className={primaryButtonClassName}
        aria-label={props.label}
        disabled={!hydrated || !props.dirty || props.disabled}
        onClick={props.onClick}
      >
        <CheckCircle2 className="h-4 w-4" />
        {t.common.save}
      </button>
    );
  }

  function renderCheckboxRow(props: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }) {
    return (
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50">
        <span className="min-w-0 flex-1 font-medium">{props.label}</span>
        <input
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          type="checkbox"
          disabled={!hydrated || props.disabled}
          checked={props.checked}
          onChange={(event) => props.onChange(event.target.checked)}
        />
      </label>
    );
  }

  function renderPromptContextSettings() {
    return (
      <div className="flex flex-col gap-2.5">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <MessageSquareText className="h-4 w-4 text-teal-600" />
          {t.options.promptContext}
        </span>

        {renderCheckboxRow({
          label: t.options.includeCurrentDateTime,
          checked: settings.includeCurrentDateTime,
          onChange: (checked) => void persistImmediate('includeCurrentDateTime', checked),
        })}

        {renderCheckboxRow({
          label: t.options.includeResponseLanguageInstruction,
          checked: settings.includeResponseLanguageInstruction,
          onChange: (checked) => void persistImmediate('includeResponseLanguageInstruction', checked),
        })}

        {renderCheckboxRow({
          label: t.options.preferLatexMathOutput,
          checked: settings.preferLatexMathOutput,
          onChange: (checked) => void persistImmediate('preferLatexMathOutput', checked),
        })}
      </div>
    );
  }

  function renderToolCard(props: {
    title: string;
    description: string;
    checked: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    accentClassName?: string;
    helpText?: string;
  }) {
    const disabled = props.disabled || !props.onChange;

    return (
      <div className={`rounded-[24px] border px-4 py-4 ${props.accentClassName ?? 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-start gap-3">
          <input
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed"
            type="checkbox"
            aria-label={props.title}
            disabled={!hydrated || disabled}
            checked={props.checked}
            onChange={(event) => props.onChange?.(event.target.checked)}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{props.title}</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">{props.description}</div>
            {props.helpText ? <div className="mt-2 text-xs leading-5 text-slate-500">{props.helpText}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.16),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-3 py-4 text-slate-900 sm:px-5 sm:py-6 lg:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200/80 bg-slate-950 px-4 py-5 text-white lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
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

            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-slate-300">
              {t.options.autoSaveHint}
            </div>

            <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label={t.options.sectionNavigation}>
              {sections.map((section) => {
                const Icon = section.icon;
                const active = section.id === activeSection;

                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`min-w-[180px] rounded-[24px] border px-4 py-3 text-left transition lg:min-w-0 ${
                      active
                        ? 'border-teal-400/30 bg-teal-400/12 text-white'
                        : 'border-white/8 bg-white/4 text-slate-300 hover:border-white/14 hover:bg-white/8'
                    }`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-2xl p-2 ${active ? 'bg-teal-400/18 text-teal-200' : 'bg-white/8 text-slate-300'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{section.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">{section.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4">{t.options.storageNote}</div>
              {showDevelopmentNotes && devDefaultApiKey ? (
                <div className="rounded-[24px] border border-teal-400/20 bg-teal-400/10 px-4 py-4">{t.options.devNote}</div>
              ) : null}
            </div>
          </aside>

          <section className="px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{sections.find((section) => section.id === activeSection)?.label}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{sections.find((section) => section.id === activeSection)?.description}</div>
            </div>

            {activeSection === 'common' ? (
              <div className="mt-5 space-y-4">
                <label className="flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Globe2 className="h-4 w-4 text-teal-600" />
                    {t.options.language}
                  </span>
                  <select
                    className={inputClassName}
                    aria-label={t.options.language}
                    disabled={!hydrated}
                    value={settings.locale}
                    onChange={(event) => void persistImmediate('locale', event.target.value as Settings['locale'])}
                  >
                    <option value="auto">{t.options.languageAuto}</option>
                    <option value="en">{t.options.languageEn}</option>
                    <option value="ja">{t.options.languageJa}</option>
                  </select>
                </label>

                <div className="flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4 text-teal-600" />
                    {t.options.apiKey}
                  </span>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className={`min-w-0 flex-1 ${inputClassName}`}
                      type="password"
                      aria-label={t.options.apiKey}
                      disabled={!hydrated}
                      value={draftApiKey}
                      onChange={(event) => setDraftApiKey(event.target.value)}
                    />
                    {renderFieldSaveButton({
                      dirty: hasUnsavedApiKey,
                      label: t.options.saveApiKey,
                      onClick: () => void saveDraftField('apiKey'),
                    })}
                  </div>
                  {renderSaveHint(hasUnsavedApiKey)}
                </div>

                <div className="flex flex-col gap-2.5">
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
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        className={`min-w-0 flex-1 ${inputClassName}`}
                        aria-label={t.options.model}
                        disabled={!modelSelectEnabled}
                        value={modelSelectEnabled ? settings.modelId : ''}
                        onChange={(event) => void persistImmediate('modelId', event.target.value)}
                      >
                        {!modelSelectEnabled ? (
                          <option value="">{modelsLoading ? t.options.refreshingModels : t.options.modelInputList}</option>
                        ) : null}
                        {availableModels.map((modelId) => (
                          <option key={modelId} value={modelId}>
                            {modelId}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={subtleButtonClassName}
                        disabled={!hydrated || modelsLoading || !draftApiKey.trim()}
                        onClick={() => void loadModels(draftApiKey, draftModelId)}
                        title={t.options.refreshModels}
                      >
                        <RefreshCcw className={`h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`} />
                        {modelsLoading ? t.options.refreshingModels : t.options.refreshModels}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        className={`min-w-0 flex-1 ${inputClassName}`}
                        type="text"
                        aria-label={t.options.modelManualEntry}
                        disabled={!hydrated}
                        value={draftModelId}
                        onChange={(event) => setDraftModelId(event.target.value)}
                      />
                      {renderFieldSaveButton({
                        dirty: hasUnsavedModelId,
                        label: t.options.saveModel,
                        onClick: () => void saveDraftField('modelId'),
                      })}
                    </div>
                  )}
                  <div className="text-xs leading-5 text-slate-500">{t.options.modelHelp}</div>
                  {modelInputMode === 'manual' ? renderSaveHint(hasUnsavedModelId) : null}
                  <div className="text-xs leading-5 text-amber-700">{t.options.modelCompatibilityNote}</div>
                  {modelsError ? <div className="text-xs text-amber-700">{t.options.modelListUnavailable} {modelsError}</div> : null}
                </div>

                <div className="mt-2 flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Brain className="h-4 w-4 text-teal-600" />
                    {t.options.reasoning}
                  </span>
                  <select
                    className={`w-full ${inputClassName}`}
                    aria-label={t.options.reasoning}
                    disabled={!hydrated}
                    value={settings.reasoningEffort}
                    onChange={(event) => void persistImmediate('reasoningEffort', event.target.value as Settings['reasoningEffort'])}
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
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
                  <button type="button" className={subtleButtonClassName} disabled={testing || !hydrated} onClick={() => void testConnection()}>
                    <Server className="h-4 w-4" />
                    {testing ? t.options.testingConnection : t.options.testConnection}
                  </button>
                </div>
              </div>
            ) : null}

            {activeSection === 'chat' ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4 text-teal-600" />
                    {t.options.tool}
                  </span>
                  {renderToolCard({
                    title: `${t.options.toolBuiltIn}: ${t.options.toolWebSearch}`,
                    description: t.options.toolChatHelp,
                    checked: settings.responseTool === 'web_search',
                    onChange: (checked) => void persistImmediate('responseTool', checked ? 'web_search' : 'none'),
                  })}
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <MessageSquareText className="h-4 w-4 text-teal-600" />
                      {t.options.systemPrompt}
                    </span>
                    <button
                      type="button"
                      className={subtleButtonClassName}
                      disabled={!hydrated || draftSystemPrompt === defaultSettings.systemPrompt}
                      onClick={() => setDraftSystemPrompt(defaultSettings.systemPrompt)}
                    >
                      {t.common.reset}
                    </button>
                  </div>
                  <textarea
                    className="min-h-[180px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 shadow-inner shadow-white/50 outline-none transition focus:border-teal-300 focus:bg-white"
                    rows={7}
                    aria-label={t.options.systemPrompt}
                    disabled={!hydrated}
                    value={draftSystemPrompt}
                    onChange={(event) => setDraftSystemPrompt(event.target.value)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {renderSaveHint(hasUnsavedSystemPrompt)}
                    {renderFieldSaveButton({
                      dirty: hasUnsavedSystemPrompt,
                      label: t.options.saveSystemPrompt,
                      onClick: () => void saveDraftField('systemPrompt'),
                    })}
                  </div>
                </div>

                {renderPromptContextSettings()}
              </div>
            ) : null}

            {activeSection === 'automation' ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4 text-amber-600" />
                    {t.options.tool}
                  </span>
                  {renderToolCard({
                    title: `${t.options.toolBuiltIn}: ${t.options.toolWebSearch}`,
                    description: t.options.toolAutomationHelp,
                    checked: settings.responseTool === 'web_search',
                    onChange: (checked) => void persistImmediate('responseTool', checked ? 'web_search' : 'none'),
                    accentClassName: 'border-amber-200 bg-amber-50/60',
                  })}
                  {renderToolCard({
                    title: t.options.toolFunctionGroup,
                    description: t.options.toolManagedByMode,
                    checked: true,
                    disabled: true,
                    accentClassName: 'border-slate-200 bg-slate-50',
                    helpText: t.options.toolFunctionGroupHelp,
                  })}
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <MessageSquareText className="h-4 w-4 text-amber-600" />
                      {t.options.automationSystemPrompt}
                    </span>
                    <button
                      type="button"
                      className={subtleButtonClassName}
                      disabled={!hydrated || draftAutomationSystemPrompt === defaultSettings.automationSystemPrompt}
                      onClick={() => setDraftAutomationSystemPrompt(defaultSettings.automationSystemPrompt)}
                    >
                      {t.common.reset}
                    </button>
                  </div>
                  <textarea
                    className="min-h-[240px] rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-6 shadow-inner shadow-white/50 outline-none transition focus:border-amber-300 focus:bg-white"
                    rows={10}
                    aria-label={t.options.automationSystemPrompt}
                    disabled={!hydrated}
                    value={draftAutomationSystemPrompt}
                    onChange={(event) => setDraftAutomationSystemPrompt(event.target.value)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {renderSaveHint(hasUnsavedAutomationSystemPrompt)}
                    {renderFieldSaveButton({
                      dirty: hasUnsavedAutomationSystemPrompt,
                      label: t.options.saveAutomationSystemPrompt,
                      onClick: () => void saveDraftField('automationSystemPrompt'),
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50">
                  <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                  <span className="min-w-0 flex-1 font-medium">{t.options.autoAttachPage}</span>
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    type="checkbox"
                    disabled={!hydrated}
                    checked={settings.autoAttachPage}
                    onChange={(event) => void persistImmediate('autoAttachPage', event.target.checked)}
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-inner shadow-white/50">
                  <FileText className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1 font-medium">{t.options.autoAttachPageStructureOnAutomation}</span>
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    type="checkbox"
                    disabled={!hydrated}
                    checked={settings.autoAttachPageStructureOnAutomation}
                    onChange={(event) => void persistImmediate('autoAttachPageStructureOnAutomation', event.target.checked)}
                  />
                </label>

                {renderPromptContextSettings()}

                <div className="flex flex-col gap-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4 text-amber-600" />
                    {t.options.automationMaxSteps}
                  </span>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className={`min-w-0 flex-1 ${inputClassName.replace('focus:border-teal-300', 'focus:border-amber-300')}`}
                      type="text"
                      inputMode="numeric"
                      aria-label={t.options.automationMaxSteps}
                      disabled={!hydrated}
                      value={draftAutomationMaxSteps}
                      onChange={(event) => setDraftAutomationMaxSteps(event.target.value.replace(/[^\d]/g, ''))}
                    />
                    {renderFieldSaveButton({
                      dirty: hasUnsavedAutomationMaxSteps,
                      label: t.options.saveAutomationMaxSteps,
                      onClick: () => void saveDraftField('automationMaxSteps'),
                    })}
                  </div>
                  <div className="text-xs leading-5 text-slate-500">{t.options.automationMaxStepsHelp}</div>
                  {renderSaveHint(hasUnsavedAutomationMaxSteps)}
                </div>
              </div>
            ) : null}

            {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}
            {status ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {status}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
