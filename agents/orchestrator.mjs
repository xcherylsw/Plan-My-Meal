// Deterministic coordination only. No AI calls, code edits, merges or deployments.
export const stages = Object.freeze({
  intake: { next: "developer", owner: "Product", instruction: "Document reproduction steps, acceptance criteria and test data." },
  developer: { next: "qa", owner: "Developer", instruction: "Propose a fix in a draft PR; include tests and a link to this issue." },
  qa: { next: "release-review", owner: "QA", instruction: "Run isolated tests, record evidence and pass/fail." },
  "release-review": { next: "approval", owner: "Release reviewer", instruction: "Summarise evidence and risks. Await explicit owner approval." },
  approval: { next: null, owner: "Owner", instruction: "Human approval required. This system cannot merge or deploy." },
});
export const LABEL_PREFIX = "agent-stage:";
export function transition(current, event) {
  const allowed = {
    none: { start: "intake" },
    intake: { handoff: "developer" },
    developer: { handoff: "qa" },
    qa: { pass: "release-review", fail: "developer" },
    "release-review": { handoff: "approval", reject: "developer" },
    approval: { reject: "developer" },
  };
  const next = allowed[current ?? "none"]?.[event];
  if (!next) throw new Error(`Invalid transition: ${current ?? "none"} + ${event}`);
  return next;
}
export function stageFromLabels(labels) {
  const stagesFound = labels.map(l => typeof l === "string" ? l : l.name)
    .filter(l => l?.startsWith(LABEL_PREFIX));
  if (stagesFound.length > 1) throw new Error("Multiple stage labels; manual intervention required.");
  if (!stagesFound.length) return null;
  const stage = stagesFound[0].slice(LABEL_PREFIX.length);
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
    "- Evidence: add reproducible steps, test results and PR links in this issue.",
    "- Safety: no production data, automatic merges or production deployments.",
    "",
    "_This is a deterministic workflow handover, not proof an AI agent completed the task._",
  ].join("\n");
}
