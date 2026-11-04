import test from "node:test";
import assert from "node:assert/strict";
import { transition, stageFromLabels, handoverComment } from "./orchestrator.mjs";
test("developer cannot bypass disruptor", () => {
 assert.equal(transition(null,"start"),"intake");
 assert.equal(transition("intake","handoff"),"developer");
 assert.equal(transition("developer","handoff"),"disruptor");
 assert.throws(()=>transition("developer","pass"),/Invalid transition/);
 assert.equal(transition("disruptor","handoff"),"developer-response");
 assert.equal(transition("developer-response","handoff"),"qa");
});
test("developer can revise after challenge",()=>assert.equal(transition("developer-response","revise"),"developer"));
test("QA failure returns to developer for fresh review",()=>{
 assert.equal(transition("qa","fail"),"developer");
 assert.equal(transition("qa","pass"),"release-review");
 assert.equal(transition("release-review","handoff"),"approval");
});
test("invalid transitions fail closed",()=>{
 assert.throws(()=>transition("intake","pass"),/Invalid transition/);
 assert.throws(()=>transition("approval","handoff"),/Invalid transition/);
});
test("labels reject ambiguous states",()=>{
 assert.equal(stageFromLabels([{name:"bug"},{name:"agent-stage:disruptor"}]),"disruptor");
 assert.throws(()=>stageFromLabels(["agent-stage:qa","agent-stage:developer"]),/Multiple/);
});
test("handover makes limitations explicit",()=>assert.match(handoverComment("developer","disruptor","handoff"),/not proof an AI agent/));
