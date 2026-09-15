# ChalyClip — "Watch a Drive folder" (auto-ingest VODs)

Complete build spec for the Google-Drive auto-ingest feature shown on ChalyClip's
dashboard ("Watch a Drive folder → Connect a Drive folder"). The watcher and the
video pipeline live in **ChalyClip's** repo (FastAPI + worker), not in `chalyb`.
This doc is the contract + reference implementation so whoever builds it on the
ChalyClip side has everything.

`chalyb`'s only involvement is two things, both already in place:

1. **Entitlement** — `TIER_CAPS[...].clipDriveAutoIngest` (added in
   `src/lib/billing/tiers.ts`). FREE = false; PRO / PARTNER / VIP = true. The
   tier is signed into ChalyClip's SSO token (`tier` claim), so ChalyClip gates the
   feature off the same value as every other clip cap.
2. **Token balance** — ChalyClip pre-checks the user's balance before ingesting
   via the existing `GET /api/engines/chalybclip/usage/balance?external_user_id=…`
   endpoint, and reports consumption via `POST /api/engines/chalybclip/usage`.

---

## 1. Detection model — scheduled incremental poll (the "schedule type")

Use the Drive **Changes API** with a stored cursor, polled on a schedule. Do NOT
re-list the folder each tick (`files.list` re-scans everything and burns quota).

- On connect: `changes.getStartPageToken` → store as the watch's cursor.
- Every ~60 s per active watch (cron/worker): `changes.list(pageToken=cursor,
includeRemoved=true, supportsAllDrives=true, includeItemsFromAllDrives=true)`.
- Advance the cursor to the returned `newStartPageToken` only AFTER successfully
  enqueuing the new files.

This yields the "detected within ~60 seconds" SLA. **Optional upgrade later:**
add `changes.watch` push channels for lower latency, but keep the poll as the
reconciliation safety net (push can silently drop notifications and channels
expire). Polling-only is the correct v1.

---

## 2. OAuth (connect a Drive folder)

Per-user OAuth, least privilege:

- Scope: `https://www.googleapis.com/auth/drive.readonly` (read files + metadata).
  Avoid full `drive` scope.
- Flow: ChalyClip "Connect a Drive folder" → Google consent → callback stores the
  **refresh token encrypted at rest** (KMS / libsodium; never plaintext, never
  logged). Access tokens are short-lived and refreshed on demand.
- Folder picker: use the Google Picker API (or paste a folder URL) to capture the
  `folder_id`.
- Revocation: if a refresh fails with `invalid_grant`, mark the watch `error`,
  surface a "reconnect Drive" CTA, and stop polling.

---

## 3. Schema (ChalyClip DB)

```sql
-- One row per watched folder.
create table drive_watches (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,            -- ChalyClip tenant (= chalyb user_id)
  folder_id       text not null,            -- Google Drive folder id
  folder_name     text,
  drive_id        text,                     -- non-null for Shared Drives
  oauth_cred_id   uuid not null references drive_oauth_credentials(id),
  page_token      text,                     -- Changes API cursor
  status          text not null default 'active',  -- active | paused | error
  last_polled_at  timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, folder_id)
);

-- Dedup ledger: never process the same file/version twice.
create table drive_ingested_files (
  watch_id        uuid not null references drive_watches(id) on delete cascade,
  drive_file_id   text not null,
  drive_version   text not null,            -- file's `version` or md5Checksum
  job_id          uuid,                     -- pipeline job spawned
  ingested_at     timestamptz not null default now(),
  primary key (watch_id, drive_file_id, drive_version)
);

create table drive_oauth_credentials (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  google_sub      text not null,            -- Google account id
  refresh_token   bytea not null,           -- ENCRYPTED
  scopes          text not null,
  created_at      timestamptz not null default now(),
  unique (tenant_id, google_sub)
);
```

---

## 4. The poller (worker, every ~60 s per active watch)

```python
def poll_watch(watch):
    # 0. Entitlement: tier must allow auto-ingest (tier comes from the SSO token
    #    persisted on the tenant; clipDriveAutoIngest == false for FREE).
    if not tier_allows_drive_ingest(watch.tenant.tier):
        pause(watch, reason="tier")          # FREE downgrade → stop ingesting
        return

    drive = drive_client(watch.oauth_cred_id)   # refreshes access token
    resp = drive.changes().list(
        pageToken=watch.page_token,
        spaces="drive",
        includeRemoved=True,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        fields="newStartPageToken,nextPageToken,"
               "changes(fileId,removed,file(id,name,parents,mimeType,"
               "size,md5Checksum,version,trashed,videoMediaMetadata))",
    ).execute()

    for change in resp["changes"]:
        f = change.get("file")
        if change.get("removed") or not f: continue
        if f.get("trashed"): continue
        if watch.folder_id not in (f.get("parents") or []): continue   # this folder only
        if not f["mimeType"].startswith("video/"): continue            # videos only
        if too_big(f.get("size")): continue                            # size guard

        # Dedup: (file id + version) — skip re-polls, renames, re-uploads.
        if already_ingested(watch.id, f["id"], f.get("version") or f.get("md5Checksum")):
            continue

        # Token gate: don't drain a busy folder silently.
        bal = chalyb_balance(watch.tenant_id)     # GET .../usage/balance
        if not bal["unlimited"] and bal["remaining"] <= 0:
            notify_out_of_tokens(watch.tenant_id)  # queue or skip; surface upsell
            continue

        job = enqueue_clip_pipeline(               # SAME pipeline as manual upload
            tenant_id=watch.tenant_id, source="drive",
            drive_file_id=f["id"], name=f["name"],
        )
        record_ingested(watch.id, f["id"], version, job.id)

    advance_cursor(watch, resp.get("newStartPageToken"))  # only after success
    touch(watch, last_polled_at=now())
```

Scheduling: a single cron tick (e.g. every 60 s) that fans out `poll_watch` over
all `status='active'` watches, with a per-tenant concurrency cap. Page through
`nextPageToken` when a tick returns a full page.

---

## 5. Robustness checklist (where these break in practice)

- **Idempotency** — the `(watch_id, file_id, version)` PK is the backbone; the
  cursor can replay, so dedup must be authoritative, not best-effort.
- **Quota / 429 / 403 rateLimitExceeded** — exponential backoff + jitter; never
  hot-loop a failing watch.
- **Large VODs** — stream with `alt=media` + resumable/range download; cap file
  size; reject unsupported codecs early.
- **Shared Drives** — pass `supportsAllDrives` + `includeItemsFromAllDrives` and
  store `drive_id`; My-Drive-only code misses team folders (the stated use case).
- **Token refresh / revocation** — handle `invalid_grant` → `error` + reconnect.
- **Partial failure** — per-file retry with a dead-letter; one bad file must not
  block the cursor for the rest.
- **Security** — encrypt refresh tokens; least-privilege scope; verify the OAuth
  callback `state`; never log tokens or file contents.
- **No silent caps** — if you skip files (size, out-of-tokens), record + surface
  it so a user isn't left wondering why a VOD didn't ingest.

---

## 6. Acceptance

- Drop an `.mp4` into the watched folder → a pipeline job appears within ~60 s,
  exactly one per file even across re-polls / renames.
- FREE tenant (or a Pro→Free downgrade) → watch auto-pauses, no ingest.
- Out of tokens → ingest halts with an upsell, no partial/dead jobs.
- Revoked Drive access → watch flips to `error` with a reconnect CTA.
