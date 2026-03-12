import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Sidepanel LLM',
  version: '0.1.0',
  description: 'Side panel chat extension with browser context capture.',
  permissions: ['storage', 'activeTab', 'tabs', 'sidePanel']
,
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'sidepanel.html',
  },
  options_page: 'options.html',
  action: {
    default_title: 'Open Sidepanel LLM',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
});
