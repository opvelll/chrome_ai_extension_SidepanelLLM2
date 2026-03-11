import { expect, test } from '@playwright/test';
import { chromium, type BrowserContext, type Page } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve(process.cwd(), 'dist');

async function launchExtension() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sidepanel-llm-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !!process.env.CI,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = new URL(serviceWorker.url()).host;
  return { context, extensionId, userDataDir };
}

async function closeExtension(context: BrowserContext, userDataDir: string) {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}

async function openExtensionPage(context: BrowserContext, extensionId: string, pageName: 'options.html' | 'sidepanel.html') {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${pageName}`);
  return page;
}

test.beforeAll(async () => {
  await fs.access(path.join(extensionPath, 'manifest.json'));
});

test('loads the extension options page and saves settings', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const page = await openExtensionPage(context, extensionId, 'options.html');

    await expect(page.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible();
    await page.getByLabel('API key').fill('test-api-key');
    await page.getByLabel('Model').fill('gpt-4.1-mini');
    await page.getByLabel('System prompt').fill('Be concise.');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('API key')).toHaveValue('test-api-key');
    await expect(page.getByLabel('Model')).toHaveValue('gpt-4.1-mini');
    await expect(page.getByLabel('System prompt')).toHaveValue('Be concise.');
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('loads the sidepanel UI and can create a new empty session', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const page = await openExtensionPage(context, extensionId, 'sidepanel.html');

    await expect(page.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible();
    await expect(page.getByText('No sessions yet.')).toBeVisible();
    await expect(page.getByText('Start a chat, then attach page context if needed.')).toBeVisible();

    await page.getByRole('button', { name: 'New' }).click();

    await expect(page.locator('.session-item')).toHaveCount(1);
    await expect(page.locator('.session-item').first()).toContainText('New chat');
  } finally {
    await closeExtension(context, userDataDir);
  }
});
