# Discover friends from locally synced Messages

This extends the existing selective contact importer. It needs only an updated Mac package; Homebase v20 and relay v4 already provide the required names-only import endpoint. No server deployment, new credential, account connection or schedule change is required. No real address book or Messages data was accessed during development.

## What is read and what leaves the Mac

The helper reads an exported vCard locally and the Messages metadata allowlist through the existing SQLite `mode=ro` URI. It never selects bodies, previews, attachments or message text. It matches normalized phone/email handles locally to contact names, then shows a review list with direct incoming/outgoing counts, separate group counts and last activity in UTC. This is an explicit manual discovery operation, not part of the 15-minute scheduled job.

`discover` is fully local: no Keychain access, network requests, configuration writes, collector cache changes or cloud export. `discover-import` reuses the existing explicit person/handle selection, existing-friend match, IMPORT confirmation, private backup, safe pending-plan retry and atomic mapping update. Only approved names/UUIDs and create/link instructions go to Homebase; the activity shown in the discovery preview is not included in that request. Subsequent normal scheduled activity synchronization continues to send its already approved aggregates.

Default scope: the newest **10,000 locally recorded message rows by ROWID**, using a bounded indexed descending query. It uses whichever rows exist if fewer are available. This is recording/synchronization order, not guaranteed chronological send order: older messages synced later can have higher ROWIDs. Displayed last-contact dates use validated Apple timestamps. `--limit` accepts 1–50,000. Discovery is a bounded fresh read each time; normal scheduled incremental collection is unchanged.

Direct conversations are shown first, sorted by direct message count and last activity. Group counts remain separate. Group-only people are omitted unless `--include-groups` is requested. Outgoing group activity is attributed to participants and is not considered direct outreach. Message counts do not establish relationship quality.

## 1. Make a local address-book export

On the mini via VNC, open Contacts. Select the address-book cards to use for matching (all cards can be used for this **local lookup**), then File → Export → Export vCard. Save as **AllContacts.vcf** in Downloads. Disable exported photos and notes where available to keep the file small. The full address book is never uploaded; choosing it only makes local name lookup more complete.

Supported: UTF-8 vCard 3.0/4.0, at most 20 MB and 10,000 usable cards. Folded UTF-8 lines and common phone/email forms are supported. Duplicate identical cards collapse. Cards without a valid display name or phone/email handle are omitted from discovery. Re-export older 2.1/quoted-printable text cards as UTF-8 v3/v4. The user controls this export; the helper does not read the Contacts database or change it.

```sh
/bin/chmod 600 "$HOME/Downloads/AllContacts.vcf"
```

Do not transfer AllContacts.vcf to Homebase, chat, GitHub or another service. Local preview and selection screens contain private names/details; report only success/errors, not the contact list.

## 2. Update the Mac tools

Use the new package on `feat/message-contact-discovery`:

```sh
/usr/bin/curl --fail --location \
  'https://github.com/carljeff/homebase/raw/refs/heads/feat/message-contact-discovery/tools/messages-crm/homebase-messages-crm.zip' \
  -o "$HOME/Downloads/homebase-messages-crm.zip"
/usr/bin/unzip -q -o "$HOME/Downloads/homebase-messages-crm.zip" -d "$HOME/Downloads/homebase-messages-crm"
/usr/bin/python "$HOME/Downloads/homebase-messages-crm/HomebaseMessagesCRM/manage.py" install
```

The existing installer replaces scripts atomically and preserves configuration, mappings, Keychain credentials, current sequence, pending retries and the already enabled LaunchAgent. No re-pairing or re-enabling is needed.

## 3. Run discovery locally first

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" discover \
  --vcard "$HOME/Downloads/AllContacts.vcf" --limit 10000
```

It reports scanned rows, unique-message exclusions, eligible unlinked/ambiguous records, unmatched handles, ambiguous address-book handles, already mapped people and review candidates. These are distinct categories/units, not totals to add together. `eligibleUnlinked` follows the collector's content-independent eligibility filtering; it is not the total number of database rows missing a chat association. Unmatched handles include identifiers without a usable unambiguous name in the local export; they are counted, not printed or uploaded. No guessed names are created for them.

A phone/email handle appearing on multiple different address-book cards is ambiguous and excluded from proposals. Existing conflicting mappings also block proposing that person. Do not guess which person owns a shared number. Full historical data beyond the chosen row window is not included in these preview counts; normal Homebase metrics continue using the collector's existing full/incremental history.

## 4. Select people to import

After reviewing the local results:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" discover-import \
  --vcard "$HOME/Downloads/AllContacts.vcf" --limit 10000
```

The same discovery is rerun, then the existing menu lets you select up to 25 people, choose their local handles and link/create friends. All unique nonshared handles on a selected card are offered, including handles not observed in this window; approve only those you want for future matching. Nothing is created until IMPORT is typed. Existing notes, reminders and settings are preserved. See CONTACT_IMPORT.md for pending-plan resume, cancellation, backup/restore and recovery.

People whose observed handles are already mapped are skipped by default. If a person already has a mapping and an additional observed handle is discovered, they are offered for review but must be linked to the same existing Homebase friend; creating a duplicate or assigning them to a different friend is blocked. Multiple phone/email handles for one person are combined, and multiple handles in a group count only once per person/message. No identifiers are silently reassigned.

## Repeat in the future

Keep the local vCard or export a refreshed copy when your Contacts change. Rerun the same discovery command after more messages sync to the mini. New people appear for review; existing mappings remain. After selecting and importing, the 15-minute job reconciles the new mappings and updates activity normally.

Optional review flags:

```sh
# Also offer people seen only in group conversations.
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" discover --vcard "$HOME/Downloads/AllContacts.vcf" --include-groups

# Revisit people already mapped, for deliberate local-handle maintenance.
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/contacts.py" discover --vcard "$HOME/Downloads/AllContacts.vcf" --include-mapped
```

The flags also work with discover-import. Additional senders are never automatically imported by scheduled sync. A local mapping whose Homebase friend has been deleted/disabled needs deliberate review in the existing management workflow; discovery never recreates/reassigns it automatically. Address-book aliases/shared handles may require correcting or combining local cards. There is no automatic fuzzy person-name merge.

## Validation and rollback

Development checks passed: 33 Python tests and 106 application tests, including metadata-only reads/source integrity, bounded windows with ROWID gaps, direct/group separation, GUID deduplication, multi-handle aggregation, already-mapped filtering, new observed handles, shared-number ambiguity, larger local address books, future reruns, an offline discovery command and names-only guided import. All Mac scripts pass legacy Python grammar and ASCII-source checks. Real High Sierra discovery against the user's export/database is still pending; tests use synthetic records only.

Rollback is to the prior installer package. Existing configurations remain compatible, and simply stopping manual discovery changes no activity sync behavior. No new stored discovery index or database migration is introduced. Existing contact-import plans/backups retain their same format; never reset the live collector cursor or revoke keys simply to rerun discovery. Delete the private local vCard when no longer needed; discovery itself writes no copy of the address book.
