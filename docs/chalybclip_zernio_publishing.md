# ChalybClip — Publishing via Zernio (replaces upload-post)

Build spec for swapping the clip-publishing backend from **upload-post** to
**Zernio** (`https://zernio.com/api/v1`). Publishing lives in **ChalybClip's** repo
(it renders + posts clips); `chalyb` stays vendor-agnostic. This doc is the
contract + reference implementation.

`chalyb`'s only involvement (both already in place in `src/lib/billing/tiers.ts`):

- **`clipConnectSocials`** — FREE `false`, PRO / PARTNER / VIP `true`. Connecting
  a social account is the COGS-bearing action (Zernio bills per connected
  account), so it's gated here and read off the SSO `tier` claim.
- **`clipAutoPublish`** — VIP `true` only. The stronger perk: hands-off
  auto-publish + scheduling on top of connect.

Why Zernio over upload-post: native **multi-tenant profiles** + a **white-label
connect URL** per end-user, **scheduling/queue**, signed **webhooks** (incl.
account-revocation), 14+ platforms, and you inherit Zernio's approved
TikTok/IG apps (likely avoids running your own TikTok Content-Posting audit).

---

## 0. Auth & config

- Base URL `https://zernio.com/api/v1`; header `Authorization: Bearer sk_…`.
- Store `ZERNIO_API_KEY` server-side only (never client). One key per
  environment; scope every call by `profileId`. Rotate on leak.
- SDKs (Node/Python), CLI, and an MCP server exist — use the SDK in ChalybClip's
  backend rather than hand-rolling HTTP.

---

## 1. Map a ChalybClip tenant → a Zernio profile

A Zernio **profile** = a container of social accounts = **one ChalybClip user**.

- On first publish-setup for a tenant: `POST /profiles { name, description }` →
  store `profile._id` on the tenant (`tenants.zernio_profile_id`). Idempotent:
  reuse if already set.
- Lifecycle: `GET/PATCH/DELETE /profiles/{id}` as the tenant renames/churns.
  On hard delete / downgrade past `clipConnectSocials`, delete the profile so
  Zernio stops billing for its accounts.

---

## 2. Connect social accounts (white-label, from inside ChalybClip)

Gate on `clipConnectSocials` (read from the SSO tier). FREE users never see the
connect button.

1. `GET /connect/{platform}?profileId=<id>` → `{ authUrl }`.
2. Open `authUrl` for the user (popup/redirect). Zernio runs the platform OAuth.
3. On return, the account is attached to that profile. Confirm via the
   `account.connected` webhook (or `GET /accounts?profileId=<id>`).

Notes:

- Platforms: Instagram, TikTok, YouTube, X, Facebook, LinkedIn, Threads,
  Pinterest, Reddit, Snapchat, Telegram, Google Business. **Bluesky** uses an
  app password (collect handle + app password, not OAuth).
- The platform consent screen shows **Zernio's** app — unavoidable with any
  aggregator; the upside is inherited app approval.
- Persist a local mirror of connected accounts per tenant
  (`{ account_id, platform, username, status }`) so the UI doesn't round-trip.

---

## 3. Publish a clip (video)

Three steps (ChalybClip already has the rendered clip on disk/CDN):

1. `POST /v1/media/presign` → `{ uploadUrl, publicUrl }`.
2. `PUT` the rendered clip bytes to `uploadUrl`.
3. `POST /posts`:
   ```jsonc
   {
     "content": "caption + #hashtags",
     "platforms": [
       { "platform": "tiktok", "accountId": "acc_…" },
       { "platform": "instagram", "accountId": "acc_…" },
     ],
     "mediaItems": [{ "type": "video", "url": "<publicUrl>" }],
     "publishNow": true, // OR "scheduledFor" + "timezone"
   }
   ```
   Response: `post._id`, `post.status`, and `post.results[]` with
   `{ platform, status, platformPostId, postUrl, error }` — store the `postUrl`s.

### Per-platform video specs (verified from Zernio docs)

