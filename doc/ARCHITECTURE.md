# Architecture

## Goals

This project will be rebuilt as a product-owned Chrome extension, not as a long-lived fork of an upstream boilerplate.

The architecture should optimize for:

- clear boundaries between extension surfaces
- a small and explicit message contract
- low coupling between chat UI and browser-specific logic
- easy replacement of AI providers later

## Top-Level Structure

The new project should start from a simple app layout.

```text
src/
  background/
  content/
  sidepanel/
  options/
  shared/
  lib/
```

## Responsibilities

### `src/background`

Owns privileged extension logic.

- receives requests from side panel and content scripts
- calls the AI provider
- accesses Chrome APIs that should not live in UI code
- coordinates capture, tab inspection, and persistence flows

This layer is the only place that knows about provider-specific request details.

### `src/content`

Owns page extraction logic.

- selection text extraction
- page text extraction
- page metadata extraction
- future site-specific integrations such as YouTube subtitle extraction

This layer should avoid AI logic and should return normalized page context data.

### `src/sidepanel`

Owns the main chat experience.

- message list
- composer
- context chips
- image preview
- loading and error states
- session switching

The side panel should not call OpenAI directly. It only talks to `background` through typed messages.

### `src/options`

Owns durable settings UI.

- API key management
- model selection
- system prompt
- context preset management
- UI preferences

### `src/shared`

Owns cross-surface contracts only.

- message types
- storage keys
- domain models
- validation schemas
- shared constants

This folder must stay small. It is not a dumping ground for generic helpers.

### `src/lib`

Owns implementation utilities that are not tied to a single extension surface.

- storage adapter
- logger
- provider clients
- session serializers
- formatting helpers

## Runtime Boundaries

The extension has four runtime environments:

1. Side panel UI
2. Options UI
3. Background service worker
4. Content scripts

Each environment should depend on `shared`, but should not directly depend on each other except through Chrome messaging.

## Messaging Rule

All cross-runtime communication must go through a typed contract defined in `src/shared/messages`.

Rules:

- every request has a `type`
- every response has a success or error shape
- payloads should be serializable
- no UI component should construct ad hoc message payloads inline

Validation should happen at the boundary, ideally with `zod`.

## Data Ownership

Data should be split by purpose instead of being stored as one broad settings object.

- `settings`: API key, model, system prompt, UI preferences
- `sessions`: session metadata such as title and timestamps
- `messages`: chat history per session
- `contextPresets`: reusable prompt snippets

The storage implementation should be wrapped so that the backing store can change later without rewriting UI code.

## AI Provider Boundary

The provider adapter should sit behind a small interface.

Example responsibilities:

- build request payloads
- stream or non-stream completions
- normalize token usage
- map provider errors into app-level errors

This keeps the product open to future provider changes without rewriting the side panel.

## UI Composition

The chat UI should be rebuilt as product-specific components, not as a reusable package like `react-ai-chat-view`.

Recommended component groups:

- `ChatLayout`
- `MessageList`
- `MessageBubble`
- `Composer`
- `ContextTray`
- `ImageAttachmentPreview`
- `SessionHeader`

The initial goal is a strong extension-specific UI, not a generic chat framework.

## Delivery Strategy

Implementation should follow risk order, not feature count.

1. Extension boot and side panel render
2. Options page and API key persistence
3. Background-to-provider round trip
4. Basic chat session send and receive
5. Selection and page context extraction
6. Screenshot context
7. Session persistence
8. Context presets
9. YouTube subtitle integration

## Non-Goals

These are intentionally deferred:

- reusable public chat component package
- upstream boilerplate sync strategy
- multi-provider abstraction beyond one clean adapter
- large shared design system before the product flow is stable
