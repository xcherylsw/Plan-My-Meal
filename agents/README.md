# Today Cook What agent headquarters

GitHub is the source of truth for issues, code, agent instructions, CI runs and proposed changes. This directory documents specialised responsibilities; it does not itself run autonomous agents.

## Proposed workflow
1. QA detects a bug using a local or staging test environment with synthetic data.
2. Product agent writes an issue with reproduction steps and expected result.
3. Developer agent prepares a fix in a separate branch and opens a draft PR.
4. QA reruns the failing test plus related regression tests.
5. Release reviewer summarises the risk, tests and rollback plan.
6. Owner explicitly approves any merge or production deployment.

## First regression targets
- Cooked quantity subtracts the actual quantity (e.g. 7 eggs), not a planned quantity.
- Partial cooking and leftovers never deduct twice.
- Ingredient units and recipe servings are handled consistently.
- Seven-dinner generation respects time budgets, variety and complete-meal classification.
- Translation works throughout English, Chinese, Burmese and Tagalog interfaces.
- Desktop and mobile layouts are usable.

## Infrastructure
- GitHub Actions: build checks on PRs (no deployment credentials).
- Playwright: planned browser tests using synthetic local-only household data.
- Firebase: production remains untouched; staging must use a separate Firebase project before authenticated end-to-end testing.
- AI coding runtime: not yet connected. Any API tokens should be scoped, stored in secrets, and never exposed to untrusted PR code.

## Status
Foundation only: role guidance and a build-only CI workflow. Browser tests and autonomous fixes are not yet installed.
