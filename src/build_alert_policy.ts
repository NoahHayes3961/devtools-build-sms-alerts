import { z } from "zod";

export const buildEventSchema = z.object({
  event_id: z.string().min(1),
  project: z.string().min(1),
  operation: z.enum(["build", "release"]),
  state: z.enum(["started", "succeeded", "failed"]),
  diagnostic: z.string().min(1).max(240),
  on_call_phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});

export type BuildEvent = z.infer<typeof buildEventSchema>;

export type AlertDecision =
  | { action: "skip"; reason: "non_failure" }
  | { action: "send"; to: string; body: string; idempotencyKey: string };

export function decideBuildAlert(event: BuildEvent): AlertDecision {
  if (event.state !== "failed") {
    return { action: "skip", reason: "non_failure" };
  }

  const label = event.operation === "release" ? "Release" : "Build";
  return {
    action: "send",
    to: event.on_call_phone,
    body: `[${event.project}] ${label} failed: ${event.diagnostic}`,
    idempotencyKey: `devtools-event:${event.event_id}`,
  };
}
