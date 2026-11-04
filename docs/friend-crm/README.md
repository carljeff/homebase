# Local message/contact discovery

The Mac helper can now discover review candidates from the newest locally recorded message metadata and a local address-book export, then reuse selective names-only import. See MESSAGE_DISCOVERY.md. This needs only the updated Mac package; no Homebase/relay deployment, credentials or scheduling changes are required. No automatic friend importing is introduced.

# Selected contact import update (deployed)

The focused branch feat/selected-contact-import adds a local selective vCard helper plus a minimal signed names/IDs route. See CONTACT_IMPORT.md. It reuses the existing paired relay, keeps phone/email fields local, preserves existing friend records/settings, and does not change the running activity schedule. Homebase v20 and relay v4 were deployed with approval on November 4, 2026. Real selected-contact validation on the Mac is next. No database migration or new credential/service is required.

# Latest: authenticated upload relay

An explicitly approved separate public Site now serves a single signed metadata intake route. Its source is tools/messages-crm/relay. The platform access token stays in that relay's runtime secret store and is forwarded only to the fixed private Homebase ingestion endpoint. Homebase's audience is preserved. Per-device relay keys are derived from a separate shared server-only master and issued only to the signed-in source owner. See MAC_SETUP.md first. Historical manual-only limitations below are superseded by the relay; automatic scheduling still requires a real successful manual relay upload and explicit activation.

# Current status: manual import supported

The supported hosted workflow is now Mac collector `export` → signed-in Friends file preview → explicit metadata import. It needs no Mac credentials or platform bypass token. The platform does not expose a supported Mac pairing credential flow; direct unattended syncing remains unavailable and disabled. See MAC_SETUP.md first. Existing architectural notes below describe the legacy signed endpoint, not a working unattended hosting setup.

# Friend CRM Messages integration — implementation and validation

Status: prepared for review. **Not deployed; no real Mac database read, credential provisioning, live synchronization or launchd activation was performed.** The real-data and reboot portions of the definition of done remain pending user approval and device validation.

## Source audit

GitHub `main` is a README placeholder. The actual application is on the feature branches through `feat/child-growth-history` (GitHub head `fefe1303d1c5b0a443ec97216ad3367a343fabcb`); this focused work branches from that source. Read-only inspection of the separate Sites repository confirmed deployed source `3520f0ed17fdc4a3467b9910c094e63e0c7d0889`, Site version 15, matches the application code used here. No deployment repository push was made.

Homebase is a React/Vinext app on Cloudflare Workers with shared D1 records and private Sites access. `/api/homebase` uses platform identity headers, same-origin POST validation, Zod schemas and optimistic record versions; family profiles and wishlists already exist. Friends was a placeholder, not an implemented CRM. No collector ingestion endpoint or machine credential system existed. This implementation reuses record storage, authentication and design patterns, adds `friend` records, and introduces one isolated `crm_devices` table via the generated Drizzle migration `0003_friend_crm_devices.sql`. Existing records, profiles, meals, recipes, groceries and wishlists are retained.

## Architecture and privacy

High Sierra Messages → read-only SQLite CLI → Python local metadata cache/matching → daily aggregates → signed HTTPS ingestion → Friends dashboard.

- Python is written in Python 2.7-compatible syntax for High Sierra's built-in `/usr/bin/python`; no pip or third-party runtime dependencies. Only the local cache uses Python SQLite. Source reads go through `/usr/bin/sqlite3` with the known working URI `mode=ro`, `PRAGMA query_only=ON`, short busy timeouts and bounded retries. No immutable/nolock flags are used against the changing WAL database.
- SELECTs allowlist message row ID, numeric date, direction, handle ID, optional item/reaction type, optional GUID (hashed locally for deduplication), and chat/participant joins. The collector never SELECTs bodies, attributed content, previews, payload data or attachments and never sends messages.
- Local config maps multiple normalized phone/email handles to a CRM contact UUID. US 10-digit numbers normalize to +1; explicit international E.164 numbers and lowercase emails are supported. Shortcodes/ambiguous numbers are not guessed. Conflicting handle assignments fail. Raw handles remain in a user-owned 0600 file inside a 0700 directory; none enter Homebase payloads.
- Cloud payloads contain contact UUIDs, separate direct/group lifetime counts and last timestamps, at most 181 UTC daily buckets, and numerical quality/coverage metadata. No handle IDs, raw handles, message GUIDs/row IDs, conversation IDs, content, attachment facts, device usernames or database paths are uploaded. One snapshot replaces the prior snapshot; unbounded event history is not accumulated.
- Daily buckets include today plus 180 days; window counts use UTC calendar days, clearly labelled. All-observed totals and dates reflect this Mac's synchronized history, not a complete phone history. Group incoming is attributed only to its mapped sender; group outgoing counts participation in shared groups for mapped participants, not personal outreach. Direct outgoing is an outreach proxy, not inferred thread initiation. Counts are not relationship-quality scores.
- Unknown/unlinked messages, multiple-chat associations, mismatched participants, invalid timestamps, unsupported/system/reaction rows and unmatched handles are excluded and counted. Missing association schemas degrade to excluded/unlinked metadata with a partial flag. The known 42 unlinked messages are **not** assumed to be direct messages.
- Contact tracking is opt-in. Server ingestion rejects UUIDs that are not enabled Friend contacts. Disable tracking to hide metrics and remove its mapping from the Mac. Revoking the collector clears its server snapshot. Until replacement/revocation, the previous aggregate snapshot remains stored; this is not a zero-retention system. Metadata is access-controlled, not end-to-end encrypted.

