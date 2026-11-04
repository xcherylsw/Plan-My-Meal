# Connect the AI role reviewers (opt-in)

This phase connects GitHub Issues to an OpenAI model for **advisory comments only**. It does not execute code changes or automatically advance issues. It does not use Firebase.

## Prerequisites
1. Review PR #40, PR #41 and this PR. Do not merge until existing deployment triggers are audited; merging to main may trigger an existing production workflow.
2. In GitHub repository Settings > Secrets and variables > Actions, create repository secret `OPENAI_API_KEY` using an API key from your own OpenAI API project. API usage is billed separately from ChatGPT.
3. Consider API spending limits and key rotation. Never paste the key in an issue, chat or code.
4. Merge approved workflows only after verifying that merge-to-main does not deploy production. Alternatively keep this on a protected non-production branch and adapt workflow triggers accordingly.

## Operating procedure
1. Create an Issue with synthetic example data and acceptance criteria.
2. Manually run 'Agent handover (manual, no deployment)' with event `start` to set `agent-stage:intake`.
3. Manually run 'Agent AI review (manual, no code changes)' with the issue number.
4. Review the AI's advisory comment. If useful, manually advance using 'Agent handover'.
5. Repeat for each stage. The Developer role currently writes a plan, **not** a code patch. QA reports an assessment, **not** actual test execution.
6. The final approval stage does not grant any deployment permission.

## Security and limits
- Workflow is manual only; no scheduled AI usage.
- GITHUB_TOKEN has read-only repository contents and issue-comment write access.
- The OpenAI API receives the issue title, body and up to ten recent human comments. Do not put sensitive household data or credentials in issues.
- Model responses are untrusted and do not automatically trigger tools or transitions.
- Existing deployment configuration must be audited separately.
- For true autonomous code fixing, add isolated staging, Playwright tests, restricted pull-request-only permissions, bounded retries and owner approvals.
