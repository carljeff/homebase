# Synthetic vault security review — November 5, 2026

Status: engineering self-review and hardening, **not an independent security audit**. Synthetic demo only; no real identifiers or live Homebase vault deployment authorized. User confirmed successful two-adult sharing on their devices. Erase/restart remains the chosen loss-of-access model; backups, exports and recovery are intentionally absent.

## Scope and trust boundaries

Reviewed browser key derivation/wrapping, shared-key approval, record encryption/AAD, server authorization and SQL writes, browser lifecycle, HTTP headers and synthetic tests. No production database queries, private record inspection, data reset, dependency additions or account/key rotation performed.

The dedicated HTTPS origin isolates the unlocked vault from ordinary Homebase scripts, MCP and CRM synchronization. The hosting ingress supplies verified visitor identity; the Worker requires the configured adult email plus stable Site ID binding, an actor-bound in-memory bearer session and explicit membership. Service-access tokens do not provide a visitor identity. Hosting identity documentation specifies stable per-Site IDs but exposes no verified identity-provider authentication timestamp or step-up/MFA challenge. A newly issued application token therefore cannot prove a fresh account login.

## Findings fixed in this increment

| Finding | Impact | Change and verification |
| --- | --- | --- |
| Local key lifetime had only idle expiry | An active page could display plaintext after its server token's ten-minute expiry | Browser session now locks at ten minutes regardless of activity; idle expiry stays two minutes. Clock rollback fails closed. Fake-clock tests exercise both boundaries and continued activity. |
| Erase requests had a separate untracked token and no async epoch guard | A response delayed until after backgrounding could restore an erase panel and usable token | Erase uses the same tracked session; every async response checks its epoch. Rendered-client test delays the real API response, backgrounds the page, then verifies it stays locked and records are retained. |
| Local timeout did not attempt server-token revocation | A local lock could leave the token valid until server expiry | All lock paths attempt a same-origin keepalive revocation; a late login response is also revoked. Network failure still relies on server expiry. |
| Approval, rejection and record deletion checked session before, but not inside, the final SQL write | A concurrent revocation could occur between authorization and mutation | Each write atomically rechecks actor token, idle/absolute expiry and current membership. Adversarial database tests revoke tokens immediately before each write and assert no change. Existing setup/enrollment/record PUT and erase already have write-time session guards. |
| Framing/resource defense relied on CSP and browser SOP | Less explicit defense for older or alternate embedding paths | Added X-Frame-Options DENY and Cross-Origin-Resource-Policy same-origin alongside existing frame-ancestors, CSP, no-store and exact-origin writes. |

No envelope format, KDF, key material, membership or record migration changes. Existing encrypted test data and passwords remain compatible. Cancelling erase now also closes/revokes its local confirmation session.

## Existing protections rechecked

- Native Web Crypto PBKDF2-HMAC-SHA-256 (600,000 iterations), AES-256-GCM with random 96-bit IVs and context AAD; RSA-OAEP-3072/SHA-256 recipient wrapping. Ordinary decrypted family keys and private keys are nonextractable.
- Approval requires the independently communicated recipient public-key fingerprint and the approving adult's own password locally. The server never verifies or receives a password. Pending members cannot approve themselves or read records. Reloaded pending credentials authenticate before displaying a fingerprint.
- Family/vault/profile/record/revision contexts are authenticated. Wrong passwords, corrupted envelopes, altered recipient/context and authentication-tag failures reject. Sharing preserves the existing family key rather than reimporting records.
- Plaintext renders through textContent and form values, with no HTML injection sinks, third-party scripts, analytics, storage APIs or plaintext logging in vault code. Transport/database canary tests exercise the supplied client; opaque ciphertext validation cannot stop a malicious authorized client from deliberately uploading unrelated bytes.
- Background/page exit, idle expiry, explicit lock and async epochs clear the rendered view, forms, keys and local token references. Browser JavaScript cannot guarantee physical memory erasure, clipboard clearing, prevention of screenshots or app-switcher snapshots.
- Both adults can edit all five synthetic profiles. Pending/extra identities are denied. Shared erase requires a current request, exact phrase, distinct approved adults and transactional claim; cancellation invalidates it. Historical first-adult identity binding survives erase.

