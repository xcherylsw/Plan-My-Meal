# Agent orchestration: phase 1

This is a **manual-triggered, deterministic handover engine**, not yet an autonomous AI orchestrator.

## Shared communications
Each task uses one GitHub Issue as its durable shared record. A GitHub Actions workflow validates stage transitions, updates one `agent-stage:...` label and posts a structured handover comment. All roles can read the same history.

Stages: intake -> developer -> qa -> release-review -> approval.
QA fail or review reject -> developer. Approval is a terminal handover stage, **not** permission to merge or deploy.

## How to operate after merging this workflow
1. Open a GitHub Issue with reproduction steps and acceptance criteria.
2. In Actions > Agent handover (manual, no deployment) > Run workflow, enter the issue number and event `start`.
3. After the responsible person or AI agent completes its task, run the workflow with `handoff`, `pass`, `fail` or `reject`, as appropriate.
4. Read the updated issue label and handover comment.
5. Review and approve releases outside this workflow. It cannot merge, deploy or touch Firebase.

## Future phase (not implemented)
A restricted AI runner will consume issue events and structured reports, invoke specialist models, create draft PRs and trigger isolated QA tests. Add an allowlist, budget limits, retry caps and staging environment before enabling autonomous execution.

## Local validation
`node --test agents/orchestrator.test.mjs`
