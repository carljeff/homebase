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

## Ready-to-send support request — not sent

Subject: Sites encrypted family-vault feasibility: identity assurance and hosted-data retention

I operate a private two-adult synthetic-data prototype on ChatGPT Sites. No real sensitive identifiers have been enabled. Browser Web Crypto encrypts records before transmission; vault passwords and plaintext keys are not sent to the Worker. The ordinary Homebase application and vault use separate origins. Before considering real identifiers, please confirm:

1. Does Sites support a verified fresh authentication or MFA challenge for a sensitive operation? If so, what documented server-verifiable assertion/timestamp and request flow should the Worker use? A newly issued application bearer token does not establish fresh identity-provider login.
2. Are inbound oai-authenticated-user-id/email headers stripped and replaced by dispatch on every route? Can the Worker/provider origin be reached without dispatch, and how is direct-origin bypass prevented? What happens to these headers for service-access/bypass-token requests?
3. For the managed D1 database, what point-in-time history, replicas, snapshots and other backups exist? What are their retention/deletion windows after individual rows are erased and after Site deletion? What happens to old wrapped-key rows? Can retention be configured and is there an authoritative deletion commitment?
4. What Worker/request/diagnostic logs are retained, for how long, and by whom? Are authorization headers or bodies captured anywhere by default? Which logging controls apply to managed Sites?
5. Which administrative/support roles can read hosted ciphertext, runtime variables or deploy new frontend code? What audit logs or deployment protections are available to a personal-account Site owner?
6. Is this encrypted-only personal-family identifier use supported under current Sites terms, excluding PHI and PCI data? Please distinguish policy numbers/reference text from health/claims data and clarify any relevant hosted-data restrictions. No document uploads are planned.

Please provide supported documentation or a written product-specific answer. I am not requesting a subscription, new service, account change or sensitive-data import. I can provide the Site URL/account details privately through the support channel; no passwords, keys, real identifiers or record ciphertext need be included in this request.

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
