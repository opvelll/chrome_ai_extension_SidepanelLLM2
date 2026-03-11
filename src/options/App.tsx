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

  return (
    <div className="options-shell">
      <div className="options-card">
        <div className="eyebrow">Settings</div>
        <h1>Sidepanel LLM</h1>
        <p className="options-copy">Configure the OpenAI API used by the side panel.</p>
        <p className="storage-note">
          Production builds require the user to enter an API key. Saved settings are stored in <code>chrome.storage.local</code> on this browser profile only.
        </p>
        {devDefaultApiKey ? (
          <p className="storage-note">
            Development mode detected: the API key field was prefilled from <code>.env</code>. Saving will persist the current value to local extension storage.
          </p>
        ) : null}

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
