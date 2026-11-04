import test from "node:test";
import assert from "node:assert/strict";
import { transition, stageFromLabels, handoverComment } from "./orchestrator.mjs";
test("issue intake and handovers", () => {
  assert.equal(transition(null, "start"), "intake");
  assert.equal(transition("intake", "handoff"), "developer");
  assert.equal(transition("developer", "handoff"), "qa");
  assert.equal(transition("qa", "pass"), "release-review");
  assert.equal(transition("release-review", "handoff"), "approval");
});
test("QA failures return to developer", () => assert.equal(transition("qa", "fail"), "developer"));
test("invalid transitions fail closed", () => {
  assert.throws(() => transition("intake", "pass"), /Invalid transition/);
  assert.throws(() => transition("approval", "handoff"), /Invalid transition/);
});
test("labels reject ambiguous states", () => {
  assert.equal(stageFromLabels([{name:"bug"}, {name:"agent-stage:qa"}]), "qa");
  assert.throws(() => stageFromLabels(["agent-stage:qa","agent-stage:developer"]), /Multiple/);
});
test("handover makes limitations explicit", () => assert.match(handoverComment("qa","release-review","pass"), /not proof an AI agent/));
