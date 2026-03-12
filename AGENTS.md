# Working Rules

## Commands to Run After Changes

- Run `pnpm typecheck` after code changes.
- Run `pnpm build` after code changes that affect the extension bundle.
- Run `pnpm exec playwright test` after UI, extension flow, or test-related changes.

## Skills

- Use `playwright-interactive` when verifying the extension UI, Chrome extension flows, or Playwright-based debugging.

## Documentation

- If a change affects the overall architecture or makes the structure easier to misunderstand, add or update a short high-level architecture note in `AGENTS.md`.
- Keep architecture notes simple: list the main modules, their responsibilities, and the primary data flow only.
