# Focused hardening and validation

**Status: implemented on `feat/vault-demo-hardening`, not deployed. Synthetic data only. No real-data release recommendation.** This is an engineering review, not an independent specialist audit.

## Confirmed weaknesses and changes

| Severity before fix | Confirmed issue | Change |
| --- | --- | --- |
| High | A newly minted app token could initiate/confirm erase without proving possession of vault credentials | Added fresh, per-adult RSA-OAEP challenge/response using that adult's password-encrypted private credential. Legacy session-only erase fails closed. |
| Medium | Enrollment could accept another stable visitor ID with the configured second-adult email | Atomic enrollment guard permits only one secondary identity, including pending requests. Replacement requires an explicit future lifecycle decision, not silent enrollment. |
| Low | Parallel requests could exceed the session or record cap after separate count checks | Counts are enforced inside the final INSERT as well as the preliminary checks. |

Individual record deletion also requires a proof bound to its record ID and exact revision. Routine edits still require authenticated membership, an unexpired session and revision compare-and-swap.

## Fresh authorization design

No password, private key or family decryption key is transmitted. An approved adult requests a 60-second challenge. The server generates 256 random bits, encrypts them to that adult's approved RSA-OAEP public key and retains only a digest of the expected response. The RSA label authenticates a versioned domain, challenge ID, vault ID, actor ID, public-key fingerprint, action scope and expiry. The database additionally binds the proof to the current actor's token digest and exact approved credential envelope.

The browser asks for the adult's own passphrase again, unwraps the existing RSA private key locally using the existing PBKDF2/AES-GCM implementation, decrypts the challenge and sends the random response. This demonstrates current possession of the encrypted credential's private key; it does not cryptographically prove a human typed a password rather than using a compromised client. Honest client code unwraps afresh for every proof and does not cache that private key. A compromised frontend/device remains outside this guarantee.

The server atomically consumes a matching, unexpired proof. Reuse, wrong actor, wrong session, wrong action, changed credentials or wrong response fail. Request creation and erase claiming recheck active actor authorization. Erase confirmation retains the existing transactional claim: only the adult OTHER than the requestor may complete a shared erase. Concurrent confirmations have one winner. Cancellation or expiry prevents a later claim. If a transaction is interrupted, its writes roll back; the proof stays consumed, so retry requires a new proof rather than replaying an uncertain operation. A request whose response is lost can be retrieved using a new proof without extending its expiry.

A new schema-only migration adds `demo_action_proofs` and `demo_authorized_erase`. Old unproved requests in `demo_erase` are intentionally ignored. No existing encrypted record, wrapped family key, membership or original migration is rewritten. Live active key envelopes, memberships, sessions, action proofs and encrypted records are deleted during a successful authorized erase. The owner identity binding remains to prevent takeover. Historical provider copies are separate, as discussed below.

### One-time first-adult setup

The second adult already has a password-encrypted RSA credential from sharing. The legacy first adult has only an AES-wrapped family key and therefore cannot answer an individual RSA challenge yet.

1. Pair the second adult normally first.
2. The first adult unlocks, enters their existing passphrase in Shared access and selects **Request action-key approval**. The client first verifies the existing vault unlock, then creates a password-encrypted RSA credential without changing the family key or records.
3. Use **Verify pending action-key fingerprint**, entering the same passphrase, then independently communicate the locally verified fingerprint to the second adult. This check rejects a substituted server-supplied public key.
4. The second adult unlocks and approves that fingerprint using their own passphrase through the existing sharing approval mechanism.
5. The first adult unlocks again. Both adults now have individual approved credentials for destructive actions.

Until this is complete, erase and record deletion by the first adult are disabled. Solo erase is intentionally unavailable for legacy one-adult vaults: no silent first-use public-key registration bypass was added. If neither adult can supply credentials, there is no application recovery/erase bypass; a separate explicit administrative destruction request would be needed. No recovery system is introduced.

These additional setup steps are the cost of making server-verifiable per-adult proof possible without sending passwords, changing the existing encryption format, trusting a cosmetic password field, or adding an authentication service. The new proof composition still needs independent review.

## PBKDF2 versus Argon2id

**Decision: retain PBKDF2-HMAC-SHA-256 at 600,000 iterations for this prototype; no KDF migration.** Argon2id offers a real memory-hard offline-guessing advantage, not merely a theoretical improvement. OWASP generally prefers Argon2id; its PBKDF2 recommendation of at least 600,000 SHA-256 iterations is given in a FIPS-required context. This application does not claim FIPS certification or that PBKDF2 is equivalent to Argon2id.

Why retain it here: the existing native Web Crypto implementation and encrypted records already work on the users' devices; changing KDFs would require a reviewed JS/WASM implementation, dependency pinning, CSP/WASM review, memory/performance tuning and credential rewrapping. No native Argon2id implementation is used by this code. Actual iPhone/iPad Safari Argon2id timings have not been measured, so there is insufficient evidence to justify that extra code and migration in this focused pass.

The included `scripts/benchmark-kdf.mjs` measured 7 synthetic derivations on this Node v24.22.1 host: median **104 ms**, max **145 ms**. These are host-only timings, not Safari measurements and not estimates of an attacker's cost. Pairing/unlock has been user-confirmed on iPad; the new proof/setup flow has automated DOM coverage but has not been deployed for device testing.

A 16-character minimum is a compatibility constraint, **not an entropy guarantee**. Before real use, choose independent, unique password-manager-generated passphrases (for example, 20+ random characters or six independently random words). Predictable phrases remain vulnerable at any length. No paid service or artificial character-composition rules were added. Changing future passphrase guidance does not strengthen historical encrypted envelopes retained by a provider. Do not silently reject an existing password or claim an entropy level from length alone.

