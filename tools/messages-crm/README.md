# Homebase Messages collector

Update with `manage.py install` (preserves configuration; does not start a job). In Homebase Friends prepare relay credentials for your existing device. Run `collector.py pair`, enter the shown base sequence and paste the device key at the hidden prompt. No platform token is needed on the Mac. Pairing preserves contact mappings and replaces only local retry/cursor state; scheduling must be disabled.

After approval run `collector.py sync --confirm-manual-sync --reconcile` and inspect Homebase plus `collector.py health`. Only after this real test is verified and scheduling approved should `manage.py enable --approve-automation` be used. Disable/return to manual import remains available. No message content, attachments or raw handles leave the collector. Secrets stay in Keychain, never config, argv, GitHub or chat.

Full ordered update, pairing, privacy and rollback instructions:
https://github.com/carljeff/homebase/blob/feat/friend-crm-messages/docs/friend-crm/MAC_SETUP.md

Manual export/import remains available; do not use the legacy direct Sites-token setup. High Sierra Keychain/TLS and post-reboot scheduled behavior require real validation.
