<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# Browser testing and AI agents

- Prefer `bun` for project commands and dependency work.
- Use the repo-provided `webapp-testing` skill for ad hoc local web verification. Follow its helper workflow and run `python3 .agents/skills/webapp-testing/scripts/with_server.py --help` from the repo root before using the server helper.
- Use the repo-provided Playwright skills for quick browser exploration, selector discovery, screenshots, traces, and generated Playwright snippets. `bun run pw:cli -- --help` exposes the Playwright CLI without pinning it into this repo.
- Use Playwright MCP for longer exploratory browser loops or persistent page state. This repo configures `playwright` and `playwright-test` in `mcp.json`, and VS Code-compatible entries in `.vscode/mcp.json`.
- For committed E2E coverage, write Playwright tests under `tests/e2e/` with the `.e2e.ts` suffix, keep scenario plans under `specs/`, and start generated-agent flows from `tests/e2e/seed.e2e.ts`.
- Browser binaries should stay outside the small home partition. Use the package scripts so `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers` is set automatically.
- Prefer user-visible locators (`getByRole`, `getByLabel`, `getByPlaceholder`). If a locator can match hidden preserved content, filter with `filter({ visible: true })`.

# Frontend guidance

- Use the repo-provided `frontend-design` skill for visually led UI work.
- Use the repo-provided Vercel `vercel-react-best-practices`, `vercel-composition-patterns`, and `web-design-guidelines` skills when writing, reviewing, or refactoring React/Next.js UI.
- Treat this `AGENTS.md` as the canonical Vercel Agent guideline file for this repo.
