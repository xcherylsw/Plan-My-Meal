// Deterministic coordination only. No AI calls, code edits, merges or deployments.
export const stages = Object.freeze({
  intake: { owner: "Product", instruction: "Document reproduction steps, acceptance criteria and synthetic test data." },
  developer: { owner: "Developer", instruction: "Propose a solution and draft PR, explaining alternatives, trade-offs and tests." },
  disruptor: { owner: "Disruptor", instruction: "Challenge the Developer's actual proposal. Identify hidden assumptions, edge cases, unnecessary complexity and a simpler alternative. Post actionable objections with evidence." },
  "developer-response": { owner: "Developer", instruction: "Answer every Disruptor objection: accept with revision, rebut with reasoning, or escalate unresolved trade-offs to the owner. Update proposed solution." },
  qa: { owner: "QA", instruction: "Run isolated tests and record real evidence; do not assume the developer's claims are correct." },
  "release-review": { owner: "Release reviewer", instruction: "Summarise evidence and risks. Await explicit owner approval." },
  approval: { owner: "Owner", instruction: "Human approval required. This system cannot merge or deploy." },
});
export const LABEL_PREFIX = "agent-stage:";
export function transition(current, event) {
  const allowed = {
    none: { start: "intake" },
    intake: { handoff: "developer" },
    developer: { handoff: "disruptor" },
    disruptor: { handoff: "developer-response" },
    "developer-response": { handoff: "qa", revise: "developer" },
    qa: { pass: "release-review", fail: "developer" },
    "release-review": { handoff: "approval", reject: "developer" },
    approval: { reject: "developer" },
  };
  const next = allowed[current ?? "none"]?.[event];
  if (!next) throw new Error(`Invalid transition: ${current ?? "none"} + ${event}`);
  return next;
}
export function stageFromLabels(labels) {
  const found = labels.map(l => typeof l === "string" ? l : l.name).filter(l => l?.startsWith(LABEL_PREFIX));
  if (found.length > 1) throw new Error("Multiple stage labels; manual intervention required.");
  if (!found.length) return null;
  const stage = found[0].slice(LABEL_PREFIX.length);
  if (!stages[stage]) throw new Error("Unknown stage label: " + stage);
  return stage;
}
export function handoverComment(previous, next, event) {
  return [
    "### Today Cook What agent handover",
    `- Previous stage: ${previous ?? "none"}`,
    `- Event: ${event}`,
    `- New stage: **${next}**`,
    `- Responsible role: **${stages[next].owner}**`,
    `- Required next action: ${stages[next].instruction}`,
    "- Evidence: add reproducible steps, test results, decisions and PR links in this issue.",
    "- Safety: no production data, automatic merges or production deployments.",
    "",
    "_This is a deterministic handover, not proof an AI agent completed the task._",
  ].join("\n");
}
