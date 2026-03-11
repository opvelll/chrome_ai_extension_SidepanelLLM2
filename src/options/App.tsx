import { useEffect, useState } from 'react';
import type { AsyncResponse } from '../shared/messages';
import { DEFAULT_SETTINGS, type Settings } from '../shared/models';

async function sendMessage<T>(payload: unknown): Promise<AsyncResponse<T>> {
  return chrome.runtime.sendMessage(payload) as Promise<AsyncResponse<T>>;
}

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

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
        baseUrl: settings.baseUrl,
      },
    });

    setTesting(false);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setStatus(`Connection ok: ${response.data.message}`);
  }

  return (
    <div className="options-shell">
      <div className="options-card">
        <div className="eyebrow">Settings</div>
        <h1>Sidepanel LLM</h1>
        <p className="options-copy">Configure the OpenAI-compatible endpoint used by the side panel.</p>

        <label className="field">
          <span>API key</span>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
          />
        </label>

        <label className="field">
          <span>Model</span>
          <input
            type="text"
            value={settings.modelId}
            onChange={(event) => setSettings((current) => ({ ...current, modelId: event.target.value }))}
          />
        </label>

        <label className="field">
          <span>Chat completions URL</span>
          <input
            type="url"
            value={settings.baseUrl}
            onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}
          />
        </label>

        <label className="field">
          <span>System prompt</span>
          <textarea
            rows={6}
            value={settings.systemPrompt}
            onChange={(event) => setSettings((current) => ({ ...current, systemPrompt: event.target.value }))}
          />
        </label>

        {error && <div className="status error">{error}</div>}
        {status && <div className="status">{status}</div>}

        <div className="options-actions">
          <button className="ghost-button" disabled={testing} onClick={() => void testConnection()}>
            {testing ? 'Testing...' : 'Test connection'}
          </button>
          <button className="primary-button" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