## Ingestion security

Private Sites imposes a platform gate. Machine requests send the Site's service-access credential only to this Site in `OAI-Sites-Authorization`, plus a separate device-scoped HMAC signature. Do not make Homebase public to bypass this gate. Gateway/service access is supported by the Sites integration but must be verified with a real manual request after deployment. It supplies no browser identity; ingestion authenticates independently and exposes no household read/write capability.

A 64-character cryptographically random `CRM_INGEST_MASTER_KEY` is a **server runtime secret**, provisioned only after approval. Device signing keys derive from that secret and device UUID; D1 stores no key. Signed-in users create/revoke only their own device credentials through same-origin POST. One enabled device per user avoids accidental double-source counting; the UI keeps different users' sources separate. Device keys are returned during setup only, never included in status or generic records. The Mac stores both signing and platform credentials in its login Keychain. Setup uses `security -i` via stdin; retrieval uses `security find-generic-password`; credentials never appear in shell arguments, configuration, Git, launchd plist, request logs or collector output. Do not grant Keychain access to all applications or weaken Keychain security to enable scheduling.

Each POST signs `POST\n/api/crm/ingest\n<Unix seconds>\n<SHA256 of exact body>` with HMAC-SHA256. The server checks device state, timestamp ±5 minutes, signature, strict recursive payload schema, HTTPS path, contact opt-in and a 1 MB limit. Strict fields reject content/attachment/handle additions. Sequence must advance by exactly one; matching sequence+digest is acknowledged idempotently without applying again. A changed replay, old sequence or concurrent lost update is rejected. One D1 compare-and-swap updates sequence, digest, snapshot and server receipt time atomically.

The collector persists the exact pending snapshot and cursor transactionally before transmission, retries that same body before any new collection, and re-signs it with a fresh request timestamp. HTTPS verifies certificates, rejects redirects and pins the known Homebase endpoint; it does not disable SSL verification. Curl is used so the old Python TLS stack need not connect to modern TLS endpoints. Secrets travel in curl config stdin, metadata in an unlinked private temporary descriptor. Clock accuracy and working High Sierra TLS trust roots remain real-device prerequisites.

## Incremental behavior and limitations

Initial collection and daily full reconciliation read metadata in 500-row pages, capped at 50,000 rows per run. Exceeding the cap aborts without uploading; adjust only after measuring device performance. Regular runs revisit at most 100 recent row IDs plus new messages. A source-path/mapping change or lowered high-water row ID forces full reconciliation. Recent deletions/edits are reconciled within the overlap; older edits/deletions on the next full scan. Duplicate chat joins are deduplicated; duplicate GUIDs count once when GUID exists, with ROWID fallback otherwise. Contacts with multiple matching handles merge by contact UUID. The local cache contains only pseudonymous metadata and a resumable pending aggregate; retained source metadata supports lifetime counts and daily reconciliation. No raw handles/content/attachments are cached.

A local exclusive lock prevents overlapping collectors. Cache files reject symlinks, unknown cache identities and source hardlinks. Read failures, storage or network interruptions do not advance acknowledgement sequence or discard pending retries. No raw exception, SQL, payload, handle, credential or subprocess stderr is logged.

If a pending payload references a contact that was disabled before the payload was accepted, ingestion rejects it. Do not manually reset counters or edit pending JSON. Revoke/re-enroll after review and archive the local cache; a newly registered device can start at sequence 1. If a response was lost after acceptance, the unchanged retry safely receives a duplicate acknowledgement. Resetting a cache without registering a new device causes a sequence conflict instead of silently replacing server history.

## Deployment review gates

1. Review source/PR, migration, privacy and local diagnostics; approve production deployment separately.
2. After approval, apply the generated migration using the existing Sites/D1 workflow, configure a random runtime signing master, deploy the code preserving current access, and verify the service-access gate. Do not configure these secrets or run migrations against production during review.
3. Create opted-in Friend contacts and a collector credential, then map **one** friend locally. Provision both credentials into the Mac Keychain through the prompt. Validate a manual sync and compare the Friends metrics/health with local counts.
4. Only after explicit further approval, enable the prepared per-user LaunchAgent. Validate login Keychain access, post-reboot acknowledgements and continued Messages/SSH/VNC operation.

See [MAC_SETUP.md](MAC_SETUP.md) for exact Termius commands and permission review, [VALIDATION.md](VALIDATION.md) for actual results and remaining verification.

Primary references consulted: SQLite URI read-only behavior https://www.sqlite.org/uri.html ; Apple launchd manual https://github.com/apple-oss-distributions/launchd/blob/main/man/launchd.plist.5 . The Sites identity/service-access skill establishes the platform header contract. Actual High Sierra SQLite, Keychain, curl and launchd behavior must still be tested on the Mac; Python 3 synthetic tests are not proof of a Python 2.7 production run.
