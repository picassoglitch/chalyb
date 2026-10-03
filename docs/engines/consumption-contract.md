# Consumption contract: caps, admission, boost, metering

How an engine asks the hub before spending resources, and how it reports
what it spent. The hub is the only place that knows a user's tier, balance
and caps; an engine never decides on its own whether a user may run
something heavy.

Every route below uses the engine's bearer token (`<SLUG>_ADMIN_TOKEN`), as
`/usage` always has. Base: `{CHALYB_BASE_URL}/api/engines/{slug}`.

## The loop

```
engine                                   hub
  │ POST /usage/admit  ───────────────▶   checks caps, reserves tokens
  │ ◀── { allowed, lane, reservation_id, limits }   (atomic per user)
  │
  │  (allowed=false → show `reason`, do nothing)
  │  lane=standard → shared worker        lane=boost → one-shot Cloud Run Job
  │
  │ POST /usage  (events, reservation_id) ▶  records spend (idempotent)
  │ POST /usage/settle {outcome}  ────────▶  closes the reservation,
  │                                          charges the boost fee on success
```

A reservation that is never settled expires (`ttl_seconds`, default 3 h)
and stops counting. Long work (live streams) sends `outcome: "heartbeat"`
to push the expiry out again.

## POST /usage/admit

```jsonc
{
  "external_user_id": "uuid",
  "external_job_id": "stream_123", // engine's id; re-admitting the same id returns the same reservation
  "class": "job", // "job" (uploads, renders, analyses) | "stream" (live)
  "operation": "clips.pipeline",
  "est_tokens": 40000, // estimated provider cost ÷ 4 µ$, BEFORE margin (the hub adds it when reserving)
  "upload_mb": 812.4, // size of the file about to be uploaded/processed (0 if none)
  "source_minutes": 95.5, // duration of the media to process (0 if unknown/none)
  "storage_mb_after": 3120, // what the user will hold on this engine after this job
  "boost": null, // true = user asked for the boost lane, false = never, null = tier default
  "ttl_seconds": 10800,
}
```

Admitted (`200`):

```jsonc
{
  "ok": true, "allowed": true,
  "reservation_id": "uuid",
  "lane": "boost",                   // "standard" | "boost"
  "boost_fee_tokens": 0,             // charged on successful settle; 0 for VIP
  "limits": { "max_upload_mb": 20480, "max_source_minutes": 480, "max_concurrent_jobs": 4, ... },
  "balance": { "remaining": 4812345, "reserved": 40000, ... }
}
```

Refused (`200`, `allowed: false`). The engine shows the reason and does no
work. `reason` is one of:

| reason              | meaning                                                |
| ------------------- | ------------------------------------------------------ |
| `upload_too_large`  | `upload_mb` > tier `max_upload_mb`                     |
| `video_too_long`    | `source_minutes` > tier `max_source_minutes`           |
| `storage_full`      | `storage_mb_after` > tier `storage_mb`                 |
| `minutes_cap`       | monthly processed-minutes cap reached                  |
| `jobs_cap`          | monthly job count reached                              |
| `concurrency`       | too many jobs/streams running at once for this user    |
| `streams_cap`       | live streams not included / monthly streams reached    |
| `no_tokens`         | balance − open reservations < `est_tokens` + boost fee |
| `boost_unavailable` | `boost: true` but the tier can't buy it                |

Admins are never refused; their reservations are still recorded.

**Check twice.** Call admit before accepting bytes (to size the upload URL)
and again with the real `source_minutes` once the media is probed — pass
the same `external_job_id` with the updated numbers. The second call
re-checks the job against the caps and updates its reservation.

## POST /usage/settle

```jsonc
{ "reservation_id": "uuid", "outcome": "succeeded" } // succeeded | failed | cancelled | heartbeat
```

`succeeded` closes the reservation and charges `boost_fee_tokens` (one
`boost.fee` event, idempotent). `failed`/`cancelled` close it without the
fee. `heartbeat` extends expiry by the original TTL. Settling twice is a
no-op.

## POST /usage (unchanged path, stricter body)

- At most **100 events** per request.
- `amount`: integer, 0 ≤ amount ≤ 10^12.
- `cost_usd_micros`: integer, 0 ≤ cost ≤ 10^9 ($1,000) per event.
- `occurred_at`: within the last 7 days and at most 5 min in the future.
  Anything else is `422` and the engine must log it, not retry it.
- `reservation_id` (optional): ties the event to an admitted job.
- `metadata.tokens`: for `llm.tokens`, send the split
  `{ "input": n, "output": n, "cache_read": n, "cache_write": n }`.
  `amount` stays the total of all four.

### Billing unit

One balance, in **billable tokens**, priced at real cost plus the platform
margin (owner panel → Ajustes, `app_settings.usage_margin_percent`,
default **160%** — every unit consumed earns 160% over its cost):

```
billable_tokens = max(1, ceil(cost_usd_micros × (1 + margin) / 4))  when cost_usd_micros is sent
                = max(1, ceil(amount × (1 + margin)))              for llm.tokens without a cost
                = ceil(cost_usd_micros / 4)                        for boost.fee (already a price)
                = 1                                                otherwise
```

4 micros per token is the $4 / 1M-token unit. So an Opus output token draws
more than a cached Haiku input token, in proportion to what it costs us, and
every token carries the margin. The margin is frozen into each event when it
is written (`usage_events.margin_percent`); changing it never re-prices the
past. `cost_usd_micros` stays the exact provider cost: what we paid.
**Every event must carry `cost_usd_micros`** computed from the engine's
price table, including cache reads/writes and the tokens of failed
attempts and retries. Partner royalties and admin cost views read the same
`billable_tokens` column, so what a user is charged and what a partner is
paid can't drift apart.

### Meters engines must send

| kind                    | provider     | notes                                              |
| ----------------------- | ------------ | -------------------------------------------------- |
| `llm.tokens`            | anthropic, … | every attempt, incl. retries/failed; cache split   |
| `transcription.seconds` | assemblyai   | already sent by ChalyClip                          |
| `compute.seconds`       | gcp          | wall seconds × instance rate, per lane (see below) |
| `storage.gb_month`      | gcp          | optional; nightly gauge                            |
| `stream.minutes`        | gcp / relay  | ChalyOBS, on stream end                            |
| `engine.base`           | chalyb       | ChalyClip's flat per-run fee                       |

`compute.seconds` cost (Cloud Run, us-central1 tier-1 list prices):

| lane     | shape           | micros / second |
| -------- | --------------- | --------------- |
| standard | 4 vCPU / 8 GiB  | 88              |
| boost    | 8 vCPU / 32 GiB | 208             |

### Delivery

Events must survive restarts and scale-to-zero: write them to a local
outbox table in the same transaction as the work they describe, and drain it
to `/usage` with backoff. `(engine, source_id)` is unique on the hub, so
re-sending is always safe. A `4xx` other than 408/429 is permanent: mark
the row dead and alert. Do not drop it.

## Boost lane

`lane: "boost"` means "run this on a dedicated machine that exists only for
this job". On GCP that is the engine's `<engine>-boost` Cloud Run **Job**
(8 vCPU / 32 GiB, `max_retries = 0`), started with
`jobs/<name>:run` and a per-execution env override carrying the job id. The
container processes exactly that one job and exits, so nothing is left running.

- VIP: boost is the default (`boost: null` → boost) and the fee is 0.
- Other paid and free tiers: boost only when `boost: true`, and only if
  the balance covers `boost_fee_tokens` on top of the estimate.
- Compute on either lane is metered with `compute.seconds`.
