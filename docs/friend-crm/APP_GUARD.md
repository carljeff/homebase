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
