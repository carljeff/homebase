> Final hosting disposition and current support/device handoff: [FINAL_SECURITY_READINESS.md](FINAL_SECURITY_READINESS.md). Earlier version-specific notes below are historical; no additional deployment has occurred.

> Current follow-up: [HARDENING_VALIDATION.md](HARDENING_VALIDATION.md). The branch now adds server-verifiable per-adult credential proofs; that code is not deployed. The support questions below remain unsent and unanswered. Fresh identity-provider MFA is defense in depth; proof of a newly unlocked vault credential now supplies destructive-action authorization. Review the latest hardening branch rather than treating the historical code hash below as current.

# Family Vault: external review and hosting verification handoff

Prepared November 5, 2026. **Synthetic-only; real-data release blocked.** No external reviewer or paid service has been engaged, and the support request below has not been sent.

## Verified in this follow-up

- Hosted demo is version 3 with a custom audience containing one owner and one viewer, zero groups. Both adults can modify records through application membership; the viewer cannot publish code. No vault MCP connection is configured.
- User confirmed two-adult pairing and background/return locking on iPad.
- Re-ran the complete standalone vault suite: **18 tests passed, 0 failed**. Prior full application run: 185 passed, with TypeScript, focused lint and bundle/build checks passing. No new executable changes in this follow-up.
- Native hosting tools expose identity/access policy and source/deployment management, but no proof of a fresh identity-provider login, MFA assertion, or this database's provider retention setting. The documented identity contract supplies stable per-Site IDs and email; it does not document auth_time/acr or a supported reauthentication request.
- Three unauthenticated network probes were attempted (state, script asset and state with synthetic identity headers). Do not count a non-success response as proof of ingress header stripping: the execution network may reject the request before it reaches the hosting gate. Direct-origin bypass and authenticated header substitution require provider confirmation or an approved controlled test environment. No private records or credentials were read for these checks.

## Hosting findings from primary documentation

1. Cloudflare D1 documents always-on point-in-time history on its production backend; published limits distinguish 7 days on Free and 30 days on Paid. This is provider history, independent of this application's deliberately absent backup/recovery feature. **The managed Sites account's actual plan, retention configuration and additional snapshots are not exposed here.** Do not infer either duration for this particular database or promise immediate global deletion after erase.
2. OpenAI Sites administration documentation directs retention/deletion questions to OpenAI Support. Generic ChatGPT conversation-retention rules are not evidence of hosted D1/log retention.
3. Sites Terms section 3.3 prohibits PHI and PCI data (with the specified payment-provider exception) and addresses other sensitive personal data separately. This is not evidence of a blanket SSN/passport ban, nor certification that this custom vault is suitable. Do not extend the prototype into health records, payment cards, or medical insurance claim/health details. Clarify encrypted identifiers and insurance policy reference scope before release. This document makes no legal compliance determination.

References checked November 5, 2026:

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/platform/limits/
- https://learn.chatgpt.com/docs/enterprise/sites (Security and privacy)
- https://openai.com/policies/chatgpt-sites-terms/ (section 3.3)
- https://openai.com/policies/chatgpt-sites-data-processing-addendum/

## Current ready-to-send hosting request — NOT sent

The revised request is in [FINAL_SECURITY_READINESS.md, section 6](FINAL_SECURITY_READINESS.md#6-provider-request--ready-to-send-not-sent). It replaces the earlier six-question draft: per-adult vault-credential challenges now handle destructive-action authorization, so fresh identity-provider MFA is no longer the implementation blocker. Remaining questions are grouped into Q1 identity/ingress, Q2 isolation/delivery/remix, Q3 retention/logging/deletion and Q4 permitted identifier scope.

Official destination: the support chat bubble at https://help.openai.com/ . No official support-submission connector is available in this session. Nothing has been sent. No passwords, private keys, real identifiers, ciphertext or private contact data should be included. See the final readiness report for verified answers, accepted limitations and the prepared two-device test plan.

## Independent reviewer brief — not commissioned

Review the code at GitHub PR #27, commit 30dc51d945e7b127169d004fb4ad9089e94700a5, building on #26 and #25. The follow-up documentation commit does not alter executable behavior. The matching hosted source revision is 3dada975932f67229ed3ddad819e29784ba6101c (demo v3).

Scope:

- `vault/crypto.mjs`, `sharing.mjs`, `share-validation.mjs`, `validation.mjs`: key generation/derivation, AES-GCM nonce/AAD, RSA wrapping, public/private key consistency, independent fingerprint channel, identity/context binding, malicious-server substitution/rollback limits.
- `vault/session.mjs`, `client.mjs`, `index.html`: all asynchronous lock races, clipboard and BFCache/background paths, absolute/idle expiry, sensitive DOM lifetime, injection surfaces, browser storage, client-delivery threat.
- `worker/handler.mjs`, Drizzle migrations: authorization on every route, actor sessions, membership rebinding/capacity, stale writes/retries, quotas, destructive erase races and provider-identity assumptions.
- Generated `worker/index.js` must match the bundled source and contain no extra assets/endpoints. Dedicated origin must remain isolated from ordinary Homebase/MCP/CRM code.
- Specifically evaluate whole-vault erase as the only lifecycle. No password recovery, backup export, selective member revocation or rotation exists. Determine whether this is acceptable for the explicit threat model before recommending real-data use.

Run from `tools/family-vault-hosted`:

```sh
node --test tests.mjs sharing-tests.mjs hardening-tests.mjs
node scripts/bundle.mjs
bash scripts/build.sh
node scripts/validate-artifact.mjs
```

Run `npm test` and `npm run typecheck` from the repository root with existing dependencies installed. Use synthetic identities and values only. No reviewer needs production data, either adult's password, login access, Keychain, or Mac mini access. Do not conduct destructive testing on the live demo; use the in-memory SQLite fixtures or a separately approved environment.

Expected output: severity-ranked reproducible findings, explicit assumptions, recommended fixes, retests and a release/no-release recommendation. A second automated/model review alone is not an independent specialist audit. Any engagement/cost requires the user's approval first.

## Release decision

Do not remove the synthetic input restrictions, move real records, weaken the separate-origin boundary, or deploy a production Family Vault while these gates remain unresolved. No further UI polish or repeated successful functional test can establish provider guarantees or independent assurance. Existing synthetic sharing/testing may continue. Obtain the support answers and a qualified review, remediate findings, then request explicit real-data/deployment approval.
