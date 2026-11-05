# Liveness, readiness and outage alerts

The public `GET /api/health` is a cheap liveness check. A 200 only means
the hub request handler is answering; it does not mean a customer can use
Clips, pay, or broadcast.

## Protected readiness monitor

An external monitor should call `GET https://www.chalyb.com/api/ready` every
60 seconds with `Authorization: Bearer <CRON_SECRET>` in its protected
header configuration. Never put the secret in a URL, command history,
screenshots or a committed file. No secret returns 401 and no probes run.
The response is private/no-store. A missing server secret also returns 401.

Readiness performs a bounded, read-only catalog query and checks the
currently active public tools. It returns 200 only when at least one public
tool is active and every active public tool passes. Missing URLs, an empty
active set, unknown probes, database errors, redirects, failures and timeouts
return 503. The entire operation has an eight-second budget and aborts
outstanding requests. It never provisions tenants, submits jobs, sends
emails or calls a payment provider.

- Clips: `/readyz` must answer 200 with `status: ready`. The engine's
  implementation checks its database connection. It is deliberately public
  in the engine's auth allowlist.
- En vivo: `/api/hub/v1/state` must answer 401 to an anonymous request,
  matching its existing protected API contract. This establishes API
  reachability only. It does not establish RTMP ingest, relay availability,
  destination OAuth, broadcasting, or valid hub SSO credentials.
- Engine targets match the real adapters: `CHALYBCLIP_API_BASE` for Clips and
  trimmed `CHALYBOBS_API_BASE` for En vivo take precedence; otherwise the
  catalog `external_url` is used. Targets must use HTTPS and carry no
  credentials. The monitor does not follow redirects or disclose URLs/error
  bodies.

Configure the monitor to notify the operating owner after repeated failures,
including 401 (misconfigured secret). Alert delivery is an external setting;
this PR does not install a monitor or prove a notification was received.

## Existing tool outage emails

`/api/cron/tools-health` remains a separate authenticated scheduler job.
Run it every 60 seconds with the same protected header and alert on failed
scheduler executions. It records tool health and emails `TOOL_ALERT_EMAIL`
(or the contact inbox) after an outage exceeds five minutes. The Clips
production probe now calls the real engine readiness endpoint instead of
reading static capability constants. Mode-off tools are still skipped by
that scheduler; monitor `/api/ready` for public tools regardless of hub mode.

A provider accepting an email is not proof that a human received it. Before
paid traffic, on a preview environment with test recipients:

1. Verify both endpoints return the expected status with and without auth.
2. Simulate a dependency outage; verify readiness returns 503 and recovers.
3. Run the tool scheduler through the five-minute threshold and confirm one
   owner email, then verify recovery and a later new incident can alert.
4. Pause the external scheduler in preview and verify its monitor alerts.
5. Record date, deployment SHA, statuses, monitor name and recipient
   confirmation in the release evidence. Do not record secrets.

## Limits of a green readiness result

A 200 is a dependency smoke check, not a launch approval. Real signup,
email delivery, payment/cancel/refund webhooks, clip generation/download,
tier enforcement, RTMP broadcasting/reconnect, backups and restoration need
their own release tests. The endpoint does not silently treat a skipped
functional test as passing.
