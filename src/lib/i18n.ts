import type { ContextAttachment, Settings } from '../shared/models';
import { attachmentSourceSummary } from './attachments';

export type SupportedLocale = 'en' | 'ja';
export type LocalePreference = Settings['locale'];

type TranslationDictionary = {
  common: {
    appName: string;
    settings: string;
    delete: string;
    close: string;
    zoomIn: string;
    zoomOut: string;
    reset: string;
    save: string;
    ready: string;
    waiting: string;
  };
  sidepanel: {
    sessionsLabel: string;
    workspaceLabel: string;
    newChat: string;
    setupRequiredTitle: string;
    setupRequiredBody: string;
    openSettings: string;
    deleteConfirm: string;
    emptySessions: string;
    emptyMessages: string;
    modelLabel: string;
    modelNotConfigured: string;
    contextLabel: string;
    contextHint: string;
    composerPlaceholder: string;
    composerPlaceholderAuto: string;
    composerPlaceholderAutomation: string;
    send: string;
    attachmentPreviewAlt: string;
    userRole: string;
    assistantRole: string;
    defaultSessionTitle: string;
    captureSelection: string;
    capturePage: string;
    captureScreenshot: string;
    autoAttachPage: string;
    autoAttachPageShort: string;
    logGroupTitle: string;
    currentMode: string;
    chatModeShort: string;
    automationMode: string;
    automationModeShort: string;
    attachedItems: string;
    attachmentOpen: string;
    activeModel: string;
    reasoningEffort: string;
    copyThreadData: string;
    copyThreadDataDone: string;
    copyThreadDataFailed: string;
    messageCount: string;
    attachmentsCount: string;
    webSearchUsed: string;
    webSearchNotUsed: string;
  };
  options: {
    title: string;
    description: string;
    storageNote: string;
    devNote: string;
    autoSaveHint: string;
    sectionNavigation: string;
    sectionCommon: string;
    sectionCommonDescription: string;
    sectionChat: string;
    sectionChatDescription: string;
    sectionAutomation: string;
    sectionAutomationDescription: string;
    apiKey: string;
    model: string;
    modelHelp: string;
    modelCompatibilityNote: string;
    tool: string;
    toolHelp: string;
    toolNone: string;
    toolWebSearch: string;
    toolChatHelp: string;
    toolAutomationHelp: string;
    toolBuiltIn: string;
    toolFunctionGroup: string;
    toolFunctionGroupHelp: string;
    toolManagedByMode: string;
    reasoning: string;
    reasoningHelp: string;
    reasoningDefault: string;
    reasoningNone: string;
    reasoningMinimal: string;
    reasoningLow: string;
    reasoningMedium: string;
    reasoningHigh: string;
    reasoningXHigh: string;
    refreshModels: string;
    refreshingModels: string;
    modelInputMethod: string;
    modelInputList: string;
    modelInputManual: string;
    modelManualEntry: string;
    modelListUnavailable: string;
    systemPrompt: string;
    automationSystemPrompt: string;
    promptContext: string;
    includeCurrentDateTime: string;
    includeResponseLanguageInstruction: string;
    preferLatexMathOutput: string;
    language: string;
    autoAttachPage: string;
    autoAttachPageStructureOnAutomation: string;
    automationMaxSteps: string;
    automationMaxStepsHelp: string;
    languageAuto: string;
    languageEn: string;
    languageJa: string;
    testConnection: string;
    testingConnection: string;
    saved: string;
    savedAutomatically: string;
    connectionOk: string;
    manualSaveHint: string;
    unsavedChanges: string;
    saveApiKey: string;
    saveModel: string;
    saveSystemPrompt: string;
    saveAutomationSystemPrompt: string;
    saveAutomationMaxSteps: string;
  };
  attachments: {
    selection: string;
    page: string;
    screenshot: string;
    pageStructure: string;
    currentPage: string;
  };
  errors: {
    sendFailed: string;
  };
};

