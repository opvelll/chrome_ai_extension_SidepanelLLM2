# Working Rules

## Commands to Run After Changes

- Run `pnpm typecheck` after code changes.
- Run `pnpm test:unit` after code changes.
- Run `pnpm build` after code changes that affect the extension bundle.
- Run `pnpm exec playwright test` after UI, extension flow, or test-related changes.

## Skills

- Use `playwright-interactive` when verifying the extension UI, Chrome extension flows, or Playwright-based debugging.

## Design Policy

- Optimize the sidepanel for narrow widths first.
- Prefer a compact layout with minimal explanatory text.
- Keep primary actions icon-based; expose meaning with hover text and accessible labels.
- Favor tight vertical spacing and larger icons over decorative padding.
