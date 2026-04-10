import { expect, test } from '@playwright/test';
import { chromium, type BrowserContext, type Page, type Route } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve(process.cwd(), 'dist');
let fixtureServer: http.Server;
let fixtureBaseUrl = '';

function resolveHeadlessMode() {
  const override = process.env.E2E_HEADLESS;

  if (override === '1' || override === 'true') {
    return true;
  }

  if (override === '0' || override === 'false') {
    return false;
  }

  return !!process.env.CI;
}

async function launchExtension() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sidepanel-llm-pw-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: resolveHeadlessMode(),
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
    commonSection: page.getByRole('button', { name: /Common settings|共通設定/ }),
    chatSection: page.getByRole('button', { name: /Chat mode|チャットモード/ }),
    automationSection: page.getByRole('button', { name: /Automation mode|自動操作モード/ }),
    locale: page.getByRole('combobox', { name: /^(Language|表示言語)$/ }),
    apiKey: page.locator('input[type="password"]'),
    saveApiKey: page.getByRole('button', { name: /^(Save API key|API キーを保存)$/ }),
    modelInputList: page.getByRole('radio', { name: /^(Choose from list|リストから選択)$/ }),
    modelInputManual: page.getByRole('radio', { name: /^(Enter manually|手入力)$/ }),
    modelSelect: page.getByRole('combobox', { name: /^(Model|モデル)$/ }),
    modelId: page.getByLabel(/^(Manual model ID entry|モデル ID を手入力)$/),
    saveModel: page.getByRole('button', { name: /^(Save model|モデルを保存)$/ }),
    responseTool: page.getByRole('checkbox', { name: /Web search|Web 検索/ }),
    reasoningEffort: page.getByRole('combobox', { name: /^(Reasoning|Reasoning effort)$/ }),
    refreshModels: page.getByRole('button', { name: /^(Refresh models|モデル一覧を更新)$/ }),
    systemPrompt: page.getByLabel(/^(System prompt|システムプロンプト)$/),
    automationSystemPrompt: page.getByLabel(/^(Automation mode prompt|自動操作モード用プロンプト)$/),
    saveSystemPrompt: page.getByRole('button', { name: /^(Save system prompt|システムプロンプトを保存)$/ }),
    saveAutomationSystemPrompt: page.getByRole('button', { name: /^(Save automation prompt|自動操作モード用プロンプトを保存)$/ }),
    resetSystemPrompt: page.getByRole('button', { name: /^(Reset|リセット)$/ }),
    resetAutomationSystemPrompt: page.getByRole('button', { name: /^(Reset|リセット)$/ }),
    includeCurrentDateTime: page.getByLabel(/^(Include current date and time|現在日時を含める)$/),
    includeResponseLanguageInstruction: page.getByLabel(/^(Include response language instruction|返答言語の指示を含める)$/),
    preferLatexMathOutput: page.getByLabel(/^(Ask the model to format math with LaTeX \$ delimiters|数式は LaTeX の \$ 区切りで出力するよう促す)$/),
    composerSubmitBehavior: page.getByRole('combobox', { name: /^(Input behavior|入力動作)$/ }),
    autoAttachPage: page.getByLabel(/^(Auto attach full page on first message|最初の送信時にページ全文を自動添付)$/),
    autoAttachPageStructureOnAutomation: page.getByLabel(/^(Auto attach page structure on first automation message|自動操作モードの初回送信時にページ構造を自動添付)$/),
    automationMaxSteps: page.getByLabel(/^(Automation step limit|自動操作のステップ上限)$/),
    saveAutomationMaxSteps: page.getByRole('button', { name: /^(Save automation step limit|自動操作のステップ上限を保存)$/ }),
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
    automationSystemPrompt?: string;
    locale?: 'auto' | 'en' | 'ja';
    includeCurrentDateTime?: boolean;
    includeResponseLanguageInstruction?: boolean;
    preferLatexMathOutput?: boolean;
    composerSubmitBehavior?: 'enter_to_send' | 'ctrl_enter_to_send';
    autoAttachPage?: boolean;
    autoAttachPageStructureOnAutomation?: boolean;
    automationMaxSteps?: number;
  },
) {
  const fields = optionsFields(page);

  await fields.commonSection.click();

  if (settings?.apiKey !== undefined) {
    await fields.apiKey.fill(settings.apiKey);
    await fields.saveApiKey.click();
    await expect(fields.saveApiKey).toBeDisabled();
  }

  if (settings?.modelId !== undefined) {
    await fields.modelInputManual.click();
    await fields.modelId.fill(settings.modelId);
    await fields.saveModel.click();
    await expect(fields.saveModel).toBeDisabled();
  }

  if (settings?.responseTool !== undefined) {
    await fields.chatSection.click();
    const shouldEnableWebSearch = settings.responseTool === 'web_search';
    if ((await fields.responseTool.isChecked()) !== shouldEnableWebSearch) {
      await fields.responseTool.click();
      await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
    }
    if (shouldEnableWebSearch) {
      await expect(fields.responseTool).toBeChecked();
    } else {
      await expect(fields.responseTool).not.toBeChecked();
    }
  }

  if (settings?.reasoningEffort !== undefined) {
    await fields.commonSection.click();
    await fields.reasoningEffort.selectOption(settings.reasoningEffort);
    await expect(fields.reasoningEffort).toHaveValue(settings.reasoningEffort);
    await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
  }

  if (settings?.systemPrompt !== undefined) {
    await fields.chatSection.click();
    await fields.systemPrompt.fill(settings.systemPrompt);
    await fields.saveSystemPrompt.click();
    await expect(fields.saveSystemPrompt).toBeDisabled();
  }

  if (settings?.automationSystemPrompt !== undefined) {
    await fields.automationSection.click();
    await fields.automationSystemPrompt.fill(settings.automationSystemPrompt);
    await fields.saveAutomationSystemPrompt.click();
    await expect(fields.saveAutomationSystemPrompt).toBeDisabled();
  }

  if (settings?.locale !== undefined) {
    await fields.commonSection.click();
    await fields.locale.selectOption(settings.locale);
    await expect(fields.locale).toHaveValue(settings.locale);
    await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
  }

  if (settings?.includeCurrentDateTime !== undefined) {
    await fields.chatSection.click();
    const includeCurrentDateTimeChanged = (await fields.includeCurrentDateTime.isChecked()) !== settings.includeCurrentDateTime;
    if (includeCurrentDateTimeChanged) {
      await fields.includeCurrentDateTime.click();
    }
    if (settings.includeCurrentDateTime) {
      await expect(fields.includeCurrentDateTime).toBeChecked();
    } else {
      await expect(fields.includeCurrentDateTime).not.toBeChecked();
    }
    if (includeCurrentDateTimeChanged) {
      await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
    }
  }

  if (settings?.includeResponseLanguageInstruction !== undefined) {
    await fields.chatSection.click();
    const includeLanguageInstructionChanged =
      (await fields.includeResponseLanguageInstruction.isChecked()) !== settings.includeResponseLanguageInstruction;
    if (includeLanguageInstructionChanged) {
      await fields.includeResponseLanguageInstruction.click();
    }
    if (settings.includeResponseLanguageInstruction) {
      await expect(fields.includeResponseLanguageInstruction).toBeChecked();
    } else {
      await expect(fields.includeResponseLanguageInstruction).not.toBeChecked();
    }
    if (includeLanguageInstructionChanged) {
      await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
    }
  }

  if (settings?.preferLatexMathOutput !== undefined) {
    await fields.chatSection.click();
    const preferLatexChanged = (await fields.preferLatexMathOutput.isChecked()) !== settings.preferLatexMathOutput;
    if (preferLatexChanged) {
      await fields.preferLatexMathOutput.click();
    }
    if (settings.preferLatexMathOutput) {
      await expect(fields.preferLatexMathOutput).toBeChecked();
    } else {
      await expect(fields.preferLatexMathOutput).not.toBeChecked();
    }
    if (preferLatexChanged) {
      await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
    }
  }

  if (settings?.composerSubmitBehavior !== undefined) {
    await fields.commonSection.click();
    await fields.composerSubmitBehavior.selectOption(settings.composerSubmitBehavior);
    await expect(fields.composerSubmitBehavior).toHaveValue(settings.composerSubmitBehavior);
    await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
  }

  if (settings?.autoAttachPage !== undefined) {
    await fields.automationSection.click();
    const autoAttachPageChanged = (await fields.autoAttachPage.isChecked()) !== settings.autoAttachPage;
    if (autoAttachPageChanged) {
      await fields.autoAttachPage.click();
    }
    if (settings.autoAttachPage) {
      await expect(fields.autoAttachPage).toBeChecked();
    } else {
      await expect(fields.autoAttachPage).not.toBeChecked();
    }
    if (autoAttachPageChanged) {
      await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
    }
  }

  if (settings?.autoAttachPageStructureOnAutomation !== undefined) {
    await fields.automationSection.click();
    const autoAttachStructureChanged =
      (await fields.autoAttachPageStructureOnAutomation.isChecked()) !== settings.autoAttachPageStructureOnAutomation;
    if (autoAttachStructureChanged) {
      await fields.autoAttachPageStructureOnAutomation.click();
    }
    if (settings.autoAttachPageStructureOnAutomation) {
      await expect(fields.autoAttachPageStructureOnAutomation).toBeChecked();
    } else {
      await expect(fields.autoAttachPageStructureOnAutomation).not.toBeChecked();
    }
    if (autoAttachStructureChanged) {
      await expect(page.getByText(/^(Saved automatically\.|自動保存しました。)$/)).toBeVisible();
    }
  }

  if (settings?.automationMaxSteps !== undefined) {
    await fields.automationSection.click();
    await fields.automationMaxSteps.fill(String(settings.automationMaxSteps));
    await expect(fields.automationMaxSteps).toHaveValue(String(settings.automationMaxSteps));
    await fields.saveAutomationMaxSteps.click();
    await expect(fields.saveAutomationMaxSteps).toBeDisabled();
  }
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
            <form
              id="fixture-search-form"
              onsubmit="event.preventDefault(); document.getElementById('search-result').textContent = 'Search submitted: ' + document.getElementById('fixture-search-input').value;"
            >
              <label for="fixture-search-input">Search</label>
              <input id="fixture-search-input" name="q" placeholder="Search term" />
              <button type="submit">Run search</button>
            </form>
            <p id="search-result" aria-live="polite"></p>
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
  test.slow();
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    const page = await openExtensionPage(context, extensionId, 'options.html');

    await waitForOptionsReady(page);

    await saveSettings(page, {
      apiKey: 'test-api-key',
      responseTool: 'web_search',
      reasoningEffort: 'high',
      preferLatexMathOutput: true,
      autoAttachPage: true,
      autoAttachPageStructureOnAutomation: false,
      automationMaxSteps: 9,
    });

    await page.close();

    const reloadedPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(reloadedPage);
    const reloadedFields = optionsFields(reloadedPage);
    await reloadedFields.commonSection.click();
    await expect(reloadedFields.locale).toHaveValue('auto');
    await expect(reloadedFields.apiKey).toHaveValue('test-api-key');
    await expect(reloadedFields.reasoningEffort).toHaveValue('high');
    await reloadedFields.chatSection.click();
    await expect(reloadedFields.responseTool).toBeChecked();
    await expect(reloadedFields.preferLatexMathOutput).toBeChecked();
    await reloadedFields.automationSection.click();
    await expect(reloadedFields.autoAttachPage).toBeChecked();
    await expect(reloadedFields.autoAttachPageStructureOnAutomation).not.toBeChecked();
    await expect(reloadedFields.automationMaxSteps).toHaveValue('9');
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
    await fields.saveApiKey.click();
    await expect(fields.saveApiKey).toBeDisabled();
    await fields.modelInputList.click();
    await fields.refreshModels.click();

    await expect(fields.modelInputList).toHaveAttribute('aria-checked', 'true');
    await expect(fields.modelSelect).toBeEnabled();
    await fields.modelSelect.selectOption('gpt-4.1');
    await expect(fields.modelSelect).toHaveValue('gpt-4.1');
    await expect(fields.modelSelect).toHaveValue('gpt-4.1');

    const reloadedPage = await openExtensionPage(context, extensionId, 'options.html');
    await waitForOptionsReady(reloadedPage);
    await expect(optionsFields(reloadedPage).modelInputManual).toHaveAttribute('aria-checked', 'true');
    await expect(optionsFields(reloadedPage).modelId).toHaveValue('gpt-4.1');
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
  test.slow();
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
          output_text: '**Mocked** assistant reply.\n\n- First result\n- Second result\n\nInline math $x^2$.\n\n$$N=p_1p_2\\cdots p_n+1$$\n\n`fixture article`',
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: {},
          output: [
            {
              id: 'ws_123',
              type: 'web_search_call',
              status: 'completed',
              action: {
                type: 'search',
                query: 'fixture article',
                queries: ['fixture article'],
                sources: [],
              },
            },
            {
              id: 'msg_123',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: '**Mocked** assistant reply.\n\n- First result\n- Second result\n\nInline math $x^2$.\n\n$$N=p_1p_2\\cdots p_n+1$$\n\n`fixture article`',
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
      responseTool: 'web_search',
      reasoningEffort: 'high',
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
    await expect(sidepanelPage.locator('.message.assistant strong')).toContainText('Mocked');
    await expect(sidepanelPage.locator('.message.assistant li')).toHaveCount(2);
    await expect(sidepanelPage.locator('.message.assistant code')).toContainText('fixture article');
    await expect(sidepanelPage.locator('.message.assistant .katex')).toHaveCount(2);
    await expect(sidepanelPage.locator('.message.assistant')).not.toContainText('$$N=p_1p_2\\cdots p_n+1$$');
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Web search used');
    await expect(sidepanelPage.locator('.message.log')).toContainText('Web search');
    await sidepanelPage.locator('.message.log').filter({ hasText: 'Web search' }).click();
    await expect(sidepanelPage.locator('.message.log')).toContainText('fixture article');
    expect(lastRequestBody).toContain('Attachment type: Page text');
    expect(lastRequestBody).toContain('Source details:');
    expect(lastRequestBody).toContain('URL: http://127.0.0.1');
    expect(lastRequestBody).toContain('"type":"web_search_preview"');
    expect(lastRequestBody).toContain('"include":["web_search_call.action.sources"]');
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

test('keeps the composer stable while waiting for a chat response', async () => {
  test.slow();
  const { context, extensionId, userDataDir } = await launchExtension();
  let resolvePendingRoute: ((route: Route) => void) | null = null;
  const pendingRoutePromise = new Promise<Route>((resolve) => {
    resolvePendingRoute = resolve;
  });

  try {
    await context.route('**/v1/responses', async (route) => {
      resolvePendingRoute?.(route);
    });

    const optionsPage = await openExtensionPage(context, extensionId, 'options.html');
    await saveSettings(optionsPage, {
      locale: 'en',
      apiKey: 'test-api-key',
      autoAttachPage: false,
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    const textarea = sidepanelPage.locator('textarea');
    await textarea.fill('Check pending composer stability');

    const before = await textarea.evaluate((element) => {
      const composer = element.closest('section');
      if (!(composer instanceof HTMLElement)) {
        throw new Error('Composer section not found.');
      }

      (globalThis as typeof globalThis & { __composerTextarea?: HTMLTextAreaElement }).__composerTextarea =
        element as HTMLTextAreaElement;

      const rect = composer.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

    await clickButtonInBackground(sidepanelPage, 'Send');

    await expect(async () => {
      expect(await sidepanelPage.getByRole('button', { name: 'Send' }).isDisabled()).toBe(true);
    }).toPass();

    const pending = await textarea.evaluate((element) => {
      const composer = element.closest('section');
      if (!(composer instanceof HTMLElement)) {
        throw new Error('Composer section not found.');
      }

      const rect = composer.getBoundingClientRect();
      const sameTextarea =
        (globalThis as typeof globalThis & { __composerTextarea?: HTMLTextAreaElement }).__composerTextarea === element;

      return {
        sameTextarea,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });

    expect(pending.sameTextarea).toBe(true);
    expect(pending.x).toBeCloseTo(before.x, 0);
    expect(pending.y).toBeCloseTo(before.y, 0);
    expect(pending.width).toBeCloseTo(before.width, 0);
    expect(pending.height).toBeCloseTo(before.height, 0);

    const pendingRoute = await pendingRoutePromise;
    await pendingRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'resp_pending_state',
        object: 'response',
        created_at: 1735689600,
        model: 'gpt-4.1-mini',
        output_text: 'Pending state verified.',
        error: null,
        incomplete_details: null,
        instructions: null,
        metadata: {},
        output: [
          {
            id: 'msg_pending_state',
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: 'Pending state verified.',
                annotations: [],
              },
            ],
          },
        ],
        parallel_tool_calls: false,
        temperature: 1,
        tool_choice: 'auto',
        tools: [],
        top_p: 1,
        max_output_tokens: null,
        previous_response_id: null,
        reasoning: null,
        status: 'completed',
        usage: {
          input_tokens: 8,
          output_tokens: 4,
          total_tokens: 12,
        },
      }),
    });
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Pending state verified.', {
      timeout: 10_000,
    });
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('sends a chat request with ctrl+enter from the composer', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    await context.route('**/v1/responses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'resp_shortcut_test',
          object: 'response',
          created_at: 1735689600,
          model: 'gpt-4.1-mini',
          output_text: 'Shortcut reply.',
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: {},
          output: [
            {
              id: 'msg_shortcut',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Shortcut reply.',
                  annotations: [],
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          temperature: 1,
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          max_output_tokens: null,
          previous_response_id: null,
          reasoning: null,
          status: 'completed',
          usage: {
            input_tokens: 8,
            output_tokens: 3,
            total_tokens: 11,
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
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    const composer = sidepanelPage.locator('textarea').last();
    await composer.fill('Shortcut send');
    await composer.press('Enter');
    await expect(composer).toHaveValue('Shortcut send\n');

    await expect(sidepanelPage.locator('.message.user')).toHaveCount(0);

    await composer.press('Control+Enter');

    await expect(sidepanelPage.locator('.message.user')).toContainText('Shortcut send');
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Shortcut reply.', {
      timeout: 10_000,
    });
    await expect(sidepanelPage.locator('.message.assistant')).not.toContainText('Web search used');
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('sends a chat request with cmd+enter from the composer', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    await context.route('**/v1/responses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'resp_shortcut_meta_test',
          object: 'response',
          created_at: 1735689600,
          model: 'gpt-4.1-mini',
          output_text: 'Shortcut reply.',
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: {},
          output: [
            {
              id: 'msg_shortcut_meta',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Shortcut reply.',
                  annotations: [],
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          temperature: 1,
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          max_output_tokens: null,
          previous_response_id: null,
          reasoning: null,
          status: 'completed',
          usage: {
            input_tokens: 8,
            output_tokens: 3,
            total_tokens: 11,
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
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    const composer = sidepanelPage.locator('textarea').last();
    await composer.fill('Shortcut send');
    await composer.press('Meta+Enter');

    await expect(sidepanelPage.locator('.message.user')).toContainText('Shortcut send');
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Shortcut reply.', {
      timeout: 10_000,
    });
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('sends a chat request with enter when the input behavior is set to enter_to_send', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    await context.route('**/v1/responses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'resp_shortcut_enter_test',
          object: 'response',
          created_at: 1735689600,
          model: 'gpt-4.1-mini',
          output_text: 'Enter shortcut reply.',
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: {},
          output: [
            {
              id: 'msg_shortcut_enter',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Enter shortcut reply.',
                  annotations: [],
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          temperature: 1,
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          max_output_tokens: null,
          previous_response_id: null,
          reasoning: null,
          status: 'completed',
          usage: {
            input_tokens: 8,
            output_tokens: 3,
            total_tokens: 11,
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
      composerSubmitBehavior: 'enter_to_send',
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    const composer = sidepanelPage.locator('textarea').last();
    await composer.fill('Enter send');
    await composer.press('Shift+Enter');
    await expect(composer).toHaveValue('Enter send\n');

    await composer.press('Enter');

    await expect(sidepanelPage.locator('.message.user')).toContainText('Enter send');
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Enter shortcut reply.', {
      timeout: 10_000,
    });
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('runs browser automation mode from the composer mode button', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();
  let responseCount = 0;
  const requestBodies: string[] = [];

  try {
    await context.route('**/v1/responses', async (route) => {
      requestBodies.push(route.request().postData() ?? '');
      responseCount += 1;

      if (responseCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'resp_auto_1',
            object: 'response',
            created_at: 1735689600,
            model: 'gpt-4.1-mini',
            output_text: '',
            error: null,
            incomplete_details: null,
            instructions: null,
            metadata: {},
            output: [
              {
                id: 'fc_auto_1',
                type: 'function_call',
                call_id: 'call_auto_1',
                name: 'browser_inspect_page',
                arguments: '{"maxElements":10}',
                status: 'completed',
              },
            ],
            parallel_tool_calls: false,
            temperature: 1,
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            max_output_tokens: null,
            previous_response_id: null,
            reasoning: null,
            status: 'completed',
            usage: {
              input_tokens: 15,
              output_tokens: 4,
              total_tokens: 19,
            },
          }),
        });
        return;
      }

      if (responseCount === 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'resp_auto_2',
            object: 'response',
            created_at: 1735689601,
            model: 'gpt-4.1-mini',
            output_text: '',
            error: null,
            incomplete_details: null,
            instructions: null,
            metadata: {},
            output: [
              {
                id: 'fc_auto_2',
                type: 'function_call',
                call_id: 'call_auto_2',
                name: 'browser_set_value',
                arguments: '{"selector":"[data-sidepanel-automation-id=\\"sp-auto-0\\"]","text":"penguin","clear":true}',
                status: 'completed',
              },
              {
                id: 'fc_auto_3',
                type: 'function_call',
                call_id: 'call_auto_3',
                name: 'browser_get_value',
                arguments: '{"selector":"[data-sidepanel-automation-id=\\"sp-auto-0\\"]"}',
                status: 'completed',
              },
              {
                id: 'fc_auto_4',
                type: 'function_call',
                call_id: 'call_auto_4',
                name: 'browser_click',
                arguments: '{"selector":"[data-sidepanel-automation-id=\\"sp-auto-1\\"]"}',
                status: 'completed',
              },
            ],
            parallel_tool_calls: false,
            temperature: 1,
            tool_choice: 'auto',
            tools: [],
            top_p: 1,
            max_output_tokens: null,
            previous_response_id: 'resp_auto_1',
            reasoning: null,
            status: 'completed',
            usage: {
              input_tokens: 17,
              output_tokens: 6,
              total_tokens: 23,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'resp_auto_3',
          object: 'response',
          created_at: 1735689602,
          model: 'gpt-4.1-mini',
          output_text: 'Completed the browser task.',
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: {},
          output: [
            {
              id: 'msg_auto_final',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Completed the browser task.',
                  annotations: [],
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          temperature: 1,
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          max_output_tokens: null,
          previous_response_id: 'resp_auto_2',
          reasoning: null,
          status: 'completed',
          usage: {
            input_tokens: 9,
            output_tokens: 3,
            total_tokens: 12,
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
      responseTool: 'none',
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    await sidepanelPage.getByRole('button', { name: 'Automatic browser actions' }).click();
    await sidepanelPage.getByPlaceholder('Describe what to do on this page...').fill('Type penguin into the search box and run it.');
    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Send');

    const logMessages = sidepanelPage.locator('.message.log');
    await expect(sidepanelPage.locator('.message.user')).toContainText('Type penguin into the search box and run it.');
    await expect(logMessages.filter({ hasText: 'Tool call' }).first()).toBeVisible();
    await expect(logMessages.filter({ hasText: 'browser_inspect_page' }).first()).toBeVisible();
    await expect(logMessages.filter({ hasText: 'browser_set_value' }).first()).toBeVisible();
    await expect(logMessages.filter({ hasText: 'browser_get_value' }).first()).toBeVisible();
    await expect(logMessages.filter({ hasText: 'browser_click' }).first()).toBeVisible();
    await expect(logMessages.filter({ hasText: 'Tool result' }).first()).toBeVisible();
    await expect(sidepanelPage.locator('.message.assistant')).toContainText('Completed the browser task.', {
      timeout: 10_000,
    });
    await expect(sidepanelPage.locator('.message.user')).toContainText('Page structure: Fixture Article');
    await expect(fixturePage.locator('#fixture-search-input')).toHaveValue('penguin');
    await expect(fixturePage.locator('#search-result')).toContainText('Search submitted: penguin');
    expect(responseCount).toBe(3);
    expect(requestBodies[0]).toContain('Attachment type: Page structure');
    expect(requestBodies[0]).toContain('"name":"browser_get_value"');
    expect(requestBodies[0]).toContain('"name":"browser_set_value"');
    expect(requestBodies[0]).not.toContain('"type":"computer"');
    expect(requestBodies[0]).not.toContain('"type":"web_search_preview"');
    expect(requestBodies[2]).toContain('\\"value\\":\\"penguin\\"');
    expect(requestBodies[2]).toContain('\\"pageChange\\":{');
  } finally {
    await closeExtension(context, userDataDir);
  }
});

test('keeps the user message visible when the provider returns an error', async () => {
  const { context, extensionId, userDataDir } = await launchExtension();

  try {
    await context.route('**/v1/responses', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Mocked provider failure.',
            type: 'server_error',
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
      responseTool: 'none',
    });

    const sidepanelPage = await openExtensionPage(context, extensionId, 'sidepanel.html');
    await waitForSidepanelReady(sidepanelPage);

    await sidepanelPage.getByPlaceholder('Type a message...').fill('This should remain visible');
    await fixturePage.bringToFront();
    await clickButtonInBackground(sidepanelPage, 'Send');

    await expect(sidepanelPage.locator('.message.user')).toContainText('This should remain visible');
    await expect(sidepanelPage.locator('.message.log')).toContainText('Mocked provider failure.');
    await expect(sidepanelPage.locator('.message.log')).toContainText('chat.send');
    await expect(sidepanelPage.locator('div.text-rose-600')).toContainText('Mocked provider failure.');
  } finally {
    await closeExtension(context, userDataDir);
  }
});
