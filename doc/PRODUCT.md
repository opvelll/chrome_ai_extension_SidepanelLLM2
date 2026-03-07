# Product

## Summary

This project is a Chrome side panel chat extension that lets a user talk to an AI model with browser context attached.

The rebuild will treat this as a focused product, not as an experiment layered onto a boilerplate.

## Product Goals

- provide a fast side panel chat workflow inside the browser
- make page context capture easy and explicit
- keep setup simple enough for one user to run and evolve
- make the codebase easier to own than the current fork-based approach

## Primary User

The primary user is the developer-owner of the extension.

The product should still be designed as if it may later be shared with other users, but the initial target is a power user who wants a reliable browser-native AI assistant.

## Core Use Cases

1. Ask a question about the current page with selected text attached.
2. Ask for a summary of the full page.
3. Attach a screenshot and ask for visual analysis.
4. Reuse a preferred system prompt.
5. Continue a previous conversation from saved history.

## MVP Scope

The first release should include only the minimum product surface needed to make the extension useful every day.

### Included

- side panel chat UI
- API key storage from the options page
- single provider support through OpenAI-compatible chat completions
- single model selection
- system prompt setting
- session list and message history
- page selection text capture
- full page text capture
- screenshot capture
- clear loading and error states

### Excluded

- YouTube subtitle integration
- editable custom action buttons
- multiple AI providers
- prompt marketplace or template library
- advanced sync across browsers
- public package extraction of the chat UI

## UX Principles

- the side panel must feel lightweight and fast
- page context should be visible before send
- destructive actions must be obvious and confirmable
- settings belong in options, not buried in the chat flow
- errors must say what failed and what the user can do next

## Main Screens

### Side Panel

Contains:

- current session header
- message list
- context tray for attached browser context
- composer
- quick actions for common context capture

### Options

Contains:

- API key input
- model selector
- default system prompt editor
- context preset management
- basic UI preferences

## Functional Requirements

### Chat

- user can create a new session
- user can send a message
- assistant response is appended to the same session
- a failed response does not destroy the draft or session history

### Context Capture

- user can attach selected text from the active tab
- user can attach visible page text from the active tab
- user can attach a screenshot from the active tab
- attached context is shown before send

### Settings

- user can save and update an API key
- user can choose a default model
- user can save and update a default system prompt

### Persistence

- sessions persist across browser restarts
- messages persist per session
- settings persist independently from sessions

## Quality Requirements

- message contracts are typed
- UI code never calls the AI provider directly
- the extension remains usable when a context capture action fails
- storage logic is testable without rendering the full UI

## Success Criteria

The rebuild is successful when:

- a new session can be started from the side panel
- the extension can answer using the saved API key
- page context can be attached in under two clicks
- the codebase can evolve without syncing upstream boilerplate branches

## Future Expansion

These are valid future directions after MVP is stable:

- site-specific context providers such as YouTube
- support for multiple providers
- streaming responses
- prompt presets with richer metadata
- export or share session history
