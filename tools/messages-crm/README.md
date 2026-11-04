# Homebase Messages metadata collector

Read-only High Sierra local tools. Installation is disabled by default. No message bodies, previews or attachments are selected or sent. Raw handles are matched locally to approved Homebase contact UUIDs. Secrets belong in login Keychain, never configuration.

Run `python manage.py install` using High Sierra's `/usr/bin/python`, then use the installed collector's `diagnose` and `dry-run` commands. These stages do not transmit data. Production deployment, service credentials and real manual synchronization require the separate review described in the runbook. `manage.py enable --approve-automation` is a later explicit step and requires a successful manual sync.

Full instructions, architecture, security, permission review, rollback and limitations:
https://github.com/carljeff/homebase/blob/feat/friend-crm-messages/docs/friend-crm/MAC_SETUP.md
https://github.com/carljeff/homebase/blob/feat/friend-crm-messages/docs/friend-crm/README.md

No command here modifies the Messages database or sends a text. A real High Sierra run, SQLite schema/epoch validation, Keychain/curl/launchd checks and reboot verification remain pending; synthetic tests on modern Python do not establish those outcomes.
