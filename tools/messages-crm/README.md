# Homebase Messages metadata export

Use `collector.py export --output "$HOME/Downloads/homebase-messages.json"` after installation, then select the JSON in Homebase Friends and confirm the preview. Export is local-only, mode 600, contains only approved activity metadata, and never overwrites an existing file. Existing configuration is preserved by installation. Use a new filename for each export. No signing key, service token, network access or launchd activation is needed for this workflow.

Full installation, import, privacy and rollback instructions:
https://github.com/carljeff/homebase/blob/feat/friend-crm-messages/docs/friend-crm/MAC_SETUP.md

Direct automatic uploading remains unsupported on the current hosting setup. Do not run credentials, sync or enable for this manual workflow. Do not share config.json, chat.db, secrets or exports in chat/GitHub.
