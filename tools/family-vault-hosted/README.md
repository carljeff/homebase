# Shared synthetic Family Vault demo

**Synthetic text only. Not audited or approved for real identifiers. Live Homebase is unchanged.**

This separate HTTPS demo now supports two configured adults, independent unlock credentials, one encrypted test vault, and erase-and-restart. There are **no backups, exports, imports, recovery codes or password reset**. Physical originals remain the source of truth.

## First adult (existing tester)

Open the same demo and unlock with your existing TEST passphrase. Existing wrapped keys/records are retained by the additive migration. Do not select initialization if you already have a test vault. The first adult's identity is explicitly configured at runtime and bound to the Site's stable verified visitor ID; editable Family names/roles and arbitrary Site invites cannot claim it.

## Pair the second adult

1. Both configured adults need access to the demo Site through separate logins. Visiting the Site does not grant decryption or record access.
2. The second adult enters a **different disposable TEST passphrase**, selects the first-use checkbox and submits. Their browser creates a 3072-bit RSA-OAEP key pair, encrypts the private key under a PBKDF2/AES-GCM key derived from their passphrase, and submits only the public key and encrypted credential envelope. The password/private key never leaves the browser in plaintext.
3. The second adult sees a 64-character public-key fingerprint. Compare or pass that fingerprint to the first adult **outside this demo** (for example, directly between your devices or in person). Do not use an owner-page value supplied by the server as independent verification. When a pending request is reloaded, the browser must unlock and authenticate its encrypted private credential before displaying its fingerprint; server key substitution then fails.
4. The first adult unlocks, chooses **Check access requests**, pastes the independently received fingerprint and re-enters their OWN test passphrase. They never enter or receive the second adult's passphrase. A mismatch or failed local unlock stops approval. A wrong approval attempt locks the view; unlock again to retry.
5. Their browser wraps the same existing family key to the verified recipient public key and produces an authenticated membership confirmation. The server stores ciphertext, not the family key. The second adult unlocks again with their own test passphrase and reads/edits the same records.

Both adults can create, edit and delete records for all five fake profiles. Data stays in one namespace, not two copies. Ordinary unlock returns non-extractable AES keys. Sharing reauthentication temporarily unwraps an extractable key locally solely for native RSA-OAEP key wrapping; it is never exported to application strings or persisted. Private credentials, recipient identity, request ID, public-key fingerprint and vault ID are cryptographically bound by authenticated contexts. The first adult does not receive the second adult's password-encrypted private credential.

The supported cryptographic primitives are the browser's maintained Web Crypto implementation: PBKDF2-HMAC-SHA-256 at 600,000 iterations, AES-GCM and RSA-OAEP/SHA-256. This application-level composition has **not** been independently reviewed. A compromised vault frontend, extension or device can still expose unlocked data; fingerprints assume trusted clients and an independently checked channel.

## Erase and restart

- Click **Start over — erase test data**. No data is erased by that click. It creates/loads a short-lived erase request.
- Before sharing is active, the first adult must explicitly type `ERASE DEMO` and confirm.
- After sharing is active, one adult requests erase and the OTHER adult opens Start over within ten minutes, types `ERASE SHARED DEMO`, and confirms. The requester cannot approve their own shared erase.
- Either approved adult can cancel the erase request. Cancellation is persisted server-side; it does not merely hide a dialog.
- Confirmation uses a newly issued app session (less than 60 seconds old), both authenticated identities for a shared erase, an expiring request ID and an exact confirmation phrase. This is **not** a verified fresh identity-provider password/MFA challenge; production step-up authentication remains an unresolved release gate.
- The transactional erase claims the exact current request and expected membership state, then deletes encrypted records, wrapped keys, memberships, requests and related sessions. It retains the original first-adult identity binding so a different visitor cannot take over the household. The first adult can initialize a fresh random vault; the second adult must enroll again. Old tokens/keys cannot access the new vault.
- There is no decryption backdoor or password-recovery process. If neither adult can unlock, originals must be re-entered after erase. If an adult loses their SIGN-IN account and cannot participate, there is no in-app bypass of the two-person erase; administrative destruction/recreation would require a separate explicit owner request. This phase does not implement individual re-enrollment, selective revocation or rotating one member's keys without erasing.
- Deletion here removes live demo database rows. Provider backups/log retention and previously copied plaintext are outside this application's deletion guarantee. Production data-retention assurances need review.

## Storage, access and locking

The demo has its own project/D1 database, no production Homebase bindings/credentials, no MCP/plugins, no document uploads and no plaintext record processing on the server. All record fields remain encrypted before upload. Session tokens live in browser memory and are stored only as hashes server-side. Vault passwords/keys/plaintext are never placed in persistent browser storage. ChatGPT/Sites authentication uses its normal protected cookies; those are identity sessions, not vault-decryption keys.

Site access is restricted to the configured adults; the Worker also independently checks `VAULT_OWNER_EMAIL` and `VAULT_SECOND_ADULT_EMAIL` runtime values, then stable identity binding and explicit cryptographic membership. Email allowlist values are runtime secrets, not committed source. Missing configuration fails closed. Adding a Site viewer does not enroll a vault member. Owner/secondary roles choose the initial key path, but approved adults have equal record permissions.

Exact-origin writes, no CORS, no-store, framing denial, restrictive CSP, bounded bodies, per-actor quotas, token expiry, revision checks and delete tombstones remain. Locks occur after two minutes idle, backgrounding and page exit; stale async crypto results cannot repopulate or submit after lock. JavaScript cannot guarantee secure memory erasure or revoke clipboard copies. Server sessions expire after two minutes idle and ten minutes absolute lifetime.

This remains a standalone browser demo, not an embedded production Family-tab release. iPad testing of the single-user demo was user-confirmed; real two-account Safari behavior still needs testing by both adults. No paid service, subscription or additional dependency is introduced.

## Validation and review gates

Run:

```sh
node scripts/bundle.mjs
node --test tests.mjs sharing-tests.mjs
bash scripts/build.sh
node scripts/validate-artifact.mjs
```

From the Homebase checkout, `npm test` also runs the sharing/erase contracts and rendered two-client flow. Tests use synthetic identities/data only: separate-passphrase pairing, wrong password/fingerprint, public-key substitution after reload, pending/self/third-account access rejection, request replay, package tampering, same-key read/edit/delete, no password/plaintext request/database canaries, existing key preservation, fresh two-adult erase, wrong phrases, cancellation, session invalidation, and rendered request/approval/second-adult editing. Existing Kitchen/Family/Projects/Friends/MCP tests remain part of the suite. Automated tests are not an independent security audit and do not prove real browser SOP or OS key handling.

Before real sensitive information: independent crypto/protocol review; real two-adult device tests; verified ingress/identity freshness; key lifecycle and selective revocation policy; deployment integrity; operational abuse controls; documented provider retention/deletion behavior; and a separate explicit production/data-entry approval. No backup/recovery implementation is planned under the revised scope.
