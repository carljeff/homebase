# Selective Mac Contacts import

## Status and privacy

Deployed with approval on November 4, 2026: Homebase v20 and relay v4. No real address-book access or real contact import was performed by the agent. Existing activity synchronization and scheduling are unchanged. Update the Mac package below before using the new helper.

Only contacts you select and approve are imported. Phone numbers and email addresses are normalized/matched on the Mac and saved only in its existing private mapping configuration. Homebase receives approved display names and UUIDs, plus explicit create/link instructions. The roster sent back to the Mac contains only friend names, UUIDs and messaging opt-in flags. Notes, birthdays, addresses, photos and raw vCard data are never sent. The helper never reads or writes Apple's Contacts or Messages databases, sends a message, or schedules contact imports.

The roster and creation API uses the already paired relay signing key in login Keychain. No additional service, subscription, password, service token or JSON editing is needed. The relay has two fixed routes: `/api/crm/ingest` for activity and `/api/crm/contacts` for the minimal roster and approved friend creation. It cannot proxy arbitrary paths. Device revocation disables both capabilities.

## 1. Export a handful of contacts locally

On the mini through VNC, open Contacts. Select only the people you want (Command-click for individual cards), then File → Export → Export vCard. Save as **Selected.vcf** in Downloads. If export preferences offer notes/photos, leave them out; the helper ignores them regardless. Do not export the whole address book just to import a handful. vCard 3.0 and 4.0 with UTF-8 are supported; older quoted-printable/2.1 cards require re-export. Group cards without usable phone/email handles are omitted. Phone numbers follow the collector's existing normalization: US 10-digit numbers or explicit international `+` numbers; ambiguous short numbers are not guessed.

Protect this exported file (this affects only your export, never a system database):

```sh
/bin/chmod 600 "$HOME/Downloads/Selected.vcf"
```

An iPad-exported vCard transferred privately to the mini can also be used. Never paste the vCard or interactive contact details into chat/GitHub.

## 2. Update the local tools

The ZIP on `feat/selected-contact-import` includes the new contacts.py. Both services are deployed; run:

```sh
/usr/bin/curl --fail --location \
  'https://github.com/carljeff/homebase/raw/refs/heads/feat/selected-contact-import/tools/messages-crm/homebase-messages-crm.zip' \
  -o "$HOME/Downloads/homebase-messages-crm.zip"
/usr/bin/unzip -q -o "$HOME/Downloads/homebase-messages-crm.zip" -d "$HOME/Downloads/homebase-messages-crm"
/usr/bin/python "$HOME/Downloads/homebase-messages-crm/HomebaseMessagesCRM/manage.py" install
```

The installer preserves config, contact mappings, Keychain credentials, pending uploads and any already enabled LaunchAgent. Script updates use atomic file replacement so an existing schedule cannot read a partly copied script. Installation does not enable, disable or reload a job. There is no need to pair again.

## 3. Preview without any network access

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" preview \
  --vcard "$HOME/Downloads/Selected.vcf"
```

This shows local names and matching-handle counts. No configuration or Homebase records are changed, and Keychain/network are not used. Folded UTF-8 lines, escaped names, grouped Apple property names, multiple phone/email fields and tel: URIs are supported. Other fields are ignored. Exact duplicate cards collapse; invalid or unsupported input fails safely. Select at most 25 people per import. The selected export is capped at 20 MB and 200 usable cards.

## 4. Select, match and approve in Termius

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" import \
  --vcard "$HOME/Downloads/Selected.vcf"
```

The helper first retrieves the minimal Homebase friend roster using the existing authenticated relay. It then:

1. Lists the local cards. Enter contact numbers such as `1,3,4`. Enter without numbers cancels.
2. Shows each selected person's local phone/email handles. Choose the numbers you want; Enter keeps all for that selected person.
3. Lists existing Homebase friends. Enter a friend's number to link it, **N** to create a new friend, or **S** to skip. Exact normalized name matches are labelled, but never applied automatically. Same-name new creation needs a second explicit **NEW** confirmation. Existing friends must already have messaging metadata enabled; enable it in Friends first if needed. Existing names, notes, reminders and other settings are not overwritten.
4. Shows a final create/link preview. Type **IMPORT** to approve sending those names/UUIDs and adding the handles to the local mapping. Any other response cancels without writes. New friends explicitly have messaging metadata enabled; existing friends are not silently opted in.

