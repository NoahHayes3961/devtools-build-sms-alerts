import { createServer } from "node:http";
import { ZodError } from "zod";
import { buildEventSchema, decideBuildAlert } from "./build_alert_policy";
import { infrai, InfraiError } from "./infrai_sms";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function reply(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

export async function handleBuildEvent(input: unknown) {
  const event = buildEventSchema.parse(input);
  const decision = decideBuildAlert(event);
  if (decision.action === "skip") return { alerted: false, reason: decision.reason };

  const receipt = await infrai.sms.send({
    to: decision.to,
    body: decision.body,
    idempotency_key: decision.idempotencyKey,
  });
  return { alerted: true, message_id: receipt.message_id };
}

export function startBuildAlertService(port = 3000) {
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/build-events") {
      reply(response, 404, { error: "route_not_found" });
      return;
    }
    try {
      reply(response, 200, await handleBuildEvent(await readJson(request)));
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        reply(response, 400, { error: "invalid_build_event" });
      } else if (error instanceof InfraiError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        reply(response, status, { error: error.code, message: error.message });
      } else {
        reply(response, 500, { error: "service_error" });
      }
    }
  }).listen(port, () => console.log(`build alert service listening on http://localhost:${port}`));
}

if (process.argv[1]?.endsWith("build_alert_service.ts")) startBuildAlertService();
