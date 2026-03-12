import type { ContextAttachment, Settings } from '../shared/models';

export type SupportedLocale = 'en' | 'ja';
export type LocalePreference = Settings['locale'];

type TranslationDictionary = {
  common: {
    appName: string;
    settings: string;
    delete: string;
    save: string;
    ready: string;
    waiting: string;
  };
  sidepanel: {
    sessionsLabel: string;
    workspaceLabel: string;
    newChat: string;
    deleteConfirm: string;
    emptySessions: string;
    emptyMessages: string;
    modelLabel: string;
    modelNotConfigured: string;
    contextLabel: string;
    contextHint: string;
    composerPlaceholder: string;
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
    attachedItems: string;
    activeModel: string;
    messageCount: string;
    attachmentsCount: string;
  };
  options: {
    title: string;
    description: string;
    storageNote: string;
    devNote: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    language: string;
    languageAuto: string;
    languageEn: string;
    languageJa: string;
    testConnection: string;
    testingConnection: string;
    saved: string;
    connectionOk: string;
  };
  attachments: {
    selection: string;
    page: string;
    screenshot: string;
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
      save: 'Save',
      ready: 'Ready',
      waiting: 'Waiting for response...',
    },
    sidepanel: {
      sessionsLabel: 'Sessions',
      workspaceLabel: 'Workspace',
      newChat: 'New chat',
      deleteConfirm: 'Delete this session and all saved messages?',
      emptySessions: 'No sessions yet.',
      emptyMessages: 'Start a chat, then attach page context if needed.',
      modelLabel: 'Model',
      modelNotConfigured: 'Not configured',
      contextLabel: 'Context tools',
      contextHint: 'Bring the current page into the conversation before sending.',
      composerPlaceholder: 'Ask about the current page...',
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
      attachedItems: 'Attached items',
      activeModel: 'Active model',
      messageCount: 'Messages',
      attachmentsCount: 'Attachments',
    },
    options: {
      title: 'Settings',
      description: 'Configure the OpenAI API used by the side panel.',
      storageNote:
        'Production builds require the user to enter an API key. Saved settings are stored in chrome.storage.local on this browser profile only.',
      devNote:
        'Development mode detected: the API key field was prefilled from .env. Saving will persist the current value to local extension storage.',
      apiKey: 'API key',
      model: 'Model',
      systemPrompt: 'System prompt',
      language: 'Language',
      languageAuto: 'Auto',
      languageEn: 'English',
      languageJa: 'Japanese',
      testConnection: 'Test connection',
      testingConnection: 'Testing...',
      saved: 'Saved.',
      connectionOk: 'Connection ok:',
    },
    attachments: {
      selection: 'Selection',
      page: 'Page',
      screenshot: 'Screenshot',
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
      save: '保存',
      ready: '準備完了',
      waiting: '応答を待機中...',
    },
    sidepanel: {
      sessionsLabel: 'セッション',
      workspaceLabel: 'ワークスペース',
      newChat: '新しいチャット',
      deleteConfirm: 'このセッションと保存済みメッセージをすべて削除しますか？',
      emptySessions: 'まだセッションはありません。',
      emptyMessages: 'チャットを開始し、必要ならページ情報を添付してください。',
      modelLabel: 'モデル',
      modelNotConfigured: '未設定',
      contextLabel: 'コンテキスト取得',
      contextHint: '送信前に現在のページ情報を会話に取り込みます。',
      composerPlaceholder: '現在のページについて質問してください...',
      send: '送信',
      attachmentPreviewAlt: '添付したスクリーンショットのプレビュー',
      userRole: 'あなた',
      assistantRole: 'アシスタント',
      defaultSessionTitle: '新しいチャット',
      captureSelection: '選択範囲を取得',
      capturePage: 'ページ全文を取得',
      captureScreenshot: 'スクリーンショットを取得',
      autoAttachPage: '最初の送信時にページ全文を自動添付',
      autoAttachPageShort: 'auto',
      attachedItems: '添付中の項目',
      activeModel: '使用モデル',
      messageCount: 'メッセージ',
      attachmentsCount: '添付',
    },
    options: {
      title: '設定',
      description: 'サイドパネルで利用する OpenAI API を設定します。',
      storageNote:
        '本番ビルドでは API キーの入力が必要です。保存した設定はこのブラウザープロファイルの chrome.storage.local にのみ保存されます。',
      devNote:
        '開発モードを検出しました。API キー欄には .env の値が初期入力されています。保存すると現在の値が拡張機能のローカルストレージに保持されます。',
      apiKey: 'API キー',
      model: 'モデル',
      systemPrompt: 'システムプロンプト',
      language: '表示言語',
      languageAuto: '自動',
      languageEn: '英語',
      languageJa: '日本語',
      testConnection: '接続テスト',
      testingConnection: '接続確認中...',
      saved: '保存しました。',
      connectionOk: '接続成功:',
    },
    attachments: {
      selection: '選択範囲',
      page: 'ページ',
      screenshot: 'スクリーンショット',
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
      return `${t.attachments.page}: ${attachment.source.title ?? attachment.source.url ?? t.attachments.currentPage}`;
    case 'screenshot':
      return `${t.attachments.screenshot}: ${attachment.source.title ?? attachment.source.url ?? t.attachments.currentPage}`;
  }
}

const defaultSessionTitles = new Set([
  translations.en.sidepanel.defaultSessionTitle,
  translations.ja.sidepanel.defaultSessionTitle,
]);

export function isDefaultSessionTitle(title: string): boolean {
  return defaultSessionTitles.has(title);
}
