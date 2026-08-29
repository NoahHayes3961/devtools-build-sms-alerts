import assert from "node:assert/strict";
import test from "node:test";
import { buildEventSchema, decideBuildAlert } from "../src/build_alert_policy";

const baseEvent = {
  event_id: "build-1842",
  project: "agent-runner",
  operation: "build" as const,
  diagnostic: "typecheck failed in tool adapter",
  on_call_phone: "+15555550123",
};

test("a failed build becomes one diagnostic SMS with an event-stable key", () => {
  const event = buildEventSchema.parse({ ...baseEvent, state: "failed" });
  assert.deepEqual(decideBuildAlert(event), {
    action: "send",
    to: "+15555550123",
    body: "[agent-runner] Build failed: typecheck failed in tool adapter",
    idempotencyKey: "devtools-event:build-1842",
  });
});

test("a successful build does not page the on-call engineer", () => {
  const event = buildEventSchema.parse({ ...baseEvent, state: "succeeded" });
  assert.deepEqual(decideBuildAlert(event), { action: "skip", reason: "non_failure" });
});
