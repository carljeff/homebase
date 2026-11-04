# Discover friends from recent Messages metadata

New commands: `contacts.py discover --vcard ~/Downloads/AllContacts.vcf --limit 10000` (local-only preview), then `contacts.py discover-import` with the same options to choose people and approve names-only imports. The local Contacts export matches message participants to names; phone/email fields stay on the Mac. Known mappings are skipped by default, new observed handles are offered for review, groups remain separate and shared handles are never guessed. Rerun later as more messages sync. Existing pairing and scheduling are unchanged.

Update and ordered instructions:
https://github.com/carljeff/homebase/blob/feat/message-contact-discovery/docs/friend-crm/MESSAGE_DISCOVERY.md

# Selected contact import

New local helper: `contacts.py preview --vcard ~/Downloads/Selected.vcf`, then `contacts.py import --vcard ~/Downloads/Selected.vcf`. Export only the chosen people from Mac Contacts. Select people and handles in Termius, link an existing friend or create a new approved name, and type IMPORT to confirm. Phone/email mappings stay local; only approved names/UUIDs cross the authenticated relay. No UUID typing or JSON editing is needed. Requires the selected-contact Homebase/relay update to be deployed first; existing pairing and scheduling are preserved.

Private backup, outage resume, cancellation, rollback, supported vCards and exact instructions:
https://github.com/carljeff/homebase/blob/feat/selected-contact-import/docs/friend-crm/CONTACT_IMPORT.md

# Homebase Messages collector

Update with `manage.py install` (preserves configuration; does not start a job). In Homebase Friends prepare relay credentials for your existing device. Run `collector.py pair`, enter the shown base sequence and paste the device key at the hidden prompt. No platform token is needed on the Mac. Pairing preserves contact mappings and replaces only local retry/cursor state; scheduling must be disabled.

After approval run `collector.py sync --confirm-manual-sync --reconcile` and inspect Homebase plus `collector.py health`. Only after this real test is verified and scheduling approved should `manage.py enable --approve-automation` be used. Disable/return to manual import remains available. No message content, attachments or raw handles leave the collector. Secrets stay in Keychain, never config, argv, GitHub or chat.

Full ordered update, pairing, privacy and rollback instructions:
https://github.com/carljeff/homebase/blob/feat/friend-crm-messages/docs/friend-crm/MAC_SETUP.md

Manual export/import remains available; do not use the legacy direct Sites-token setup. High Sierra Keychain/TLS and post-reboot scheduled behavior require real validation.
