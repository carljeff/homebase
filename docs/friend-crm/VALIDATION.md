# Owner-only Friends publication — November 4, 2026

Homebase v21 deployed successfully with the new additive policy table and runtime configuration revision 3. The owner's authenticated Homebase connector retained its existing Friends access and exact record contents after publication, confirming enrollment and preservation. No private names, notes or IDs were printed or committed. Runtime mailbox and credentials are server-side only. Custom household access remains unchanged. Real other-account login and postdeployment scheduled-upload observations are not represented as completed checks; the denial paths, owner retries and data/cursor preservation are covered by synthetic automated tests. No Mac update is required.

# Owner-only Friends — November 4, 2026

Development validation: 111 application tests passed, including owner/other-account store, API, MCP, signed ingestion/contact routes, takeover prevention, actual Page capability and desktop/mobile navigation. TypeScript, focused lint and the existing 33 Python tests passed. Production build is run as part of publication. Shared household regressions remain covered. Existing complete-repository lint issues are unchanged and outside scope.

The rollout uses an additive policy table and a protected owner-email runtime setting, with stable visitor-ID enrollment from platform-authenticated identity. It does not modify legacy Friends records, source snapshots, keys, mapping files or sequence counters. A predeployment authenticated connector check recorded the existing Friends records in session memory for exact preservation comparison after publication; no names/notes/identifiers were printed or saved to source. No real second-account login is used; negative checks use synthetic authenticated identities.

# Local message-contact discovery — November 4, 2026

Passed: 33 Python tests and 106 application tests. Nine new discovery tests cover bounded read-only metadata windows, byte-identical synthetic source preservation, direct/group separation, shared-handle ambiguity, deduplication and multi-handle counts, existing mappings/new observed handles, future reruns, larger local address books, offline CLI behavior and names-only import requests. All Mac scripts passed legacy Python grammar and ASCII-source checks; actual Python 2.7/High Sierra discovery remains to be validated by the user.

No web/server/relay code or deployment is changed by this update. No real source database, Contacts export or identifiers were accessed. No mappings, cursors, Keychain entries or scheduled jobs were changed by the agent. Discovery defaults to local-only and never selects message text or attachments. Its bounded window uses newest recorded ROWIDs, not a guarantee of chronological send order when historical messages sync later. The ZIP still includes only six reviewed source/example files, with no private data.

# Contact import publication — November 4, 2026

Homebase v20 and relay v4 deployed successfully after explicit approval. The deployment checkout passed TypeScript, its application test suite and a fresh production build; relay tests (6) and artifact validation passed. Homebase retained custom household access and the relay retained its approved public audience. Existing runtime secret revisions stayed at 2 (Homebase) and 1 (relay); no migration or credential/schedule change was needed. No real contact import was executed by the agent. The updated Mac installer and first selected vCard preview/import still need the user's run.

# Selected contact import — November 4, 2026

Executed on the development checkout: 106 application tests, 24 Python collector/contact-helper/installer tests, and 6 standalone relay tests passed. TypeScript and focused lint passed; Homebase production build and relay artifact validation completed successfully. New tests include actual Python names-only request serialization/signatures through relay and private Homebase, stable IDs/retries, minimal roster fields, existing record/cursor preservation, opt-out/revocation/collision/privacy rejection, vCard folding/Unicode/multiple handles, preview/cancellation, backup/restore and outage resume. Existing pre-task lint issues remain outside scope.

No real address book, contact export, personal identifiers or credentials were accessed or committed. No real contact names were created. This feature has not been deployed to production, and no running Mac job, synchronization cursor or permission setting was changed. Real High Sierra helper execution and selective import are still pending user validation. New code uses only Python standard library and existing app dependencies. The update requires coordinated Homebase and relay publication, but no schema migration, Keychain update or new service.

# High Sierra upload handoff fix — November 4, 2026

Relay diagnostics confirmed BODY_BYTES_CHANGED on the real Mac upload. This established a body transport mismatch, rather than evidence that re-pairing would help. Collector replaces /dev/fd with a closed named temporary metadata file, created mode 600 in the private configuration directory; curl opens the path normally and no descriptors are inherited. Credentials remain only in memory and curl config stdin. Finally cleanup removes the file on ordinary success/failure; an abrupt process kill or power loss can leave a mode-600 upload-*.json in the private collector directory. The existing pending retry remains untouched. No source Messages writes or key/config changes are introduced.

Validation: 16 Python tests and 103 application tests passed, including a real-curl synthetic loopback test for exact body bytes/HMAC and temporary-file mode/cleanup tests on successful and failed HTTP attempts. Actual High Sierra retry remains required; scheduling is disabled. No successful real relay upload has been observed yet.

# Upload diagnostics update — November 4, 2026

Real Mac pairing succeeded after unlocking login Keychain. Relay logs identify subsequent uploads as SIGNATURE_MISMATCH; clock validation passes. Cause is not yet established. Executed checks: 103 application tests, 14 Python tests, and 5 standalone relay tests passed. A synthetic actual-curl loopback test on Linux confirmed exact body bytes and HMAC preservation, but does not establish High Sierra descriptor behavior.