References: OWASP Password Storage Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html ; RFC 9106, https://www.rfc-editor.org/rfc/rfc9106 ; W3C Web Crypto RSA-OAEP and PBKDF2 definitions, https://www.w3.org/TR/webcrypto-1/ .

## Authentication and hosting: verified versus assumed

| Property | Evidence and limit |
| --- | --- |
| Intended audience | Read-only native Site metadata confirms demo v3, custom audience, one owner and one viewer, no groups, no vault MCP connection. This follow-up did not change it. |
| Session replay | Synthetic tests reject cross-actor, expired, revoked and mismatched-token use. An authorized session can retrieve ciphertext before password unlock; it cannot decrypt it or satisfy destructive-action proof alone. |
| Header spoofing | The Worker directly trusts dispatch's user ID/email headers. Tests explicitly demonstrate a direct handler invocation with fabricated trusted headers is accepted. It cannot itself distinguish verified ingress from a forged direct request. Platform header stripping/replacement remains unverified, not a passing application test. |
| Alternate origin | Worker rejects unexpected request origins and cross-site mutation headers. A host that rewrites the request URL could bypass this check; it is not proof the provider origin is unreachable. No direct-origin bypass testing against third-party infrastructure was performed. |
| Identity replacement | First-adult stable ID remains pinned. Secondary enrollment now atomically rejects a new stable ID if a secondary already exists. The email-to-account verification and immutability contract still depend on hosting. |
| Isolation from ordinary Homebase | Dedicated project/origin, no ordinary Homebase credentials/bridge/MCP, exact-origin mutation checks and no framing. Managed D1 resource/administrator isolation is a provider guarantee still requiring confirmation; a shared logical binding name `DB` does not itself establish resource identity. |
| Plaintext | Synthetic client transport/database canaries do not expose passwords or record text. Source contains no sensitive logging/storage/MCP path. Tests do not establish provider logging behavior or protect against malicious deployed JS, extensions, screenshots or a compromised device. |

The previous network probes returned 403/error 1010 through the execution network and cannot establish which ingress rejected them. No additional network attack was attempted. No live data was read or changed.

## Retention and erase limitations

Cloudflare documents always-on D1 production Time Travel: published limits are **7 days on Free / 30 days on Paid**. The managed Site's actual plan and any additional snapshots/log retention are not exposed in available tools. These durations are the provider's general limits, not a verified deletion schedule for this vault.

Thus deleted encrypted records AND their old password-wrapped key envelopes may remain recoverable by the provider during retained history. An offline attacker obtaining such history can guess either adult's historical password; deleting live keys does not guarantee cryptographic erasure of historical copies. Successful app erase removes active encryption/membership rows but cannot promise immediate provider-wide deletion. This does not add any application backup or recovery feature.

References: https://developers.cloudflare.com/d1/reference/time-travel/ ; https://developers.cloudflare.com/d1/platform/limits/ . Product-specific answers remain required; see the unsent support request in REVIEW_HANDOFF.md.

## Validation results

- **194 full application tests passed, 0 failed.** Existing Kitchen, Family, Projects, Friends and connector tests remain included.
- **27 standalone vault tests passed, 0 failed.** Includes authorization, scopes, account/session replay, wrong password, fingerprint substitution, corrupted authenticated context, unauthorized enrollment/approval, cross-account access, conflicting revisions, old-record replay, parallel caps, erase cancellation, simultaneous confirmation, legacy-request rejection and transaction interruption/retry.
- Rendered client tests exercise second-adult sharing, first-adult action-key request/verified fingerprint/other-adult approval, fresh-password record deletion, two-adult proof-authorized erase, and backgrounding with a delayed response. Real Safari testing of these NEW changes remains pending.
- TypeScript passed; focused ESLint passed after removing an unused test import; Worker bundle, production artifact build and validation passed. No dependencies were added.
- Automated tests use in-memory SQLite with an adapter implementing transactional rollback, Web Crypto, fake identities and DOM simulation. They are not a real Cloudflare concurrency test, real browser SOP/clipboard audit, external penetration test or independent cryptographic review.

## Remaining blockers, ranked

1. **High — hosting identity/ingress assurance:** confirm verified headers cannot be forged at any reachable origin and resource/admin boundaries are enforced. Without that contract, application membership can be impersonated for ciphertext access and denial of service. Fresh private-key proof adds protection to destructive actions but does not fix untrusted ingress.
2. **High — independent review/client integrity:** review the new proof/enrollment composition and deployable frontend supply chain. Server/frontend compromise can expose unlocked data or replace code. A source self-review cannot certify this away.
3. **Medium — provider history and logs:** obtain the actual history/deletion/logging rules; explicitly accept the limits before real identifiers. App erase cannot remove known historical envelopes at the provider.
4. **Medium — actual-device validation:** approve a synthetic-demo-only update, then test the first-adult action-key upgrade, both fresh credentials, erase cancellation, backgrounding and concurrent editing on iPad/iPhone Safari. Existing device confirmation covered the prior v3 only.
5. **Residual design limits:** whole-vault erase only, no selective revocation, no trusted witness against a malicious server restoring old ciphertext, no clipboard/memory/screenshot guarantees. These must be understood rather than hidden by adding unrelated infrastructure.

**Recommendation: not ready for real sensitive identifiers.** Keep the new code for review; obtain hosting answers and independent protocol review. A separately approved demo-only deployment can then validate the new UI on devices. No merge, deployment, real-data enablement, paid service, backup or recovery system was performed in this pass.
