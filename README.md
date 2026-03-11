# Sidepanel LLM

Chrome のサイドパネルで使う、OpenAI 互換 API 対応のチャット拡張です。  
現在のページの選択テキスト、ページ本文、スクリーンショットを添付して質問できます。

## 主な機能

- サイドパネル上のチャット UI
- Options 画面での API Key / Model / System Prompt / Base URL 設定
- OpenAI 互換 Chat Completions API への送信
- セッション一覧とメッセージ履歴の保存
- ページ上の選択テキスト取得
- ページ本文の取得
- 表示中タブのスクリーンショット取得

## 技術スタック

- React
- TypeScript
- Vite
- `@crxjs/vite-plugin`
- Chrome Extension Manifest V3

## セットアップ

```bash
pnpm install
pnpm build
```

ビルド後、Chrome の拡張機能ページで `dist` を「パッケージ化されていない拡張機能」として読み込んでください。

## 使い方

1. 拡張機能を読み込む
2. 拡張機能アイコンを押してサイドパネルを開く
3. `Settings` から API 情報を設定する
4. 必要なら `Capture selection` / `Capture page` / `Capture screenshot` で文脈を添付する
5. メッセージを送信する

## 開発コマンド

```bash
pnpm dev
pnpm build
pnpm typecheck
```

## API Key の扱い

- 開発時のみ、`.env` か `.env.local` に `VITE_DEV_OPENAI_API_KEY` を置くと設定画面の初期値として読み込まれます
- 本番ビルドでは環境変数の API key は使わず、ユーザーに入力してもらう前提です
- 保存された設定は `chrome.storage.local` に保存され、そのブラウザープロファイルのローカルにのみ残ります
- 配布用ビルドに秘密鍵を埋め込む運用は避けてください

`.env.local` の例:

```bash
cp .env.example .env.local
```

## ディレクトリ構成

```text
src/
  background/   # service worker, Chrome API, provider 呼び出し
  content/      # ページ情報の取得
  sidepanel/    # メインチャット UI
  options/      # 設定画面
  shared/       # 型とメッセージ契約
  lib/          # storage / provider
```

## 補足

- 設定や会話履歴は `chrome.storage.local` に保存されます
- 接続先は OpenAI API に固定されています
