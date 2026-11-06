# Messages and Contacts app guard

Mac-side helper only. No Homebase deployment, collector update, credentials, uploads, new service or subscription. Existing Messages/Contacts contents, sync schedules, mappings and Keychain settings are untouched. This does not fix a locked Keychain.

Checks every five minutes in the logged-in user's Aqua session. Reopens a closed Messages or Contacts app with `open -g -a`, without taking foreground focus. A short read-only Contacts count probe checks responsiveness; the count and subprocess output are discarded. Health stores only app status and check time in a private local file. Messages is checked for process presence only, not sync progress. A running app can still be hung or stale.

If Contacts is unresponsive, inaccessible or slow beyond 15 seconds, health reports `needs_attention`. **It does not automatically quit, force-quit, kill or restart either app.** Only a stuck guard subprocess is terminated at its timeout. Treat this as availability protection and diagnosis, not a guarantee of recovery from a freeze. Manually reopen a frozen app through VNC, after checking for unsaved edits. Reopening Contacts resolved the user's observed discovery failure; real Mini behavior of this new helper still needs validation.

## Install only this helper

Use Termius. Download the pinned source to a temporary staging file, syntax-check, then replace only app_guard.py. Existing private collector folder must already exist. No root/sudo is needed. Review the source URL if desired. The actual pinned commit is provided in the release handoff.

```sh
/usr/bin/python -B -m py_compile "$HOME/Downloads/homebase-app-guard.py"
/bin/cp "$HOME/Downloads/homebase-app-guard.py" "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py"
/bin/chmod 600 "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py"
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" check
```

The manual `check` may open closed apps in the background. It does not schedule itself. Confirm `status: healthy`; then enable explicitly:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" enable --approve-automation
```

It writes its own `com.homebase.app-guard.plist`, leaving `com.homebase.messages-metadata` unchanged. If Termius cannot load an Aqua job, run this enable command in Terminal inside the Mini's VNC desktop. It deliberately does not fall back to a system daemon or another user's session. After reboot and automatic login, the user LaunchAgent should resume; this must be verified on the Mini, not assumed from tests. No logged-in desktop means the helper skips app access.

## Check or disable

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" health
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" check
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" disable
```

Health marks a result stale after ten minutes. `scheduled` means the plist exists, not proof launchd has successfully run it. The timestamp must advance. `check` returns app-specific codes; a slow or permission-blocked Contacts read is not definitive proof of a freeze. No private data/error output is printed. Disable unloads/removes only the guard's own job and leaves both apps and collection running. Run disable in VNC Terminal if SSH cannot access the Aqua session. After disabling, the guard script, health JSON and lock may be removed separately if desired; no collector files need removal.

## Tests and limits

Synthetic subprocess tests cover closed-app reopening, background flags, running apps, unresponsive Contacts, no GUI login, launch failure, bounded child timeout, symlink rejection, explicit automation approval and disable preserving configuration. Full existing Python collector/contact tests also run. No real Contacts/Messages data or remote Mini was accessed. No force-restart or unsaved-data risk was introduced. No Linux test can prove High Sierra launchd, AppleEvent permissions, responsiveness or reboot behavior.

Uses only the Python 2.7-compatible standard library and built-in High Sierra commands. See Apple's launchd documentation for user agents, StartInterval and Aqua session restrictions: https://github.com/apple-oss-distributions/launchd/blob/main/man/launchd.plist.5 .

## Opt-in Contacts freeze recovery (current branch update)

This section supersedes the original report-only behavior above when recovery is explicitly enabled. Existing installations stay open-only until the new flag is approved. No Homebase or collector code update is required.

