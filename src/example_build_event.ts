import { handleBuildEvent } from "./build_alert_service";

const phone = process.env.DEMO_SMS_TO;
if (!phone) throw new Error("DEMO_SMS_TO is required");

const result = await handleBuildEvent({
  event_id: "release-2026-08-26.1",
  project: "agent-orchestrator",
  operation: "release",
  state: "failed",
  diagnostic: "health check failed after deployment",
  on_call_phone: phone,
});

console.log(result);
