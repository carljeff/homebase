# Mac mini local validation and later activation

These commands run on the Mac through Termius as your usual Messages account. No direct Mac access was assumed. No production deployment or automatic sync is authorized by installing this package.

## 1. Install the disabled local tools

After the PR branch is available, run:

```sh
mkdir -p "$HOME/Downloads/homebase-messages-crm"
/usr/bin/curl --fail --location --proto '=https' --proto-redir '=https' \
  'https://github.com/carljeff/homebase/raw/refs/heads/feat/friend-crm-messages/tools/messages-crm/homebase-messages-crm.zip' \
  -o "$HOME/Downloads/homebase-messages-crm.zip"
/usr/bin/unzip -q -o "$HOME/Downloads/homebase-messages-crm.zip" -d "$HOME/Downloads/homebase-messages-crm"
/usr/bin/python "$HOME/Downloads/homebase-messages-crm/HomebaseMessagesCRM/manage.py" install
```

Installation copies only this integration's files into `~/Library/Application Support/HomebaseMessagesCRM`, preserves an existing config and creates a disabled plist outside LaunchAgents. It does not start sync, change Messages permissions/ownership, modify power/login settings or install external dependencies. Review code before running it. Python and SQLite availability are checked by installation. If Python is absent or these commands fail, stop and report the generic error; do not install arbitrary packages or weaken TLS checks.

## 2. Read-only diagnostics first

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" diagnose
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" dry-run
```

The example config has an empty mapping and a valid placeholder device UUID, sufficient for this **local-only** stage. Dry run uses an in-memory cache and never calls the network or advances the real cursor. Expect zero matched friends until local mappings are entered.

Compare `diagnose` with the known November 4 baseline: total 989; incoming 655; outgoing 334; handles 51; conversations 47; linked 947; unlinked 42; direct conversations 37; group conversations 10. Counts can legitimately rise as Messages syncs. Do not force results to match an old snapshot. Investigate any unexplained mismatch before upload.

Dry run reports scanned/invalid/unlinked/ambiguous/unmatched/excluded counts, timestamp-unit distribution, and earliest/latest UTC dates. Timestamp scales 1/1000/1000000/1000000000 mean Apple epoch seconds/milliseconds/microseconds/nanoseconds. Confirm latest UTC corresponds to recent local activity on November 4; UTC may be a different calendar day. Historical formats are checked per record. Zero, malformed or implausibly future timestamps are excluded. The read-only SQL in `tools/messages-crm/diagnostics.sql` supplies additional count-only checks for incomplete chat associations. Never paste a database dump, handles, or message content into chat.

## 3. Permission review, without automatic changes

```sh
/usr/bin/stat -f '%Su %Sg %Sp %N' "$HOME/Library/Messages/chat.db"
/bin/ls -lde "$HOME/Library/Messages" "$HOME/Library/Messages/chat.db"
/bin/ls -le "$HOME/Library/Messages/chat.db-wal" "$HOME/Library/Messages/chat.db-shm"
```

Missing WAL/SHM files are normal when not present. `diagnose` also reports mode/ownership and whether other users can write the database. The prior `-rw-rw-rw-` finding is historical and has **not** been verified here.

If the database is still 666, first confirm it is owned by your logged-in Messages account, inspect its ACLs, record existing modes, and verify no deliberate shared-account access depends on them. A conservative proposed first correction is `chmod go-w` on the database, removing other users' write access while preserving current read access. Do **not** run it blindly, change ownership, change the enclosing Library permissions, or modify existing ACLs. Owner-only `chmod 600` for the database and existing WAL/SHM files is a stronger follow-up only after confirming same-user Messages ownership and intended access. Review the actual output before choosing a change. Re-run read-only diagnostics, check new incoming Messages/SMS synchronization and recheck permissions after restart. The collector/installer never applies either correction.

## 4. After production deployment has been explicitly approved

In Homebase → Friends, add one friend and opt into messaging metadata. Copy its **Local matching ID**. Create a collector credential; the signing master must already be configured server-side. Do not put phone numbers/emails into Homebase notes. Edit only the private Mac config:

```sh
/usr/bin/nano "$HOME/Library/Application Support/HomebaseMessagesCRM/config.json"
```

Replace `device_id` with the Homebase device UUID. Leave the pinned HTTPS endpoint unchanged. Add a local mapping, for example using **synthetic placeholders only**:

```json
"contacts": [
  {"contact_id":"11111111-1111-4111-a111-111111111111",
   "handles":["+13175550101","friend@example.test"]}
]
```

Replace those locally with the real friend UUID/phone/email. Multiple handles can map to one UUID. One handle cannot map to different people. File must remain mode 600; directory 700. Run dry-run again and compare counts before transmission.

Provision the signing key and the **approved Sites service-access credential for this Site** into the Mac login Keychain:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" credentials
```

