# New people from outbound messages

Homebase Friends now has a collapsed **New people from messages** inbox. It proposes names from the Mini's Contacts whom you sent a **direct outgoing** message to in the last 90 days, among the newest 10,000 recorded messages. Incoming-only senders (including most spam), group-only participants, reactions, invalid timestamps, ambiguous/shared handles and unlinked chats cannot qualify. People without a usable local Contacts name are omitted. A person qualifies because you sent a message, not because their relationship is important; unsolicited conversations you replied to can still appear. Ignore them permanently for that exact local identity.

Nothing imports automatically. Choose **Add & track messaging**, **Link & enable messaging**, or **Ignore** in Homebase. Matching normalized names default to linking an existing friend; duplicate names need explicit confirmation to create a separate person. Linking preserves birthday, partner, relationship memory and notes. Messaging tracking must be explicitly approved. New phone/email mappings are applied only by the Mini after approval. Approved names remain marked waiting until its acknowledgement arrives. Refresh reloads Homebase's queue; it cannot remotely read or run software on your Mac.

## One-time update (Termius on the Mini)

Use the exact download commit from the release handoff (replace COMMIT_SHA below). Do not re-pair, revoke your collector, edit device UUIDs or replace config.json. Installation preserves current mappings, cached activity, Keychain credentials and the existing activity schedule. Downloading/installing adds the disabled review helper, not another launch agent.

```sh
umask 077
mkdir -p "$HOME/Downloads/homebase-contact-review"
cd "$HOME/Downloads/homebase-contact-review"
/usr/bin/curl --fail --location --connect-timeout 15 --max-time 120 \
  'https://raw.githubusercontent.com/carljeff/homebase/COMMIT_SHA/tools/messages-crm/homebase-messages-crm.zip' \
  -o homebase-messages-crm.zip
/usr/bin/unzip -o homebase-messages-crm.zip
/usr/bin/python manage.py install
```

First, a local-only dry run. It prints counts, never names, phone/email identifiers or message content, and uses no network or credentials:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" dry-run --source contacts
```

The Contacts scripting dictionary reads names and phone/email values locally, without activating or changing Contacts. This path is mocked in Linux tests and **must be validated on High Sierra**. If macOS prompts, authorize the local read on the Mini via VNC. If it cannot read Contacts, export contacts as vCards and use the fallback below. An .abbu archive is not a vCard.

When the counts make sense, explicitly publish candidate **names**, pseudonymous IDs, direct-outgoing counts and last-outgoing timestamps through the existing authenticated HTTPS relay:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" sync --source contacts --confirm-manual-sync
```

Open Homebase → Friends → New people from messages. Review a small test person first, link or add, then run the same command again. It applies approved mappings locally and sends an immediate acknowledgement (safe retry if the response is lost). It makes a private config backup before changing mappings. No handles are uploaded.

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" sync --confirm-manual-sync
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" sync --confirm-manual-sync --reconcile
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" health
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" health
```

Confirm the person appears once, pending approval disappears, and activity matches expectations. Do not paste config, names, handles, signing keys, Contacts output or private cache into chat. Counts-only health output is safe to share.

### vCard fallback

Use a local Contacts export, not Contacts Archive (.abbu): select contacts in Contacts → File → Export → Export vCard. Store it locally, for example ~/Downloads/AllContacts.vcf. Native Contacts is preferable for future automatic updates; a vCard snapshot must be re-exported to include changed/new contact information.

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" dry-run --source vcard --vcard "$HOME/Downloads/AllContacts.vcf"
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" sync --source vcard --vcard "$HOME/Downloads/AllContacts.vcf" --confirm-manual-sync
```

## Enable only after successful manual validation and approval

This is a separate opt-in from the already approved activity collector. No new launch agent is added. The existing 15-minute activity job checks review at most once every 30 minutes, after activity has succeeded and released its lock. A review failure leaves acknowledged activity intact. Up to 48 review checks/day plus 48 approval acknowledgements/day and 96 activity uploads/day stay below the relay's 200/day quota; manual traffic shares the quota. Network failures are throttled too.

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" enable --approve-automation
```

Afterward, normal use is entirely Homebase review: new direct-outgoing people appear on the next review check, approvals apply within the next review check, and activity follows on a subsequent activity sync. The web interface cannot force a remote Mini refresh. No message is sent by this integration. Verify review/activity health again after 30–45 minutes and a reboot; real reboot, Contacts permissions and Keychain availability cannot be verified from this development environment.

## Disable, rollback and troubleshooting

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/review.py" disable
```

Disabling review does not stop activity synchronization or delete approved friends. To undo an approved mapping, first disable review and activity using manage.py disable, verify no pending upload, then restore the specific private contacts-backup-*.json saved before that mapping. Reconcile manually before enabling activity again. Existing friend records are not automatically deleted. To delete a friend use the existing Homebase edit workflow; do not reimport or reset the database.

If Keychain is locked, unlock the login Keychain locally; do not re-pair:

```sh
/usr/bin/security unlock-keychain "$HOME/Library/Keychains/login.keychain-db"
```

For failed uploads, preserve review state and rerun manual sync; persisted acknowledgements/journals survive network failures and crashes. Finish any older contacts-import.pending.json review before starting the inbox helper. Ignored IDs do not resurface; changing a Contacts name or handles deliberately makes a new identity requiring fresh review. Existing mappings cannot be reassigned by a changed approval. If a name stays waiting, check the local Contacts card still exists and matches, and that the friend still permits messaging tracking.

## Privacy, compatibility and limitations

- Messages stays URI read-only/query-only. Queries explicitly select metadata; no text, attributed bodies, previews, attachment metadata or private Contacts notes are read.
- Phone/email identifiers remain in private mode-600 local config/review cache under the existing mode-700 directory. HMAC IDs use the existing Keychain device key and a separate domain. No new secrets or services.
- Only the Friends owner may view/approve; the other adult's/shared Homebase features remain unchanged. The signed relay validates exact allowlisted fields. Approval uses version checks and transactional writes; transport replay cannot create duplicate friends.
- Migration 0006 only adds two review tables. No existing records, relationships, metrics or cursors are rewritten. Revoking the device purges its candidate queue.
- Ignored/applied names are erased server-side; opaque IDs remain to prevent rediscovery. Pending/approved names are retained until decision/acknowledgement/revocation. Limits: 50 proposals/request, 100 visible queue rows, 500 remembered candidate identities/device, 200 friends overall. This is an initial small-household workflow, not bulk contact synchronization.
- Scans are bounded to the newest 10,000 rows; unchanged Messages/Contacts/mappings reuse a cache, with a bounded daily rebuild for deletions and changed associations. Matching multiple handles reuses the established normalization and ambiguity checks.
- No live Contacts/Messages/cart data or production contact writes are part of automated tests. The native High Sierra scripting path and unattended/reboot behavior need the real Mini validation above.

## Validation

156 application tests, 44 Python tests and 7 standalone relay tests passed during implementation. Includes inbox approval/link/ignore, owner privacy and CSRF, strict fields, HMAC authentication/retries, duplicate/stale approval, preserved birthday/partner/notes, local-only dry run, source byte integrity, outgoing-only/group exclusion, daily cache rebuilding, atomic mapping recovery after a lost acknowledgement, and unchanged existing messaging tests. TypeScript, focused new-module lint and production build are recorded in the PR/release handoff. Browser visual QA is unavailable in this environment; rendered React interactions are tested with synthetic data.
