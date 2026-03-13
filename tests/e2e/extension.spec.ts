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
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const page = await context.newPage();

    try {
      await page.goto(`chrome-extension://${extensionId}/${pageName}`, {
        waitUntil: 'domcontentloaded',
      });
      return page;
    } catch (error) {
      lastError = error;
      await page.close();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

async function openFixturePage(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(`${fixtureBaseUrl}/fixture`, { waitUntil: 'domcontentloaded' });
  return page;
}

async function waitForSidepanelReady(page: Page) {
  await expect(page.getByRole('button', { name: /^(Settings|設定)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(New chat|新しいチャット)$/ })).toBeVisible({
    timeout: 10_000,
  });
}

async function waitForOptionsReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Sidepanel LLM' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('select').first()).toBeEnabled();
}

function optionsFields(page: Page) {
  return {
    locale: page.getByRole('combobox', { name: /^(Language|表示言語)$/ }),
    apiKey: page.locator('input[type="password"]'),
    modelInputList: page.getByRole('radio', { name: /^(Choose from list|リストから選択)$/ }),
    modelInputManual: page.getByRole('radio', { name: /^(Enter manually|手入力)$/ }),
    modelSelect: page.getByRole('combobox', { name: /^(Model|モデル)$/ }),
    modelId: page.getByLabel(/^(Manual model ID entry|モデル ID を手入力)$/),
    responseTool: page.getByRole('combobox', { name: /^Tool$/ }),
    reasoningEffort: page.getByRole('combobox', { name: /^Reasoning$/ }),
    refreshModels: page.getByRole('button', { name: /^(Refresh models|モデル一覧を更新)$/ }),
    systemPrompt: page.locator('textarea'),
    autoAttachPage: page.getByLabel(/^(Auto attach full page on first message|最初の送信時にページ全文を自動添付)$/),
  };
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
    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
}