Both prompts hide input. Never paste secrets into shell commands, config, GitHub, launchd or chat. The platform access credential must be provisioned through the supported Sites workflow after deployment approval; affiliate/Walmart/GitHub tokens are unrelated. Do not rotate access or change Homebase's audience to work around the gate. Keychain must be accessible to this user; do not use `security -A`, disable Keychain protection, or grant all-app access. Check this manually before any background activation.

## 5. One manual synchronization after validation

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" sync --confirm-manual-sync
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" health
```

Refresh Homebase's Friends sync status. Check last receipt time, sequence, direct incoming/outgoing counts and separate group counts for the one mapped friend. Repeat the manual command: totals should remain unchanged if no messages changed. Verify normal incoming iMessage/SMS activity, SSH and VNC responsiveness. `--reconcile` forces metadata reconciliation after a reviewed local mapping change. Raw payload preview is deliberately not printed; local summaries and the tested allowlisted schema form the privacy check.

A failed request stays pending; retry the same command after restoring network/server access. Never reset counters or edit a pending body. For persistent mapping/schema/sequence changes, use the revoke/re-enroll process in the architecture guide. Check local system time if signatures are rejected. Authentication redirects/HTML are treated as failure, not success. No automatic server setup or account connection occurs.

## 6. Automation — only after explicit approval

Do not run this section until the local output, credentials, manual sync and privacy behavior are validated and approval is given.

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/manage.py" enable --approve-automation
/bin/launchctl list | /usr/bin/grep com.homebase.messages-metadata
```

The installer requires a recorded successful manual sync and no pending retry. This installs a user LaunchAgent at `~/Library/LaunchAgents/com.homebase.messages-metadata.plist`, interval 900 seconds, RunAtLoad, background process/low-priority I/O. It uses the existing user login session; no sudo or system daemon is needed. An explicit local approval marker is also required by scheduled sync.

After a reboot (only when convenient), reconnect with Termius/VNC and check:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/collector.py" health
/bin/launchctl list | /usr/bin/grep com.homebase.messages-metadata
/usr/bin/tail -n 10 "$HOME/Library/Application Support/HomebaseMessagesCRM/sync-error.log"
```

Confirm Homebase's receipt advances after at most 15 minutes, Messages stays open and receives forwarded SMS/iMessages, SSH and VNC remain usable, and CPU/I/O is acceptable. Keychain unlock after automatic login must be verified; do not assume it works. Fixed success/error messages contain no handles/content/tokens. Logs are small but not automatically rotated; archive/truncate only these integration logs if desired.

## Disable, rollback and uninstall

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/manage.py" disable
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/manage.py" uninstall
```

Disable unloads/removes only this integration's LaunchAgent and approval marker. Uninstall prints cleanup instructions and retains config/cache until intentionally removed. Revoke the device in Homebase first (clears the snapshot and rejects its key), remove its two `com.homebase.messages.*` password entries in Keychain Access, then remove the private HomebaseMessagesCRM folder if desired. Do not touch `~/Library/Messages`.

Application rollback can restore Site v15 after approval. Keep the additive CRM table when rolling back; avoid destructive down-migrations. Revoke credentials/disable launchd first so the Mac doesn't keep retrying an unavailable endpoint. Restoring application code does not reverse unrelated household data edits.