const translations: Record<SupportedLocale, TranslationDictionary> = {
  en: {
    common: {
      appName: 'Sidepanel LLM',
      settings: 'Settings',
      delete: 'Delete',
      close: 'Close',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      reset: 'Reset',
      save: 'Save',
      ready: 'Ready',
      waiting: 'Waiting for response...',
    },
    sidepanel: {
      sessionsLabel: 'Sessions',
      workspaceLabel: 'Workspace',
      newChat: 'New chat',
      setupRequiredTitle: 'Set up your API key',
      setupRequiredBody: 'Open Settings and save an OpenAI API key before using the side panel.',
      openSettings: 'Open Settings',
      deleteConfirm: 'Delete this session and all saved messages?',
      emptySessions: 'No sessions yet.',
      emptyMessages: 'Start a chat, then attach page context if needed.',
      modelLabel: 'Model',
      modelNotConfigured: 'Not configured',
      contextLabel: 'Context tools',
      contextHint: 'Bring the current page into the conversation before sending.',
      composerPlaceholder: 'Type a message...',
      composerPlaceholderAuto: 'Ask about the current page...',
      composerPlaceholderAutomation: 'Describe what to do on this page...',
      send: 'Send',
      attachmentPreviewAlt: 'Attached screenshot preview',
      userRole: 'You',
      assistantRole: 'Assistant',
      defaultSessionTitle: 'New chat',
      captureSelection: 'Capture selection',
      capturePage: 'Capture page',
      captureScreenshot: 'Capture screenshot',
      autoAttachPage: 'Auto attach full page on first message',
      autoAttachPageShort: 'Auto',
      logGroupTitle: 'Logs',
      currentMode: 'Mode',
      chatModeShort: 'Chat',
      automationMode: 'Automatic browser actions',
      automationModeShort: 'Automatic',
      attachedItems: 'Attached items',
      attachmentOpen: 'Open attachment',
      activeModel: 'Active model',
      reasoningEffort: 'Reasoning effort',
      copyThreadData: 'Copy thread data',
      copyThreadDataDone: 'Thread data copied.',
      copyThreadDataFailed: 'Unable to copy thread data.',
      messageCount: 'Messages',
      attachmentsCount: 'Attachments',
      webSearchUsed: 'Web search used',
      webSearchNotUsed: 'No web search used',
    },
    options: {
      title: 'Settings',
      description: 'Configure the OpenAI API used by the side panel.',
      storageNote:
        'Production builds require the user to enter an API key. Saved settings are stored in chrome.storage.local on this browser profile only.',
      devNote:
        'Development mode detected: the API key field was prefilled from .env. Saving will persist the current value to local extension storage.',
      autoSaveHint: 'Selects and toggles save immediately. Text fields keep a nearby Save button so unfinished edits are not committed too early.',
      sectionNavigation: 'Settings sections',
      sectionCommon: 'Common settings',
      sectionCommonDescription: 'Language, API key, model, and connection checks.',
      sectionChat: 'Chat mode',
      sectionChatDescription: 'Responses API behavior and prompt defaults for normal chat.',
      sectionAutomation: 'Automation mode',
      sectionAutomationDescription: 'Prompt, auto-attach behavior, and action step limits.',
      apiKey: 'API key',
      model: 'Model',
      modelHelp: 'Load the latest model list from the API, or enter a model ID manually if needed.',
      modelCompatibilityNote: 'The API may return models that do not support the Responses API or the selected tool. Choose a compatible model if requests fail.',
      tool: 'Tool',
      toolHelp: 'Choose the built-in Responses API tool to allow during generation.',
      toolNone: 'None',
      toolWebSearch: 'Web search',
      toolChatHelp: 'Chat mode can use the built-in web search tool when enabled.',
      toolAutomationHelp: 'Automation mode always has internal function tools available. Web search can be enabled in addition.',
      toolBuiltIn: 'Built-in tool',
      toolFunctionGroup: 'Internal function tools',
      toolFunctionGroupHelp: 'This represents the extension-owned browser action tools used by automation mode.',
      toolManagedByMode: 'Always enabled in automation mode.',
      reasoning: 'Reasoning',
      reasoningHelp: 'Set Responses API reasoning effort. Leave as default unless the model supports and needs a specific level.',
      reasoningDefault: 'Model default',
      reasoningNone: 'None',
      reasoningMinimal: 'Minimal',
      reasoningLow: 'Low',
      reasoningMedium: 'Medium',
      reasoningHigh: 'High',
      reasoningXHigh: 'X-High',
      refreshModels: 'Refresh models',
      refreshingModels: 'Refreshing models...',
      modelInputMethod: 'Model input method',
      modelInputList: 'Choose from list',
      modelInputManual: 'Enter manually',
      modelManualEntry: 'Manual model ID entry',
      modelListUnavailable: 'Model list could not be loaded. Enter the model ID manually.',
      systemPrompt: 'System prompt',
      automationSystemPrompt: 'Automation mode prompt',
      promptContext: 'Prompt context',
      includeCurrentDateTime: 'Include current date and time',
      includeResponseLanguageInstruction: 'Include response language instruction',
      preferLatexMathOutput: 'Ask the model to format math with LaTeX $ delimiters',
      language: 'Language',
      autoAttachPage: 'Auto attach full page on first message',
      autoAttachPageStructureOnAutomation: 'Auto attach page structure on first automation message',
      automationMaxSteps: 'Automation step limit',
      automationMaxStepsHelp: 'Maximum number of tool loop steps allowed in automation mode before stopping.',
      languageAuto: 'Auto',
      languageEn: 'English',
      languageJa: 'Japanese',
      testConnection: 'Test OpenAI API connection',
      testingConnection: 'Testing OpenAI API...',
      saved: 'Saved.',
      savedAutomatically: 'Saved automatically.',
      connectionOk: 'Connection ok:',
      manualSaveHint: 'Text changes are saved only when you press Save.',
      unsavedChanges: 'Unsaved changes.',
      saveApiKey: 'Save API key',
      saveModel: 'Save model',
      saveSystemPrompt: 'Save system prompt',
      saveAutomationSystemPrompt: 'Save automation prompt',
      saveAutomationMaxSteps: 'Save automation step limit',
    },
    attachments: {
      selection: 'Selection',
      page: 'Page',
      screenshot: 'Screenshot',
      pageStructure: 'Page structure',
      currentPage: 'Current page',
    },
    errors: {
      sendFailed: 'Unable to send message.',
    },
  },
  ja: {
    common: {
      appName: 'Sidepanel LLM',
      settings: '設定',
      delete: '削除',
      close: '閉じる',
      zoomIn: '拡大',
      zoomOut: '縮小',
      reset: 'リセット',
      save: '保存',
      ready: '準備完了',
      waiting: '応答を待機中...',
    },
    sidepanel: {
      sessionsLabel: 'セッション',
      workspaceLabel: 'ワークスペース',
      newChat: '新しいチャット',
      setupRequiredTitle: 'API キーを設定してください',
      setupRequiredBody: 'サイドパネルを使う前に、設定を開いて OpenAI API キーを保存してください。',
      openSettings: '設定を開く',
      deleteConfirm: 'このセッションと保存済みメッセージをすべて削除しますか？',
      emptySessions: 'まだセッションはありません。',
      emptyMessages: 'チャットを開始し、必要ならページ情報を添付してください。',
      modelLabel: 'モデル',
      modelNotConfigured: '未設定',
      contextLabel: 'コンテキスト取得',
      contextHint: '送信前に現在のページ情報を会話に取り込みます。',
      composerPlaceholder: 'メッセージを入力...',
      composerPlaceholderAuto: '現在のページについて質問してください...',
      composerPlaceholderAutomation: 'このページでやってほしい操作を入力...',
      send: '送信',
      attachmentPreviewAlt: '添付したスクリーンショットのプレビュー',
      userRole: 'あなた',
      assistantRole: 'アシスタント',
      defaultSessionTitle: '新しいチャット',
      captureSelection: '選択範囲を取得',
      capturePage: 'ページ全文を取得',
      captureScreenshot: 'スクリーンショットを取得',
      autoAttachPage: '最初の送信時にページ全文を自動添付',
      autoAttachPageShort: 'Auto',
      logGroupTitle: 'ログ',
      currentMode: '現在のモード',
      chatModeShort: 'チャット',
      automationMode: '自動操作モード',
      automationModeShort: '自動操作',
      attachedItems: '添付中の項目',
      attachmentOpen: '添付を開く',
      activeModel: '使用モデル',
      reasoningEffort: 'Reasoning effort',
      copyThreadData: 'スレッドデータをコピー',
      copyThreadDataDone: 'スレッドデータをコピーしました。',
      copyThreadDataFailed: 'スレッドデータをコピーできませんでした。',
      messageCount: 'メッセージ',
      attachmentsCount: '添付',
      webSearchUsed: 'Web 検索あり',
      webSearchNotUsed: 'Web 検索なし',
    },
    options: {
      title: '設定',
      description: 'サイドパネルで利用する OpenAI API を設定します。',
      storageNote:
        '本番ビルドでは API キーの入力が必要です。保存した設定はこのブラウザープロファイルの chrome.storage.local にのみ保存されます。',
      devNote:
        '開発モードを検出しました。API キー欄には .env の値が初期入力されています。保存すると現在の値が拡張機能のローカルストレージに保持されます。',
      autoSaveHint: '選択項目とトグルは変更時に自動保存します。テキスト入力だけは途中入力を守るため近くの保存ボタンで確定します。',
      sectionNavigation: '設定セクション',
      sectionCommon: '共通設定',
      sectionCommonDescription: '表示言語、API キー、モデル、接続確認をまとめます。',
      sectionChat: 'チャットモード',
      sectionChatDescription: '通常チャット時の Responses API 挙動とプロンプトを設定します。',
      sectionAutomation: '自動操作モード',
      sectionAutomationDescription: '自動操作時のプロンプト、添付ルール、ステップ制限を設定します。',
      apiKey: 'API キー',
      model: 'モデル',
      modelHelp: 'API から最新のモデル一覧を取得します。必要なら手入力にも切り替えられます。',
      modelCompatibilityNote: 'API の一覧には Responses API や選択した tool に未対応のモデルが含まれる場合があります。送信に失敗する場合は対応モデルを選んでください。',
      tool: 'Tool',
      toolHelp: 'Responses API で利用を許可する組み込み tool を選びます。',
      toolNone: 'なし',
      toolWebSearch: 'Web 検索',
      toolChatHelp: 'チャットモードでは、ON にすると組み込みの Web 検索 tool を使えます。',
      toolAutomationHelp: '自動操作モードでは、内製 function tools は常時有効です。追加で Web 検索だけ ON/OFF できます。',
      toolBuiltIn: '組み込み tool',
      toolFunctionGroup: '内製 function tools',
      toolFunctionGroupHelp: '拡張機能側が持つブラウザ操作用ツール群を、説明上は 1 つのまとまりとして表示します。',
      toolManagedByMode: '自動操作モードでは常に有効です。',
      reasoning: 'Reasoning',
      reasoningHelp: 'Responses API の reasoning effort を設定します。特定レベルが必要なモデル以外は既定値のままにしてください。',
      reasoningDefault: 'Model default',
      reasoningNone: 'None',
      reasoningMinimal: 'Minimal',
      reasoningLow: 'Low',
      reasoningMedium: 'Medium',
      reasoningHigh: 'High',
      reasoningXHigh: 'X-High',
      refreshModels: 'モデル一覧を更新',
      refreshingModels: 'モデル一覧を更新中...',
      modelInputMethod: 'モデルの入力方法',
      modelInputList: 'リストから選択',
      modelInputManual: '手入力',
      modelManualEntry: 'モデル ID を手入力',
      modelListUnavailable: 'モデル一覧を取得できませんでした。モデル ID を手入力してください。',
      systemPrompt: 'システムプロンプト',
      automationSystemPrompt: '自動操作モード用プロンプト',
      promptContext: '埋め込みコンテキスト',
      includeCurrentDateTime: '現在日時を含める',
      includeResponseLanguageInstruction: '返答言語の指示を含める',
      preferLatexMathOutput: '数式は LaTeX の $ 区切りで出力するよう促す',
      language: '表示言語',
      autoAttachPage: '最初の送信時にページ全文を自動添付',
      autoAttachPageStructureOnAutomation: '自動操作モードの初回送信時にページ構造を自動添付',
      automationMaxSteps: '自動操作のステップ上限',
      automationMaxStepsHelp: '自動操作モードで停止するまでに許可するツールループ回数の上限です。',
      languageAuto: '自動',
      languageEn: '英語',
      languageJa: '日本語',
      testConnection: 'OpenAI API 接続テスト',
      testingConnection: 'OpenAI API 接続確認中...',
      saved: '保存しました。',
      savedAutomatically: '自動保存しました。',
      connectionOk: '接続成功:',
      manualSaveHint: 'テキスト入力は保存ボタンを押したときだけ反映します。',
      unsavedChanges: '未保存の変更があります。',
      saveApiKey: 'API キーを保存',
      saveModel: 'モデルを保存',
      saveSystemPrompt: 'システムプロンプトを保存',
      saveAutomationSystemPrompt: '自動操作モード用プロンプトを保存',
      saveAutomationMaxSteps: '自動操作のステップ上限を保存',
    },
    attachments: {
      selection: '選択範囲',
      page: 'ページ',
      screenshot: 'スクリーンショット',
      pageStructure: 'ページ構造',
      currentPage: '現在のページ',
    },
    errors: {
      sendFailed: 'メッセージを送信できませんでした。',
    },
  },
};

