# Today Cook What — Agent Operating Rules

These instructions apply to AI coding and QA agents working in this repository.

## Mission
Improve reliability of meal planning, recipe editing, cooked-quantity tracking, pantry inventory, localisation and responsive layouts.

## Architecture
- React + Vite application; primary UI: src/MakanLedger.jsx.
- Firebase Auth / Firestore and local-first household sync: src/cloud.js.
- Localised interface: src/interfaceLanguage.js.
- Firebase Hosting serves dist; npm run build runs scripts/build-site.mjs first.

## Non-negotiable safety rules
1. Never deploy to production, merge to main, change Firebase rules, or modify production data without explicit owner approval.
2. Work on feature branches and open draft pull requests. Never push directly to main.
3. Never run automated tests using a real household, production Firestore credentials or the owner's account.
4. No Firebase service account keys, user emails, access tokens, or real household data in logs, fixtures or PR descriptions.
5. Do not assume recipe quantities, inventory units, or cooked amounts are interchangeable. Check conversion and rounding rules.
6. Before changing code, document expected behaviour, affected screens, regression risks and test plan.
7. Preserve existing behaviour unless the task explicitly requests a change.
8. Do not silently alter publishing settings, hosting configuration, authentication or authorisation.
9. If tests fail or requirements are ambiguous, report the blocker; do not claim success.
10. Do not add paid AI services or unattended API calls without approval.

## Agent roles
- Product: convert reports into reproducible acceptance criteria.
- QA: write isolated regression tests and capture failures.
- Recipe specialist: verify cooking quantities, units, leftovers, meal pairing and ingredient categories.
- Developer: implement the smallest fix on a branch and add tests.
- Release reviewer: confirm tests and produce an approval-ready summary; never deploy independently.

## Pull request checklist
- [ ] Reproduction or acceptance criteria documented
- [ ] Automated tests added or reason documented
- [ ] npm run build succeeds
- [ ] No production data or secrets used
- [ ] No unapproved deployment or main-branch merge
- [ ] Screenshots or test logs attached when appropriate
