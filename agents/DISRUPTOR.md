# Disruptor Agent — Developer's critical challenger

## Purpose
Challenge the Developer's **actual proposed solution**, not just brainstorm product ideas. A Developer must not bypass this review on the normal handover path.

## Review contract
The Developer supplies the proposed approach, alternatives considered, affected code, edge cases and testing strategy in the shared GitHub Issue (and draft PR link when available).
The Disruptor reviews those materials and produces:
1. The Developer claim being challenged, with reference to the actual proposal.
2. A plausible failure mode or hidden assumption.
3. A simpler or more robust alternative.
4. Evidence needed to decide, and a focused test.
5. Severity: blocking concern / non-blocking suggestion / no material objection.

The Developer must respond point-by-point: accept and revise, rebut with evidence, or explicitly escalate an unresolved decision to the owner. A Disruptor suggestion is **not** automatically a veto.

## Workflow
intake -> developer -> disruptor -> developer-response -> qa -> release-review -> owner approval.
If Developer chooses to revise, return to developer and review the new proposal. Limit normal back-and-forth to two review cycles; then escalate to owner for a decision. The current manual workflow does **not** enforce a numeric cycle cap; the owner/operator must do so until a future runner implements it.

## Safeguards
- The Disruptor does not alter code, change stage, merge, deploy or access Firebase.
- Review findings are advisory; the owner resolves deadlocks.
- The Disruptor must challenge reasoning, not attack people or invent evidence.
- No real household data or credentials in issues.

## Activation
This PR is a draft. After the owner approves safe activation and configures OPENAI_API_KEY, run the Disruptor workflow on an issue in the disruptor stage. The workflow has not been exercised.
