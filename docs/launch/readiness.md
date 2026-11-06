# Production launch evidence

A green PR proves the checks it ran. It does not prove that a deployment can
take a payment, deliver email, process a video, or broadcast a stream.

Keep a dated copy of the table below for the exact deployment being launched.
Use redacted evidence links; never commit credentials, customer data, card
details, database dumps, Terraform state, signed media URLs, or auth tokens.

## Evidence record

- Deployment URL:
- Deployed commit SHA:
- Reviewer and UTC date:
- Target customer/market:
- Pilot budget and owner:
- Overall decision: **NOT VERIFIED** until required rows pass.

| Required result                                                                | Environment                                                        | Evidence to record                                                                             | Status       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------ |
| Public pages, canonical URLs, sitemap and legal pages respond correctly        | Production, GET only                                               | Public smoke JSON and deployed SHA                                                             | NOT VERIFIED |
| Signup, confirmation email, login, logout and password recovery work           | Preview with isolated test accounts; production approved rehearsal | Desktop and mobile recording; email delivery ids redacted                                      | NOT VERIFIED |
| A new account receives the plan it actually paid for                           | Preview, Mercado Pago sandbox                                      | Charge id, matching ledger amount/currency, plan access                                        | VERIFIED [1] |
| Declined payment grants no unintended paid access                              | Preview, sandbox                                                   | Decline outcome and account access                                                             | VERIFIED [1] |
| Duplicate webhook delivery does not double grant                               | Preview, sandbox                                                   | Repeated notification and stable ledger/token balance                                          | VERIFIED [1] |
| Trial cancellation stops renewal and confirms end of access                    | Preview, sandbox                                                   | Provider cancellation state, account end date and delivered confirmation                       | NOT VERIFIED |
| Mandatory billing notices and bounce handling work                             | Preview, sandbox email fixtures                                    | Sent/delivered/bounced handling and provider state                                             | NOT VERIFIED |
| Clips accepts an allowed source and produces downloadable usable output        | Real engine, isolated test account                                 | Job timing, source duration, output count, successful downloaded files                         | NOT VERIFIED |
| Free/Pro/VIP limits match the UI and entitlement enforcement                   | Real engine, isolated accounts                                     | Upload, resolution, watermark, credits and access checks                                       | NOT VERIFIED |
| En vivo delivers to an actual destination and recovers after reconnect         | Real engine with private test destination                          | Sustained stream, reconnect, stop, destination and secret isolation results                    | NOT VERIFIED |
| A database backup can be restored                                              | Separate disposable recovery target                                | Backup age, restore duration, application integrity checks; no dump in repo                    | NOT VERIFIED |
| Infrastructure state is recoverable and locked                                 | Dedicated backend rehearsal                                        | Backend location, access controls, versioning, locking and rollback evidence                   | VERIFIED [2] |
| A consenting campaign visitor can be traced to activation and approved payment | Preview, synthetic campaign/test account                           | Campaign report plus signup/activation/conversion evidence; no user identifiers in event props | NOT VERIFIED |
| Consent rejection/withdrawal stops optional advertising attribution            | Preview                                                            | Network/storage check before consent, after rejection and after withdrawal                     | NOT VERIFIED |
| Actual processing cost and net revenue support the pilot                       | Pilot, real metering                                               | Credits charged, provider cost, storage/egress, payment fees, refunds and support cost         | NOT VERIFIED |
| Support and cancellation contact works                                         | Production approved rehearsal                                      | Monitored inbox owner, response record and escalation route                                    | NOT VERIFIED |

[1] Owner, 2026-11-06: the Mercado Pago dashboard shows the Checkout Pro
integration 100% complete (create order, notifications, test, go to
production) and integration quality 96/100. The owner tested it with Mercado
Pago test accounts.

[2] 2026-11-06: Terraform state migrated to `gs://chalyb-tfstate/prod`
(145 entries), public-access prevention on, local copies removed, backup kept
outside the repo. PR #149 enables the GCS backend.

Owner decision, 2026-11-06: no row for dependency monitoring or alerts.
Monitoring comes from the providers' own tools, not from the site.

A skipped test is not a pass. Static capabilities, HTTP 401, and a liveness 200
prove narrower facts than a completed processing/broadcast workflow.

## Public HTTP smoke

From Node 22, no secrets or installed dependencies are needed:

```sh
node scripts/check-launch-public.mjs https://www.chalyb.com --json
```

Exit 0 means the listed public HTTP checks passed; 1 means at least one
failed; 2 means invalid invocation. The runner only sends GETs, refuses
redirects instead of accepting a sign-in/protection page, times out individual
requests, and emits a report without response bodies or transport diagnostics.

It checks public HTML, canonical entry pages, published/indexable legal pages,
robots, sitemap and liveness. A legal page still in draft (noindex until
LEGAL_PUBLISH is on) fails on purpose, because it is a launch gate. It does not execute browser JavaScript or test
auth, email, payment, tool processing, analytics delivery or database recovery.
Run it against the canonical host, not the apex redirect. A preview needs its
canonical origin configured to its own origin, and an unprotected test URL;
do not put deployment bypass credentials in the command or evidence.

For local validation:

```sh
pnpm test
pnpm run ci
```

The normal GitHub browser suite uses mock adapters. The real Clips smoke needs
an isolated account, E2E_SMOKE_VIDEO_URL and the deployed real adapter. See
e2e/smoke/clips.smoke.spec.ts and playwright.config.ts. Billing state-changing
tests belong on previews with sandbox credentials, as that configuration
requires.

## Marketing decision

First demonstrate one complete customer journey for Clips. Include En vivo
in acquisition promises only after its broadcast and reconnect checks pass.
Keep unfinished tools out of public claims.

Before starting a capped pilot, fill the required evidence rows, confirm
production settings/deployed SHA, assign support ownership, and set a stop
condition for broken checkout, undelivered results or unexpected provider
spend. Measure campaign spend, signup, first successful result, approved paid
conversion and refunds. Landing clicks alone do not establish acquisition
cost or product activation.

Record paid acquisition cost per new paying customer and contribution after
processing, storage/egress, payment fees, refunds and support. Existing
operating-cost constants and manual FX estimates are planning inputs, not
proof of actual margin. Agree the pilot's acceptable loss and payback window
with the owner before expanding spend.

Merge-ready and launch-ready are separate decisions. Aldo owns deployment,
production mutations, infrastructure changes and marketing spend. Preparing
a PR does not apply migrations, move Terraform state or enable checkout flags.
