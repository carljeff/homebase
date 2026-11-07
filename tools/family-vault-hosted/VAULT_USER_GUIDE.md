# Family Vault user guide

Use the [private demo](https://homebase-vault-demo.carl-jeff.chatgpt.site) in Safari or another modern browser. Enter synthetic records and use separate test passphrases. Keep each passphrase in your own password manager.

1. Each adult signs in with their own ChatGPT account and selects **Unlock test vault** with their own passphrase. Both adults can view and edit the same shared records. Pick a test family member, add or edit a fake record, then copy its value from the record when needed. Treat copied values as visible to other apps with clipboard access.
2. If Lindsay has yet to enroll, she selects the first-use option and requests access with her own passphrase. She verifies her fingerprint locally and shares it with Jeff outside the vault, such as by comparing screens in person. Jeff opens **Check access requests**, compares the fingerprint and approves it with his passphrase.
3. Jeff selects **Request action-key approval** in Shared access, then **Verify pending action-key fingerprint** with his existing passphrase. He shares that fingerprint independently with Lindsay. She compares it in **Check access requests** and approves with her own passphrase. Jeff locks and unlocks again to finish setup.
4. Deleting a record prompts for your own passphrase again. **Lock now** clears the unlocked view. The vault also locks when you leave or background it, after two minutes of inactivity, or at the ten-minute session limit. Lock before handing over your device or signing out.

A forgotten vault password cannot be recovered. The other adult can still unlock using their own password. Whole-vault erase requires fresh authorization from both adults, so losing a password can also block self-service erase. Keep the physical originals as your source of record.

## Device checks for Jeff and Lindsay

- Unlock independently and confirm the same existing fake records appear. Try one incorrect password and confirm the vault stays locked.
- Complete Jeff’s fingerprint approval and verify that a mismatched fingerprint is rejected before accepting the correct one.
- Create a disposable fake record. Edit it on one device while the other has the old version open. The stale save should fail. Try deletion with an incorrect password, then delete with the correct password and confirm the change on both devices.
- Background each browser and return. Repeat by leaving the vault idle for two minutes. Both should require unlocking. After session expiry, reopen the vault and retry a stale action with fresh authorization.
- To test erase safely, one adult can authorize a request and cancel it. Confirm the records remain. Leave final confirmation for a separately approved full erase.

Report which checks passed and the device/browser used. Share no passwords or record values in the report.
