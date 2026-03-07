# Messages

## Purpose

This document defines the internal message contract between extension runtimes.

Every cross-runtime interaction should be based on explicit request and response types. No message payload should be created ad hoc in UI code.

## Runtime Map

Messages move between these runtimes:

- side panel
- options page
- background service worker
- content script

The background service worker is the coordinator for privileged actions.

## Design Rules

- every request has a discriminating `type`
- every response is serializable
- every async operation returns either `ok: true` or `ok: false`
- validation happens at the boundary
- provider-specific payloads never cross into UI-facing message contracts

## Shared Shapes

### Success Response

```ts
type SuccessResponse<T> = {
  ok: true;
  data: T;
};
```

### Error Response

```ts
type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
  };
};
```

### Async Response

```ts
type AsyncResponse<T> = SuccessResponse<T> | ErrorResponse;
```

## Side Panel -> Background

### `chat.send`

Sends a user message and optional attached context to the AI provider.

```ts
type ChatSendRequest = {
  type: 'chat.send';
  payload: {
    sessionId: string;
    message: string;
    attachments: ContextAttachment[];
    modelId?: string;
  };
};
```

```ts
type ChatSendResponse = AsyncResponse<{
  assistantMessage: ChatMessage;
  usage?: TokenUsage;
}>;
```

### `session.create`

Creates a new chat session.

```ts
type SessionCreateRequest = {
  type: 'session.create';
  payload: {
    title?: string;
  };
};
```

### `session.list`

Returns known chat sessions.

```ts
type SessionListRequest = {
  type: 'session.list';
};
```

### `session.get`

Returns a session and its messages.

```ts
type SessionGetRequest = {
  type: 'session.get';
  payload: {
    sessionId: string;
  };
};
```

### `session.delete`

Deletes a session and its messages.

```ts
type SessionDeleteRequest = {
  type: 'session.delete';
  payload: {
    sessionId: string;
  };
};
```

### `context.captureSelection`

Requests selected text from the active tab.

```ts
type ContextCaptureSelectionRequest = {
  type: 'context.captureSelection';
};
```

### `context.capturePage`

Requests normalized visible page text from the active tab.

```ts
type ContextCapturePageRequest = {
  type: 'context.capturePage';
};
```

### `context.captureScreenshot`

Requests a screenshot attachment for the active tab.

```ts
type ContextCaptureScreenshotRequest = {
  type: 'context.captureScreenshot';
};
```

## Background -> Content

### `content.getSelection`

```ts
type ContentGetSelectionRequest = {
  type: 'content.getSelection';
};
```

### `content.getPageText`

```ts
type ContentGetPageTextRequest = {
  type: 'content.getPageText';
};
```

### `content.getMetadata`

```ts
type ContentGetMetadataRequest = {
  type: 'content.getMetadata';
};
```

## Options -> Background

Options should prefer shared storage adapters directly for simple local settings.

If background coordination is required, use explicit messages rather than hidden side effects.

### `settings.testConnection`

Tests whether the saved API key can reach the provider.

```ts
type SettingsTestConnectionRequest = {
  type: 'settings.testConnection';
  payload: {
    apiKey: string;
    modelId?: string;
  };
};
```

## Domain Types

### `ContextAttachment`

```ts
type ContextAttachment =
  | {
      kind: 'selectionText';
      text: string;
      source: TabSource;
    }
  | {
      kind: 'pageText';
      text: string;
      source: TabSource;
    }
  | {
      kind: 'screenshot';
      imageDataUrl: string;
      source: TabSource;
    };
```

### `TabSource`

```ts
type TabSource = {
  tabId?: number;
  url?: string;
  title?: string;
};
```

### `ChatMessage`

```ts
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
  attachments?: ContextAttachment[];
};
```

### `TokenUsage`

```ts
type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
```

## Unions

The implementation should maintain explicit request unions.

```ts
type BackgroundRequest =
  | ChatSendRequest
  | SessionCreateRequest
  | SessionListRequest
  | SessionGetRequest
  | SessionDeleteRequest
  | ContextCaptureSelectionRequest
  | ContextCapturePageRequest
  | ContextCaptureScreenshotRequest
  | SettingsTestConnectionRequest;
```

## Error Codes

Initial error codes should be stable and narrow.

- `NO_ACTIVE_TAB`
- `CONTENT_SCRIPT_UNAVAILABLE`
- `EMPTY_SELECTION`
- `PAGE_EXTRACTION_FAILED`
- `SCREENSHOT_CAPTURE_FAILED`
- `PROVIDER_AUTH_FAILED`
- `PROVIDER_RATE_LIMITED`
- `PROVIDER_REQUEST_FAILED`
- `SESSION_NOT_FOUND`
- `UNKNOWN_ERROR`

## Versioning Rule

If a message payload changes incompatibly, update the shared type first and then update all callers in the same branch. Do not support multiple message versions unless there is a concrete migration need.
