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
