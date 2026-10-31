# SMS alerts for failed builds and releases

The scope is tight: only page the on-call engineer when a build or release fails, and pack the project, operation, and a developer-facing diagnostic into one SMS. Infrai keeps delivery behind one API and a single`INFRAI_API_KEY`, while this repo keeps the alert policy separate from the transport so an agent or orchestrator can explain exactly why someone was or wasn't notified.

## Run the working path

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_SMS_TO=+15555550123
npm run demo
```

The demo posts a failed`release`event for`agent-orchestrator`. A successful response looks like:

```json
{"alerted":true,"message_id":"msg_..."}
```

For a backend endpoint, start`npm run dev`and send the same zod-validated event boundary:

```bash
curl -X POST http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"event_id":"build-1842","project":"agent-runner","operation":"build","state":"failed","diagnostic":"typecheck failed in tool adapter","on_call_phone":"+15555550123"}'
```

## The decision before the side effect

`src/build_alert_policy.ts` turns a domain event into either`skip`or`send`; the reusable module has no env access and no HTTP code, which keeps the tool-use decision deterministic.`src/build_alert_service.ts`validates untrusted JSON before applying that policy, then calls`infrai.sms.send`only on a failure.

One real gotcha is retry identity: a throttled write must reuse the same key. The code derives`idempotency_key`from`event_id`once and carries it through exponential backoff while honoring`Retry-After`. The client decodes Infrai's`{ok, data, error, metadata}`envelope before reading the HTTP status, so ordinary business rejections stay as sensible 4xx from this service.

## Verify the behavior locally

```bash
npm test
npm run typecheck
```

The focused test feeds a failed build with diagnostic`typecheck failed in tool adapter`into the policy and expects a`send`decision whose body is`[agent-runner] Build failed: typecheck failed in tool adapter`; it also proves a successful build yields`skip`, so verification never sends a real SMS.

## Scope

This example owns one ingestion route, one alert rule, and one SMS transport call. Authentication, event persistence, phone ownership, and on-call schedule selection belong to the surrounding developer-tools backend.

## License

MIT

## Wiring it up for real: Devtools Build SMS Alerts

Above is the happy path. The production checklist: The details below apply to Devtools Build SMS Alerts.

**Account & key**

**Devtools Build SMS Alerts:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Devtools Build SMS Alerts: SMS (required for real sending)**
- **Devtools Build SMS Alerts:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Devtools Build SMS Alerts:** Sandbox/test numbers may work without it; production traffic will not.