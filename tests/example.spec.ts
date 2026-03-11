import { expect, test } from '@playwright/test';
import { chromium, type BrowserContext, type Page } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve(process.cwd(), 'dist');
let fixtureServer: http.Server;
let fixtureBaseUrl = '';

async function launchExtension() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sidepanel-llm-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !!process.env.CI,
    args: [
      '--disable-gpu',
      '--use-angle=swiftshader',
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

async function openFixturePage(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(`${fixtureBaseUrl}/fixture`, { waitUntil: 'domcontentloaded' });
  return page;
}

async function selectText(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    const selection = window.getSelection();
    if (!selection) {
      throw new Error('Selection API unavailable.');
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function clickButtonInBackground(page: Page, label: string) {
  await page.evaluate((buttonLabel) => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (element) => element.textContent?.trim() === buttonLabel,
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Button not found: ${buttonLabel}`);
    }

    button.click();
  }, label);
}

async function saveSettings(page: Page, settings?: { apiKey?: string; modelId?: string; systemPrompt?: string }) {
  if (settings?.apiKey !== undefined) {
    await page.getByLabel('API key').fill(settings.apiKey);
  }

  if (settings?.modelId !== undefined) {
    await page.getByLabel('Model').fill(settings.modelId);
  }

  if (settings?.systemPrompt !== undefined) {
    await page.getByLabel('System prompt').fill(settings.systemPrompt);
  }

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
}

test.beforeAll(async () => {
  await fs.access(path.join(extensionPath, 'manifest.json'));

  fixtureServer = http.createServer((request, response) => {
    if (request.url !== '/fixture') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Fixture Article</title>
        </head>
        <body>
          <main>
            <h1>Fixture Article</h1>
            <p id="lead">Selected text for extension capture.</p>
            <p>
              This page exists to verify that the content script can read page text
              and the current selection from the active tab.
            </p>
          </main>
        </body>
      </html>
    `);
  });

  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = fixtureServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine fixture server address.');
  }

  fixtureBaseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    fixtureServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test('loads the extension options page and saves settings', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const page = await openExtensionPage(context, extensionId, 'options.html');

    await expect(page.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible();
    await saveSettings(page, {
      apiKey: 'test-api-key',
      modelId: 'gpt-4.1-mini',
      systemPrompt: 'Be concise.',
    });

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

test('captures selection text and page text from the active tab', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const fixturePage = await openFixturePage(context);
    await fixturePage.bringToFront();
    await selectText(fixturePage, '#lead');

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');

    await expect(sidepanelPage.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible();

    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Capture selection');
    await expect(sidepanelPage.getByText(/Selection: Selected text for extension capture\./)).toBeVisible();

    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Capture page');
    await expect(sidepanelPage.getByText(/Page: Fixture Article/)).toBeVisible();
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('captures a screenshot from the active tab and shows a preview', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const fixturePage = await openFixturePage(context);
    await fixturePage.setViewportSize({ width: 1200, height: 800 });
    await fixturePage.bringToFront();

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await expect(sidepanelPage.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible();

    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Capture screenshot');

    const screenshotChip = sidepanelPage.getByText(/Screenshot: Fixture Article/);
    await expect(screenshotChip).toBeVisible();

    const preview = sidepanelPage.getByAltText('Attached screenshot preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('src', /^data:image\/png;base64,/);
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('sends a chat request with mocked provider response', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    await context.route('https://api.openai.com/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1735689600,
          model: 'gpt-4.1-mini',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Mocked assistant reply.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 4,
            total_tokens: 16,
          },
        }),
      });
    });

    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await saveSettings(optionsPage, {
      apiKey: 'test-api-key',
      modelId: 'gpt-4.1-mini',
      systemPrompt: 'Test system prompt.',
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await expect(sidepanelPage.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible();

    await sidepanelPage.getByPlaceholder('Ask about the current page...').fill('Hello from Playwright');
    await sidepanelPage.getByRole('button', { name: 'Send' }).click();

    await expect(sidepanelPage.locator('.message.user')).toContainText('Hello from Playwright');
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Mocked assistant reply.');
    await expect(sidepanelPage.locator('.session-item').first()).toContainText('Hello from Playwright');
  } finally {
    await closeExtension(context, userDataDir);
  }
});
