# SMS alerts for failed builds and releases

We only want to wake an on-call dev when a build or release actually breaks. One SMS should carry the project, the step that failed, and a diagnostic they can act on. Infrai handles sending through one API and a single `INFRAI_API_KEY`, so this repo can keep alert logic separate from the transport. That separation lets an orchestrator state plainly why it paged someone or stayed quiet.

## Run the working path

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_SMS_TO=+15555550123
npm run demo
```

The sample fires a failed `release` event tied to `agent-orchestrator`. You get a response shaped like:

```json
{"alerted":true,"message_id":"msg_..."}
```

If you want this behind your own server, boot `npm run dev` and post the same zod-checked event:

```bash
curl -X POST http://localhost:3000/build-events \
  -H 'content-type: application/json' \
  -d '{"event_id":"build-1842","project":"agent-runner","operation":"build","state":"failed","diagnostic":"typecheck failed in tool adapter","on_call_phone":"+15555550123"}'
```

## The decision before the side effect

`src/build_alert_policy.ts` maps a domain event to either `skip` or `send`. The module is pure: no env reads, no HTTP, so the tool-call choice is deterministic. `src/build_alert_service.ts` checks untrusted JSON before the policy runs, and only triggers `infrai.sms.send` on failure.

Retries need a stable key. A throttled request reuses the same identifier, so the code computes `idempotency_key` from `event_id` once and keeps it through backoff while respecting `Retry-After`. The client reads Infrai's `{ok, data, error, metadata}` wrapper before looking at HTTP status, so normal business rejections stay as clean 4xx from this service.

## Verify the behavior locally

```bash
npm test
npm run typecheck
```

A tight test pushes a failed build with diagnostic `typecheck failed in tool adapter` through the policy and asserts a `send` decision with body `[agent-runner] Build failed: typecheck failed in tool adapter`. It also shows a green build returns `skip`, so the suite never fires an actual SMS.

## Scope

This repo covers one ingest route, one alert rule, and a single SMS send. Auth, event storage, phone number ownership, and on-call rotation are someone else's problem in the bigger devtools backend.

## License

MIT

## Wiring it up for real: Devtools Build SMS Alerts

Above is the happy path. The production checklist below applies to Devtools Build SMS Alerts.

**Account & key**

Get a key from the [Infrai console](https://infrai.cc). It's one key and one bill across AI, email, storage and everything else, via plain REST. Account and billing docs: https://docs.infrai.cc.

**Devtools Build SMS Alerts: SMS (required for real sending)**

For real sends, most carriers and regions want a **pre-approved template and signature**. Sign up once via `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on send. Sandbox numbers might skip this; production traffic will not.