Collector now sends a body digest and one-way device-key tag; the relay compares these without logging or returning either value. Fixed rejection codes distinguish BODY_BYTES_CHANGED from DEVICE_KEY_MISMATCH. Full HMAC authentication remains mandatory and unchanged. Optional diagnostic headers are backwards compatible. Keys, payloads, contacts and exception details are never printed. Keychain-read failures and curl exit statuses now have safe actionable messages. No successful real relay upload has been observed, and scheduling stays disabled.

# Authenticated relay update — November 4, 2026

Local tests: 88 application tests (including synthetic Python collector → relay → private ingestion, repeat acknowledgement, owner authorization, mode switches and revocation), 14 Python collector/installer tests, and 4 standalone relay security/rate-limit tests. TypeScript and focused lint passed. Production builds are executed by publication. Prior full-repository lint issues remain unchanged.

No real Mac pairing/upload or scheduled job has been performed by the agent. Real manual upload, subsequent retry, login Keychain/TLS behavior, and scheduling/reboot/CPU/SSH/VNC/SMS checks remain pending. Synthetic live probes use a random unregistered device and must be rejected without writing Homebase contacts or snapshots. Relay rate counters can record that synthetic UUID; no real contact data is used.

The new Site's public audience is explicitly approved; Homebase's household audience is unchanged. Only server-side runtime secrets hold the platform credential and relay master. No credentials or real contact records are in code or the installer ZIP. Relay stores only fixed per-device rate counters. Platform access-token lifecycle is a maintenance dependency and not proven permanent.

# Manual import update — November 4, 2026

Executed on the deployment checkout: 86 application tests passed; 12 Python collector/installer tests passed; TypeScript and focused lint passed. Production build is recorded by the publishing workflow. Tests cover strict preview/schema filtering, confirmation, duplicate imports, owner boundaries, contact opt-in, old snapshots, revoked devices, additive replacement, signed/manual source separation, export permissions, no-network export and unchanged synthetic Messages source.

The user successfully ran the previous local collector on High Sierra: 1,032 messages, all nanosecond Apple timestamps, zero invalid dates, one matched friend. This validates the prior local read path only; the new export and real signed-in upload still require the user's run. Database mode 0666 was confirmed, but no permissions were modified. The real excluded/ambiguous classifications still need review. No actual private export or real import was generated by the agent. Automatic synchronization remains disabled and unavailable through a supported Mac hosting credential flow. No new services were introduced.

# Validation — November 4, 2026

## Executed in the development workspace

- `npm test`: 98 passed, 0 failed (including existing Homebase tests, signed ingestion, replay/duplicate/sequence handling, privacy schema, collector-to-server contract and direct/group UI).
- `python3 -m unittest discover -s tests/messages-crm -v`: 11 passed. Synthetic SQLite fixtures cover direct/group, multiple handles, unlinked and duplicate messages, timestamp scales, read-only access, incremental overlap/deletions, retry recovery, privacy and disabled installation.
- `npm run typecheck`: passed.
- Focused ESLint on new CRM application code and JavaScript tests: passed.
- Production build using Sites build helper: passed. Build emits a dependency direct-eval warning.
- Repository-wide lint: 134 errors and 14 warnings in existing code; not a clean repository-wide lint result. Unrelated cleanup is outside this change.
- Collector and installer accepted by legacy Python grammar parser. This is a syntax check, not execution on Python 2.7 or High Sierra.
- Installer ZIP includes only collector.py, manage.py, config.example.json, README.md and diagnostics.sql; no credentials, private mappings, cache or message data.

## Not performed / approval gates

No production deployment, database migration, runtime secret provisioning, personal account connection, real Messages database access, live upload or launchd activation was performed. No real contacts were committed. No Mac permissions were changed.

The known 989-message baseline and historical mode 666 remain user-provided findings, not independently reverified results. Real High Sierra Python/SQLite/Keychain/curl behavior, source timestamp/schema diagnosis, authenticated hosted-service access, household sharing, real browser/mobile usability, CPU/I/O responsiveness and reboot persistence still require validation. Automated UI checks are synthetic DOM tests, not a live browser session.

The app is ready for review and a controlled deployment decision; the end-to-end integration is not yet certified ready for unattended operation. Follow MAC_SETUP.md in order: local-only diagnostics/dry run, then separately approved application deployment and one manual upload, then separately approved automation/reboot validation.

## Publication checks

Homebase v19 and relay v1 published successfully. Relay hosting logs show GET / returning 200. Programmatic health and signed synthetic probes from the authoring workspace received HTTP 403 (public response `error code: 1010`); no matching POST reached relay invocation logs. Therefore a real public-network relay upload is **not yet verified**. Test public health from the Mac before pairing; do not activate scheduling until the real manual upload succeeds. No alternate network path, fingerprint workaround or security relaxation was attempted.

An additional isolated installer check mocked launchctl and verified the approved/manual-success activation path creates only the intended integration marker/plist. No real launchd job was installed. Both Mac scripts passed legacy Python grammar parsing, which does not replace actual High Sierra Keychain/TLS/reboot testing.
