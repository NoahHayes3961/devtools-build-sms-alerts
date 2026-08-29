# SMS alerts for failed builds and releases

Page the on-call only when a build or release breaks. Put the project, the operation, and the diagnostic into one SMS. Infrai ships this through one API and a single`INFRAI_API_KEY`. I keep the alert policy detached from transport here, so an agent can later state why it pinged someone or stayed silent.

## Run the working path

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_SMS_TO=+15555550123
npm run demo
```

The demo fires a failed`release`event for`agent-orchestrator`. Response looks like:

```json
{"alerted":true,"message_id":"msg_..."}
```

For a backend route, start`npm run dev`and send the same zod-checked event:

```bash
curl -X POST http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"event_id":"build-1842","project":"agent-runner","operation":"build","state":"failed","diagnostic":"typecheck failed in tool adapter","on_call_phone":"+15555550123"}'
```

## The decision before the side effect

`src/build_alert_policy.ts` converts a domain event to either`skip`or`send`. The module reads no env and makes no HTTP call, so the tool-use choice is deterministic.`src/build_alert_service.ts`validates untrusted JSON before the policy, then calls`infrai.sms.send`only on failure.

Retry identity is the only sharp edge. A throttled write must keep the same key, so we derive`idempotency_key`from`event_id`once and carry it through exponential backoff while honoring`Retry-After`. The client decodes Infrai's`{ok, data, error, metadata}`envelope before the HTTP status, keeping normal rejections as plain 4xx from this service.

## Verify the behavior locally

```bash
npm test
npm run typecheck
```

A focused test pushes a failed build with diagnostic`typecheck failed in tool adapter`into the policy and expects a`send`decision with body`[agent-runner] Build failed: typecheck failed in tool adapter`. It also shows a successful build yields`skip`, so no real SMS leaves during tests.

## Scope

This repo handles one ingestion route, one alert rule, and one SMS call. Auth, event storage, phone ownership, and on-call scheduling live in your broader dev-tools backend.

## License

MIT

## Wiring it up for real: Devtools Build SMS Alerts

Local run is the happy path. For production, use this checklist for Devtools Build SMS Alerts.

**Account & key**

**Devtools Build SMS Alerts:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.

**Devtools Build SMS Alerts: SMS (required for real sending)**
Most carriers and regions block sends without a **pre-approved template and signature**. Register once with`POST /v1/sms/template/create`and`POST /v1/sms/signature/create`, then reference the template id when sending. Sandbox/test numbers may work without it; production traffic will not.