| Platform      | Max size                       | Duration     | Format / codec       | Resolution / aspect       | Caption                |
| ------------- | ------------------------------ | ------------ | -------------------- | ------------------------- | ---------------------- |
| **TikTok**    | 4 GB                           | 3 s – 10 min | MP4/MOV/WebM · H.264 | 1080×1920 · 9:16 · 30 fps | 2,200                  |
| **IG Reels**  | 300 MB (auto-compresses above) | 3–90 s       | MP4/MOV · H.264      | 1080×1920 · 9:16          | 2,200                  |
| **YT Shorts** | 256 GB (channel limits apply)  | ≤ 3 min      | MP4/MOV/WebM…        | 1080×1920 · 9:16          | title 100 / desc 5,000 |

**The single render preset that posts to all three:** MP4, **H.264, 1080×1920
(9:16), ≤ 90 s, ≤ 300 MB, 30 fps, caption ≤ 2,200**. Render the master clip to
that and one `POST /posts` fans out to TikTok + IG Reels + YT Shorts. (The
binding limits are IG Reels' 90 s / 300 MB.) One video per post per platform — no
photo+video mixing on TikTok.

**TikTok gotchas:** every TikTok post must set `content_preview_confirmed` and
`express_consent_given` = true (TikTok legal consent). TikTok also enforces a
**per-account daily cap for third-party-API posts** separate from the app — plan
for `daily limit exceeded` errors with a 24 h retry/backoff, and surface a clear
"try again tomorrow" state rather than silently failing.

---

## 4. Scheduling (VIP / `clipAutoPublish`)

- One-off: `scheduledFor` (ISO) + `timezone` on `POST /posts` → `status:scheduled`.
- Recurring slots: `POST /queue { profileId, accountIds, time, timezone,
daysOfWeek[] }`; assign posts to fill the next open slot. Good for "auto-post
  every weekday 9am".
- Gate scheduling/auto-publish behind `clipAutoPublish` (VIP). PRO = connect +
  manual one-click publish; VIP = + hands-off scheduling.

---

## 5. Webhooks

Register `POST /webhooks/settings { url, events[] }`. Verify every delivery:
`X-Zernio-Signature` = HMAC-SHA256(rawBody, secret); dedup on `payload.id`;
respond 2xx within 5s (retries w/ backoff, 7 attempts).

Subscribe to:

- `post.published` / `post.failed` / `post.partial` → update clip status + store
  `postUrl`s; surface failures to the user.
- `account.disconnected` → mark the local account revoked, prompt reconnect,
  pause any scheduled posts that depend on it.
- (Optional) inbox events (`message.received`, …) if you later add engagement.

---

## 6. Token / balance + COGS guardrails

- Publishing itself isn't token-metered the way rendering is, but tie the
  connect/publish UI to tier (`clipConnectSocials`) so Free can't incur Zernio
  cost.
- **Zernio billing is per connected account/month** (first 2 free _org-wide_;
  then $6 → $3 → $1 graduated). Each user connecting TikTok+IG+YT = 3 billable
  accounts. Track connected-account count as a COGS line; consider a per-tenant
  cap (e.g. PRO ≤ N accounts) and reclaim accounts when a tenant downgrades or
  goes inactive (delete the profile → Zernio prorates down daily).

---

## 7. Migration from upload-post

1. Stand up the Zernio profile + connect flow behind a feature flag.
2. Ask existing users to **reconnect** their socials via the new Zernio connect
   URL (OAuth tokens are not portable between providers — a reconnect is
   required, not a migration).
3. Dual-run: keep upload-post for already-connected users until they reconnect,
   route new connects to Zernio.
4. Once reconnect rate is high enough, cut publish calls over to Zernio and
   decommission upload-post (remove its keys/secrets).
5. Map the field rename: upload-post "profiles/users" → Zernio "profiles";
   upload-post per-platform upload → Zernio presign + `POST /posts`.

---

## 8. Acceptance

- A PRO/VIP tenant connects TikTok/IG/YT from inside ChalybClip without leaving the
  app; `account.connected` arrives; the account shows in their UI.
- Publishing a clip returns live `postUrl`s; `post.published` webhook fires.
- VIP can schedule a clip for a future time / recurring slot; PRO cannot.
- FREE tenant sees no connect button (gated on `clipConnectSocials`).
- Disconnecting on the platform → `account.disconnected` → reconnect CTA.
- Downgrade below `clipConnectSocials` → profile deleted, Zernio billing stops.

---

## 9. ChalybClip-side reference — schema & endpoints

What ChalybClip owns. Zernio is the upstream; these are ChalybClip's own DB tables +
the routes its frontend calls. All routes resolve `tenant_id` from the ChalybClip
session and read entitlements (`clipConnectSocials`, `clipAutoPublish`) from the
SSO `tier` claim.

### DB (ChalybClip)

```sql
alter table tenants add column if not exists zernio_profile_id text;  -- one Zernio profile per tenant

-- Local mirror of accounts connected through Zernio (so the UI never round-trips).
create table social_accounts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         text not null,
  zernio_account_id text not null unique,
  platform          text not null,          -- tiktok | instagram | youtube | ...
  username          text,
  status            text not null default 'active',  -- active | revoked
  connected_at      timestamptz not null default now(),
  unique (tenant_id, platform, zernio_account_id)
);

-- One publish attempt of one clip; targets fan out per platform.
create table clip_publishes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  clip_id       uuid not null,
  zernio_post_id text,
  status        text not null default 'pending', -- pending|scheduled|published|partial|failed
  scheduled_for timestamptz,                      -- null = publish now
  created_at    timestamptz not null default now()
);
create table clip_publish_targets (
  publish_id       uuid not null references clip_publishes(id) on delete cascade,
  platform         text not null,
  social_account_id uuid not null references social_accounts(id),
  status           text not null default 'pending',
  platform_post_id text,
  post_url         text,
  error            text,
  primary key (publish_id, platform, social_account_id)
);
```

### ChalybClip routes (its backend → Zernio)

| Method   | Route                        | Gate                                                             | Does                                                                                                              |
| -------- | ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/social/profile`        | connect                                                          | Ensure `zernio_profile_id` (idempotent `POST /profiles`).                                                         |
| `GET`    | `/api/social/accounts`       | connect                                                          | List the tenant's `social_accounts`.                                                                              |
| `POST`   | `/api/social/connect`        | `clipConnectSocials`                                             | Body `{platform}` → `GET /connect/{platform}?profileId` → return `authUrl`.                                       |
| `DELETE` | `/api/social/accounts/:id`   | connect                                                          | Disconnect on Zernio; mark local `revoked`.                                                                       |
| `POST`   | `/api/clips/:clipId/publish` | `clipConnectSocials` (+ `clipAutoPublish` if `scheduledFor` set) | presign → PUT clip → `POST /posts`; write `clip_publishes` + targets.                                             |
| `POST`   | `/api/webhooks/zernio`       | — (HMAC)                                                         | Verify `X-Zernio-Signature`, dedup `payload.id`; update publishes (`post.*`) + accounts (`account.disconnected`). |

### Publish handler (pseudocode)

```python
def publish_clip(tenant, clip, req):
    require(tier_allows(tenant, "clipConnectSocials"))
    if req.scheduled_for:
        require(tier_allows(tenant, "clipAutoPublish"))   # scheduling = VIP

    presign = zernio.media.presign()                       # POST /v1/media/presign
    http_put(presign.uploadUrl, clip.render_bytes)         # 1080x1920 H.264 <=90s/300MB

    pub = db.create_publish(tenant, clip, req.scheduled_for)
    post = zernio.posts.create(                            # POST /posts
        content=req.caption,
        platforms=[{"platform": t.platform, "accountId": t.zernio_account_id}
                   for t in req.targets],
        mediaItems=[{"type": "video", "url": presign.publicUrl}],
        publishNow=(req.scheduled_for is None),
        scheduledFor=req.scheduled_for, timezone=req.timezone,
        # TikTok consent flags when a tiktok target is present:
        tiktok={"content_preview_confirmed": True, "express_consent_given": True},
    )
    db.attach_post(pub, post)        # store zernio_post_id; targets updated by webhook
    return pub
```

The `post.published / partial / failed` webhooks fill in `post_url` / `error`
per target; `account.disconnected` flips `social_accounts.status = revoked` and
pauses dependent scheduled publishes.