async function clickButtonInBackground(page: Page, label: string) {
  await page.evaluate((buttonLabel) => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (element) =>
        element.textContent?.trim() === buttonLabel ||
        element.getAttribute('aria-label') === buttonLabel ||
        element.getAttribute('title') === buttonLabel,
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Button not found: ${buttonLabel}`);
    }

    button.click();
  }, label);
}

async function saveSettings(
  page: Page,
  settings?: {
    apiKey?: string;
    modelId?: string;
    responseTool?: 'none' | 'web_search';
    reasoningEffort?: 'default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    systemPrompt?: string;
    locale?: 'auto' | 'en' | 'ja';
    autoAttachPage?: boolean;
  },
) {
  const fields = optionsFields(page);

  if (settings?.apiKey !== undefined) {
    await fields.apiKey.fill(settings.apiKey);
  }

  if (settings?.modelId !== undefined) {
    await fields.modelInputManual.click();
    await fields.modelId.fill(settings.modelId);
  }

  if (settings?.responseTool !== undefined) {
    await fields.responseTool.selectOption(settings.responseTool);
    await expect(fields.responseTool).toHaveValue(settings.responseTool);
  }

  if (settings?.reasoningEffort !== undefined) {
    await fields.reasoningEffort.selectOption(settings.reasoningEffort);
    await expect(fields.reasoningEffort).toHaveValue(settings.reasoningEffort);
  }

  if (settings?.systemPrompt !== undefined) {
    await fields.systemPrompt.fill(settings.systemPrompt);
  }

  if (settings?.locale !== undefined) {
    await fields.locale.selectOption(settings.locale);
    await expect(fields.locale).toHaveValue(settings.locale);
  }

  if (settings?.autoAttachPage !== undefined) {
    if (settings.autoAttachPage) {
      await fields.autoAttachPage.check();
      await expect(fields.autoAttachPage).toBeChecked();
    } else {
      await fields.autoAttachPage.uncheck();
      await expect(fields.autoAttachPage).not.toBeChecked();
    }
  }

  await page.getByRole('button', { name: /^(Save|保存)$/ }).click();
  await expect(page.getByText(/^(Saved\.|保存しました。)$/)).toBeVisible();
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

    await waitForOptionsReady(page);
    await saveSettings(page, {
      apiKey: 'test-api-key',
      modelId: 'gpt-4.1-mini',
      responseTool: 'web_search',
      reasoningEffort: 'high',
      systemPrompt: 'Be concise.',
      autoAttachPage: true,
    });

    await page.close();

    const reloadedPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(reloadedPage);
    const fields = optionsFields(reloadedPage);
    await expect(fields.locale).toHaveValue('auto');
    await expect(fields.apiKey).toHaveValue('test-api-key');
    await expect(fields.modelId).toHaveValue('gpt-4.1-mini');
    await expect(fields.responseTool).toHaveValue('web_search');
    await expect(fields.reasoningEffort).toHaveValue('high');
    await expect(fields.systemPrompt).toHaveValue('Be concise.');
    await expect(fields.autoAttachPage).toBeChecked();
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('shows a setup modal in the sidepanel when the API key is missing', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const page = await openExtensionPage(context, extensionId, 'sidepanel.html');

    await expect(page.getByRole('dialog', { name: /^(Set up your API key|API キーを設定してください)$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Open Settings|設定を開く)$/ })).toBeVisible();
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('loads the latest model list from the API and lets the user select one', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    await context.route('https://api.openai.com/v1/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          object: 'list',
          data: [
            { id: 'gpt-5.4', object: 'model' },
            { id: 'gpt-4.1-mini', object: 'model' },
            { id: 'gpt-4.1', object: 'model' },
          ],
        }),
      });
    });

    const page = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(page);

    const fields = optionsFields(page);
    await fields.apiKey.fill('test-api-key');
    await fields.modelInputList.click();
    await fields.refreshModels.click();

    await expect(fields.modelInputList).toHaveAttribute('aria-checked', 'true');
    await expect(fields.modelSelect).toBeEnabled();
    await fields.modelSelect.selectOption('gpt-4.1');
    await expect(fields.modelSelect).toHaveValue('gpt-4.1');

    await page.getByRole('button', { name: /^(Save|保存)$/ }).click();
    await expect(page.getByText(/^(Saved\.|保存しました。)$/)).toBeVisible();

    const reloadedPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(reloadedPage);
    await expect(optionsFields(reloadedPage).modelInputList).toHaveAttribute('aria-checked', 'true');
    await expect(optionsFields(reloadedPage).modelSelect).toHaveValue('gpt-4.1');
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('loads the sidepanel UI and can create a new empty session', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(optionsPage);
    await saveSettings(optionsPage, { apiKey: 'test-api-key' });

    const page = await openExtensionPage(context, extensionId, 'sidepanel.html');

    await waitForSidepanelReady(page);
    await expect(page.getByRole('button', { name: 'Sessions', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'New chat' }).click();
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();

    await expect(page.locator('.session-item')).toHaveCount(1);
    await expect(page.locator('.session-item').first()).toContainText('New chat');
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('applies Japanese UI copy when the saved locale is set to ja', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(optionsPage);
    await saveSettings(optionsPage, { locale: 'ja', apiKey: 'test-api-key' });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await sidepanelPage.setViewportSize({ width: 420, height: 900 });
    await waitForSidepanelReady(sidepanelPage);
    await expect(sidepanelPage.getByRole('button', { name: '新しいチャット' })).toBeVisible();
    await sidepanelPage.getByRole('button', { name: 'セッション', exact: true }).click();
    await expect(sidepanelPage.locator('.session-item')).toHaveCount(0);
    await expect(sidepanelPage.getByText('まだセッションはありません。')).toBeVisible();
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('captures selection text and page text from the active tab', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(optionsPage);
    await saveSettings(optionsPage, { apiKey: 'test-api-key' });

    const fixturePage = await openFixturePage(context);
    await fixturePage.bringToFront();
    await selectText(fixturePage, '#lead');
    await fixturePage.waitForTimeout(250);

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');

    await waitForSidepanelReady(sidepanelPage);

    await expect(sidepanelPage.getByText(/Selection: Selected text for extension capture\./)).toBeVisible();
    await expect(sidepanelPage.getByText('Selected text for extension capture.', { exact: true })).toBeVisible();

    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Capture page');
    await expect(sidepanelPage.getByText(/Page: Fixture Article/)).toBeVisible();
    await expect(sidepanelPage.getByRole('button', { name: 'Delete' })).toHaveCount(2);

    await sidepanelPage.getByRole('button', { name: 'Delete' }).first().click();
    await expect(sidepanelPage.getByRole('button', { name: 'Delete' })).toHaveCount(1);
    await expect(sidepanelPage.getByText(/Selection: Selected text for extension capture\./)).toHaveCount(0);
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('captures a screenshot from the active tab and shows a preview', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(optionsPage);
    await saveSettings(optionsPage, { apiKey: 'test-api-key' });

    const fixturePage = await openFixturePage(context);
    await fixturePage.setViewportSize({ width: 1200, height: 800 });
    await fixturePage.bringToFront();

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Capture screenshot');

    const screenshotChip = sidepanelPage.getByText(/Screenshot: Fixture Article/);
    await expect(screenshotChip).toBeVisible();

    const preview = sidepanelPage.getByAltText('Attached screenshot preview').first();
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('src', /^data:image\/png;base64,/);

    await sidepanelPage.getByRole('button', { name: /Open attachment: Screenshot: Fixture Article/ }).click();
    const dialog = sidepanelPage.getByRole('dialog', { name: 'Screenshot: Fixture Article' });
    await expect(dialog).toBeVisible();
    const dialogPreview = dialog.getByAltText('Attached screenshot preview');
    await expect(dialogPreview).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect(dialogPreview).toHaveAttribute('style', /width: 100%/);
    await dialog.getByRole('button', { name: 'Zoom in' }).click();
    await expect(dialogPreview).toHaveAttribute('style', /width: 125%/);
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox?.width).toBeLessThanOrEqual(420);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('preloads selected text when the sidepanel opens after text selection', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(optionsPage);
    await saveSettings(optionsPage, { apiKey: 'test-api-key' });

    const fixturePage = await openFixturePage(context);
    await fixturePage.bringToFront();
    await selectText(fixturePage, '#lead');

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    await expect(sidepanelPage.getByText(/Selection: Selected text for extension capture\./)).toBeVisible();
    await expect(sidepanelPage.getByText('Selected text for extension capture.', { exact: true })).toBeVisible();
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('sends a chat request with mocked provider response', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();
  let lastRequestBody = '';

  try {
    await context.route('**/v1/responses', async (route) => {
      lastRequestBody = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'resp_test',
          object: 'response',
          created_at: 1735689600,
          model: 'gpt-4.1-mini',
          output_text: 'Mocked assistant reply.',
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: {},
          output: [
            {
              id: 'msg_123',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Mocked assistant reply.',
                  annotations: [],
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          temperature: 1,
          tool_choice: 'auto',
          tools: [{ type: 'web_search_preview' }],
          top_p: 1,
          max_output_tokens: null,
          previous_response_id: null,
          reasoning: null,
          status: 'completed',
          usage: {
            input_tokens: 12,
            output_tokens: 4,
            total_tokens: 16,
          },
        }),
      });
    });

    const fixturePage = await openFixturePage(context);
    await fixturePage.bringToFront();

    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await saveSettings(optionsPage, {
      locale: 'en',
      apiKey: 'test-api-key',
      modelId: 'gpt-4.1-mini',
      responseTool: 'web_search',
      reasoningEffort: 'high',
      systemPrompt: 'Test system prompt.',
      autoAttachPage: true,
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    await expect(sidepanelPage.getByLabel('Auto attach full page on first message')).toBeChecked();
    await sidepanelPage.getByPlaceholder('Ask about the current page...').fill('Hello from Playwright');
    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Send');

    await expect(sidepanelPage.locator('.message.user')).toContainText('Hello from Playwright');
    await expect(sidepanelPage.locator('.message.user')).toContainText('Page: Fixture Article');
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Mocked assistant reply.', {
      timeout: 10_000,
    });
    expect(lastRequestBody).toContain('Attachment type: Page text');
    expect(lastRequestBody).toContain('Source details:');
    expect(lastRequestBody).toContain('URL: http://127.0.0.1');
    expect(lastRequestBody).toContain('"type":"web_search_preview"');
    expect(lastRequestBody).toContain('"reasoning":{"effort":"high"}');

    await sidepanelPage.getByRole('button', { name: /Open attachment: Page: Fixture Article/ }).click();
    const dialog = sidepanelPage.getByRole('dialog', { name: 'Page: Fixture Article' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('URL: http://127.0.0.1');
    await expect(sidepanelPage.locator('.message.user')).toContainText('Hostname: 127.0.0.1');
    await expect(dialog).toContainText('This page exists to verify that the content script can read page text');
    await sidepanelPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await sidepanelPage.locator('.message.user').getByRole('button', { name: 'Delete' }).first().click();
    await expect(sidepanelPage.locator('.message.user')).toHaveCount(0);
    await sidepanelPage.getByRole('button', { name: 'Sessions', exact: true }).click();
    await expect(sidepanelPage.locator('.session-item').first()).toContainText('Hello from Playwright');
  } finally {
    await closeExtension(context, userDataDir);
  }
});