## Remaining release gates

1. **Independent specialist review:** the application-level combination of Web Crypto primitives and enrollment protocol needs a qualified independent reviewer. Native primitives do not make the composition independently audited. No such reviewer has been engaged or claimed.
2. **Identity and destructive-action step-up:** obtain supported hosting proof of fresh authentication/MFA (or separately approve an established alternative). App-session issuance is insufficient. Until then, account-session theft could request/confirm destructive operations; the two-person rule reduces but does not eliminate this risk. Do not present a cosmetic password prompt as server authorization.
3. **Key lifecycle:** choose and validate selective removal/re-enrollment/rotation requirements before real shared secrets. This demo supports only whole-vault erase. Removing an account cannot revoke previously decrypted/copied information; selective revocation needs a new family key and re-encryption. Do not silently add recovery/backups.
4. **Delivery and origin controls:** verify hosting ingress strips forged identity headers and direct-origin bypasses; document administrator/source/deployment permissions. A malicious deployed frontend or compromised device/extension can steal an unlocked key/plaintext despite client encryption. Ordinary Homebase must not gain same-origin script access when a Family-tab entry is eventually added; top-level navigation to this separate origin is the present safe integration shape.
5. **Retention and deletion:** confirm provider database/backup/log retention and contractual deletion behavior. Erase removes current rows; it is not guaranteed erasure of provider snapshots or prior copies. No automated sensitive record logging is present in this application, but provider-level behavior needs verification.
6. **Device regression:** user-confirmed pairing is valuable; also verify background/foreground, ten-minute active lock, copied-value behavior, erase cancellation and concurrent editing on both adults' actual Safari devices. Automated DOM tests do not establish Safari process/BFCache/clipboard security.
7. **Abuse/concurrency and operations:** per-actor request/body/session limits exist. Before production, stress quotas, storage-cap races, identity rebinding, ordering/rollback and availability. Server revision checks prevent normal duplicate/stale writes but do not protect against a malicious server restoring an entire historical encrypted database. No trusted external rollback witness is implemented.
8. **Explicit release decision:** real-data acceptance and any live Homebase integration require a separate approval after the above findings are resolved or explicitly accepted. This release does neither.

## Validation

Commands: `npm test`, `npm run typecheck`, focused ESLint on changed source/tests; standalone `node --test tests.mjs sharing-tests.mjs hardening-tests.mjs`; Worker bundle/build/artifact validation. Test results are reported with the PR and release handoff. Synthetic identities only.

Manual regression: unlock both existing passwords; edit a fake record across adults; background while an operation is running; return and confirm locked; remain active for ten minutes and confirm locked; cancel an erase request and confirm the other adult cannot complete that cancelled request. Do not erase existing test records merely to validate a deployment.

Rollback: redeploy the prior saved demo version, with the same two-person audience and runtime identities. No schema rollback is needed for this increment. Prior code would restore the security gaps above, so prefer a forward fix. Live Homebase/CRM/Mac mini are outside this release and remain unchanged.

## Estimated remaining effort

Budget roughly **5–10 engineering days** for identity-provider feasibility, key lifecycle, operational/device validation and remediation once platform capabilities and requirements are settled; allow **an additional 3–5 specialist review days**, with calendar time determined by reviewer availability and findings. This is a planning range, not a claim of production readiness or a quote. If fresh identity proof is unsupported, resolving that architecture is a blocker rather than a small code fix. No paid reviewer or service has been commissioned.

## Primary references

- W3C Web Cryptography API, security considerations: https://www.w3.org/TR/webcrypto-1/#security-considerations — script injection and hostile client delivery remain threats to unlocked cryptography.
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html — idle/absolute timeouts, server enforcement and sensitive-operation reauthentication.
- NIST SP 800-63B, session management: https://pages.nist.gov/800-63-4/sp800-63b/session/ — overall/inactivity timeouts and reauthentication.