The helper never asks you to type a contact UUID or hand-edit config.json. Multiple phone numbers/emails can map to one friend. A handle already mapped to a different friend is a conflict, so the entire local update stops rather than silently reassigning it. Combine duplicate cards for the same person in Contacts before selecting both in one import, or import one card and link another to the resulting friend in a later run.

## 5. Confirm the result

New friend names appear in Homebase after refresh. Messaging metrics for those friends arrive after the next scheduled collector run. Mapping changes trigger the collector's normal full reconciliation; source messages, metadata sequence, pending retry and scheduling state are not reset. No grocery, meal, family profile or existing friend data is replaced.

If the collector is currently running, the import may report busy; retry when it finishes. If an activity upload is pending, finish that upload before changing mappings. This preserves exact-body retry guarantees. Import uses the same short-lived local lock as the collector. There is no full database scan during contact selection/import itself.

## Network recovery and cancellation

Before writing to Homebase, the helper saves `contacts-import.pending.json` in the private collector directory. It contains the selected names, normalized handles, stable target IDs and original config fingerprint, with mode 600. Retrying uses those same IDs, so a lost response cannot create duplicate friends.

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" resume
```

Type IMPORT to retry the already reviewed names. The complete server receipt must match the selection before mappings change. A configuration edit, conflicting handle, disabled source, changed friend name, opt-out or unexpected receipt stops safely. Remote names may already have been created if the network failed after the server commit; the existing mapping remains unchanged until a verified receipt is obtained. This is why the plan should be resumed rather than recreated.

To archive a stuck plan without deleting any mappings or Homebase friends:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" cancel
```

Type CANCEL. The plan is retained privately as `contacts-cancelled-<selection-id>.json`. Any names already created in Homebase remain and can be linked on a later import.

## Mapping backup and rollback

Immediately before changing config, the helper writes `contacts-backup-<selection-id>.json`, mode 600, beside config.json. The configuration update is atomic and preserves device ID, endpoint, reconciliation settings and all unrelated mappings. Interrupted local application can be safely resumed.

List backups without opening their private contents:

```sh
/bin/ls -t "$HOME/Library/Application Support/HomebaseMessagesCRM"/contacts-backup-*.json
```

Restore the intended backup using its exact path:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" restore \
  --backup "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts-backup-SELECTION-ID.json"
```

This requires RESTORE confirmation, creates a safety backup, and rejects different device/endpoint pairings or pending metadata/contact operations. It changes local mappings only. It never deletes friends, resets uploaded metrics/cursors, disables scheduling, or touches Messages/Contacts. A later normal synchronization reconciles restored mappings. Use the existing Friends interface for any desired removal of mistakenly created friend records after review.

Private vCards, pending/completed/cancelled plans and mapping backups remain local until deliberately removed. They contain contact identifiers; do not upload them. Keep what you need for recovery, then remove those private files using your normal local file management. Source rollback restores the prior application and relay versions; avoid changing runtime keys or database schemas. This feature requires no new database migration.

## Validation and remaining limits

Automated tests use synthetic contacts only. They cover local parsing/privacy, explicit selection and cancellation, existing matching, handle conflicts, atomic backup/restore, pending-upload protection, saved-plan resume, names-only protocol serialization, signed relay-to-Homebase creation, idempotence, revocation, invalid proofs, payload limits, and unchanged existing records/cursors. Real High Sierra vCard export/selection and an actual contact import still require user validation after deployment approval. Python compatibility is checked with legacy syntax parsing, not a real 2.7 runtime in the development environment.

References: Apple's selected-contact export guidance at https://support.apple.com/guide/contacts/adrbdcfd32e6/mac and vCard format specification at https://www.rfc-editor.org/rfc/rfc6350.html .