export function resolveLocale(settings: Pick<Settings, 'locale'> | null | undefined): SupportedLocale {
  const preference = settings?.locale ?? 'auto';
  if (preference === 'en' || preference === 'ja') {
    return preference;
  }

  const browserLocale =
    chrome.i18n?.getUILanguage?.() ??
    navigator.language ??
    'en';

  return browserLocale.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function getTranslations(settings: Pick<Settings, 'locale'> | null | undefined): TranslationDictionary {
  return translations[resolveLocale(settings)];
}

export function formatTimestamp(value: string, settings: Pick<Settings, 'locale'> | null | undefined): string {
  return new Intl.DateTimeFormat(resolveLocale(settings), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function attachmentLabel(
  attachment: ContextAttachment,
  settings: Pick<Settings, 'locale'> | null | undefined,
): string {
  const t = getTranslations(settings);

  switch (attachment.kind) {
    case 'selectionText':
      return `${t.attachments.selection}: ${attachment.text.slice(0, 48)}`;
    case 'pageText':
      return `${t.attachments.page}: ${attachmentSourceSummary(attachment.source) || t.attachments.currentPage}`;
    case 'pageStructure':
      return `${t.attachments.pageStructure}: ${attachmentSourceSummary(attachment.source) || t.attachments.currentPage}`;
    case 'screenshot':
      return `${t.attachments.screenshot}: ${attachmentSourceSummary(attachment.source) || t.attachments.currentPage}`;
  }
}

const defaultSessionTitles = new Set([
  translations.en.sidepanel.defaultSessionTitle,
  translations.ja.sidepanel.defaultSessionTitle,
]);

export function isDefaultSessionTitle(title: string): boolean {
  return defaultSessionTitles.has(title);
}