After installing the updated `app_guard.py`, run:

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" enable-recovery --approve-contacts-restart
```

Approval permits Contacts to be force-quit after repeated timeouts. **Unsaved Contacts edits may be lost.** Only enable this on the dedicated Mini after initial Contacts scripting access is working. A timed-out privacy/permission prompt can resemble a hung app; non-timeout permission/script errors never trigger forced recovery. No timeout proves a freeze conclusively.

The existing five-minute guard schedule counts three timeouts spaced at least four minutes apart for the same Contacts PID; gaps over fifteen minutes, a changed process, a healthy result or a non-timeout failure reset the streak. The guard takes the same collector lock as activity and contact review, deferring recovery while either is active. After verifying the logged-in desktop UID and exact Contacts process, it saves the one-hour cooldown BEFORE requesting quit. It then requests normal quit, checks the process and responsiveness again, and only force-stops that same still-unresponsive user-owned Contacts process if needed. It reopens Contacts in the background. The next check establishes actual health; a requested reopen is not claimed as successful recovery. It never force-quits Messages, accesses message bodies, edits Contacts, unlocks Keychain or changes sync credentials.

A process change, active collector, failed state save, changed GUI user, permission error or cooldown stops/defer recovery. A narrow OS process-ID reuse race cannot be completely excluded by command-line PID checks; this is not a guarantee of zero interruption risk. No actual force-restart was performed during testing.

```sh
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" health
/usr/bin/python "$HOME/Library/Application Support/HomebaseMessagesCRM/app_guard.py" disable-recovery
```

Disabling recovery retains the original open-only monitoring; disabling the whole guard remains a separate command. The setting/cooldown contains no passwords or contact data. The updated script can replace the existing script without reinstalling its unchanged LaunchAgent. Take care not to enable a second copy of the job. Logs are local only; nothing is sent to Homebase by this helper.

Validation: 60 Python tests pass, including seven new recovery tests for thresholds, cooldown persistence, permissions, process changes, state-save failure and collector locking. Legacy Python grammar/ASCII checks pass. High Sierra/Aqua behavior and reboot recovery still require local validation. This reduces recurrent stalls but cannot guarantee recovery from OS/address-book corruption or repeated application bugs.

## Keychain reliability: diagnose before changing security policy

A successful signing-key read immediately after `unlock-keychain` confirms the item exists and is accessible in that session. It does not tell us the prior failure's exact status, the login Keychain auto-lock flags, or whether SSH and the scheduled GUI session behave identically.

Run this read-only command on the Mini; it displays lock flags/timeouts, not passwords:

```sh
/usr/bin/security show-keychain-info "$HOME/Library/Keychains/login.keychain-db"
```

If automatic timeout/sleep locking is enabled, disabling those settings can reduce unattended lockouts, **but applies to the entire login Keychain, not just Homebase**, and deserves explicit approval after inspecting the settings. On this automatically logged-in, FileVault-disabled Mini, that tradeoff matters. No code in this update changes it. A reboot or manually locked Keychain can still require an interactive unlock; never promise that automatic login always unlocks it.

If the Keychain is unlocked but access is denied, use Keychain Access through VNC to inspect the `com.homebase.messages.signing` item's Access Control for the actual `/usr/bin/security` helper. Confirm access interactively; do not choose “allow all applications,” globally rewrite ACLs/partitions, recreate the signing key, or paste its value. Trusting a general helper such as `security` is itself broader than trusting a signed dedicated collector, so do not add that trust blindly. Existing successful access suggests an ACL change may not be necessary.

No automatic-unlock workaround is included. Saving the Mac login password in a script, config, launchd plist or process arguments is not an acceptable fix. Creating a second permanently unlocked Keychain also changes the security boundary and is not silently substituted. After any approved settings fix, validate manual lookup (stdout discarded), scheduled activity and review over at least an hour and after a reboot; do not assume a single manual success proves unattended reliability.

Apple references: https://support.apple.com/en-ca/guide/keychain-access/kyca1242/mac ; https://developer.apple.com/documentation/security/seckeychainsettings ; https://developer.apple.com/documentation/security/access-control-lists . No Mac setting was changed remotely.
