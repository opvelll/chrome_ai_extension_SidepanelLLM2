# Working Rules

## Commands to Run After Changes

- Run `pnpm typecheck` after code changes.
- Run `pnpm test:unit` after code changes.
- Run `pnpm build` after code changes that affect the extension bundle.
- Run `pnpm test:e2e` after UI, extension flow, or test-related changes.

## Test Layout

- Keep pure logic tests in `tests/unit`.
- Keep Chrome API mocked integration tests in `tests/integration`.
- Keep DOM and component tests in `tests/ui`.
- Keep real extension Playwright flows in `tests/e2e`.
- Reuse shared test helpers from `tests/helpers` and setup files from `tests/setup`.

## Architecture Conventions

- Keep cross-surface domain types in `src/shared/models.ts`.
- Keep Chrome runtime message schemas, request types, and response types in `src/shared/messages.ts`.
- Keep direct runtime, storage, provider, and other platform access in `src/lib` or a surface-local `lib` module.
- Keep `sidepanel/components` focused on presentation, `sidepanel/hooks` focused on stateful orchestration, and `sidepanel/utils` limited to pure helper logic.
- When a hook or component starts mixing UI state with runtime/storage calls or deduplication rules, extract the side-effect-free logic to `utils` and the message wrappers to `lib` before adding more branches.

## Skills

- Use `playwright-interactive` when verifying the extension UI, Chrome extension flows, or Playwright-based debugging.

## Design Policy

- Optimize the sidepanel for narrow widths first.
- Prefer a compact layout with minimal explanatory text.
- Keep primary actions icon-based; expose meaning with hover text and accessible labels.
- Favor tight vertical spacing and larger icons over decorative padding.
