# Family Vault — final hosting and security readiness

Evidence date: November 5, 2026 (America/Indiana/Indianapolis).

**Recommendation: NOT READY for real family identifiers yet.** The application has a credible, small design for convenience copies, but critical hosting assurances and device validation of the latest change remain unresolved. This investigation is complete to the extent of available evidence; the next step is one provider response and the planned device validation, not another open-ended source review.

No deployment, merge, live-data mutation, sensitive-record inspection, service purchase, account change or support submission occurred. Application source review is proceeding separately and was not repeated. The previously reported 194 application / 27 vault tests are historical results of the latest code pass, not newly rerun or an independent audit.

## 1. Evidence and version boundary

- GitHub hardening revision reviewed for deployment configuration: `ecdb073047a74df197aa7a7d38c040abeea98ada`, PR #27, branch `feat/vault-demo-hardening`. PR #26 contains the earlier sharing increment; its description links to #27. Neither PR was merged.
- Hosted synthetic demo is still **v3**, source `3dada975932f67229ed3ddad819e29784ba6101c`, deployment `appgdep_6aed028e529481918e5ac689d75d5c17`, reported succeeded. It does **not** have the new action-proof flow.
- Vault project: `appgprj_6aecd9fcffa48191a7b320b194ba9ba8`. Homebase project: `appgprj_6ae16be43dfc8191a5aa58ab5d7c3532` (v29). Different project IDs and origins were confirmed in native metadata.
- Read-only database overviews show `demo_*` tables for the vault and `records`, recipes, Friends/CRM tables for Homebase. No rows were fetched. Both logical bindings are named `DB`; that name is not a physical database identifier.
- Current access policy: custom audience, one owner, one external viewer, no additional editors or groups. Runtime revision 1 has only the two adult-email configuration keys, both marked secret. Values are not reproduced here. The v3 deployment reports `has_mcp=false`.
- `remix_enabled=true` is present in Site metadata. Its effect on private Site source/data/runtime configuration is not documented by the available contract. This is an unanswered setting, not evidence that anyone can copy private records.

### Status meanings

**Verified:** direct metadata, source/build evidence or an explicitly identified published contract supports the statement. Application tests establish only application behavior in their stated environment.

**Requires provider confirmation:** a precise question is unanswered; the support request below supplies the path to resolution. This is not a failed security test.

**Accepted limitation:** a residual property of the intended design, proposed for explicit acceptance at final release. This label does not mean the user has already accepted an unmentioned risk.

## 2. Authentication and account boundary

| Question | Status | Evidence / decision |
| --- | --- | --- |
| Is the configured audience limited to the two adults? | Verified | Native custom access policy: owner + external viewer, zero editors/groups. Application membership is an additional boundary. Does not attest every provider ingress path. |
| Is identity forwarded by the platform? | Verified (documented contract) | Sites guidance describes forwarded authenticated email; platform identity guidance specifies stable per-Site IDs. Sign-in routes belong to dispatch, not application OAuth code. |
| Are client-supplied identity headers always stripped/replaced? | Requires provider confirmation (Q1) | The Worker trusts these headers. Direct handler tests cannot prove ingress sanitization. No signed identity assertion is independently verified by application code. |
| Can a direct Worker/alternate origin bypass dispatch? | Requires provider confirmation (Q1) | No direct provider URL or route configuration is exposed. Exact-origin checks reject ordinary alternate URLs but are not proof against infrastructure rewriting the URL. No route guessing/scanning performed. |
| Do service/bypass tokens confer an adult identity? | Verified (documented contract); enforcement requires Q1 | Platform guidance says service tokens are consumed by dispatch and do not supply visitor identity. Application tests deny requests without adult identity. No bypass token was minted or used in this investigation. |
| Are app tokens reusable as another adult? | Verified at application layer | Prior tests bind token digest to stable actor ID, expire/revoke it, and bind action proofs to actor/token/action. A stolen valid token can still fetch that actor's ciphertext until expiry; it cannot alone decrypt records or answer private-key challenges. |
| Are IDs stable across an email change/account replacement? | Requires provider confirmation (Q1) | Per-Site ID stability is documented generally; email-change and external-invite migration semantics are not. The app also checks an explicit email allowlist: a legitimate changed email currently fails closed until configuration is deliberately updated. No configuration change was made. |
| Can a new ID silently become an existing adult? | Verified at application layer, conditional on trusted ingress | Owner ID is pinned. New code atomically prevents a second secondary ID once one exists. This prevents accidental replacement; it does not authenticate spoofed infrastructure headers. |

Earlier unauthenticated probes returned 403/error 1010 through the execution network. They did not establish which layer rejected the request and are not evidence of header stripping or origin isolation. No additional probe was made merely to repeat that inconclusive result.

## 3. Database, administrators, logging and deletion

| Question | Status | Evidence / decision |
| --- | --- | --- |
| Separate application storage namespaces? | Verified | Different projects/origins and disjoint live schema overviews. Vault manifest declares D1 only, no file binding, connectors or ordinary Homebase endpoint. |
| Exact resource IDs and cross-project IAM isolation? | Requires provider confirmation (Q2) | Tools do not expose actual Cloudflare account/database IDs, binding credentials or IAM policy. Namespace separation alone does not prove infrastructure isolation. |
| Can Site editors read records/deploy new frontend code? | Verified (published contract) | OpenAI documents editor database access and ability to publish code using runtime secrets/storage. No extra editors are configured. Ciphertext access is different from plaintext access; malicious code can capture passwords on a future unlock. |
| Provider/support/admin privileges and their controls? | Requires provider confirmation (Q2) | General confidentiality/security obligations exist in the Sites DPA. Exact managed Sites role access, approval/audit controls and troubleshooting capture are not exposed. |
| Does provider history exist? | Verified as general D1 behavior | D1 production Time Travel is documented as always on. Published limits: Free 7 days, Paid 30 days. This is not an application backup feature. |
| Actual history/snapshot duration for this managed Site? | Requires provider confirmation (Q3) | Plan, backend history configuration, additional snapshots and replica/deletion behavior are not visible. Do not assume either 7 or 30 days for this specific database. |
| Are active records and key envelopes erased? | Verified in synthetic tests of new code | Transaction deletes active records, wrapped family keys, member credential envelopes, sessions, action proofs and current authorized request. Owner identity binding remains. Historical provider copies and ignored legacy request metadata are not covered by this active-row guarantee. |
| Can deleted old key envelopes remain in history? | Accepted limitation | Yes, assume ciphertext and password-wrapped key envelopes can persist together. Offline guessing of a historical weak password remains possible. Live-key deletion is not guaranteed cryptographic erasure of provider history. No instant purge promise is made. |
| Are request bodies/auth headers logged anywhere by hosting? | Requires provider confirmation (Q3) | Source has no sensitive logging and sends encrypted record fields. That does not establish ingress/diagnostic log contents or retention. Random short-lived action responses and bearer tokens also merit redaction. No logs were fetched that could unnecessarily expose request data. |
| What does whole-Site deletion do? | Verified (product behavior); physical timelines require Q3 | Help documentation says deleting a Site removes it and cannot be undone through Sites. Sites DPA §2.11 addresses deletion/return after agreement termination with legal-retention exceptions; it is not a Site-specific purge SLA. Deleting the demo to test physical retention was neither necessary nor authorized. |

Keeping original documents in a physical safe makes loss of the convenience copy acceptable. It does not reduce the identity-theft impact of a plaintext leak. No backups, password recovery or selective key rotation are added by this investigation.

## 4. Frontend and deployment integrity

| Property | Status | Evidence / safeguard |
| --- | --- | --- |
| Branch generated Worker matches branch source? | Verified | Regenerated `worker/index.js` in place; SHA-256 before/after identical: `ad7dae1e96c310fb9c40c5bbb4ae5e6dacba74ab67b3d1ee1d3544aca78f36d0`. Local production build and artifact validation passed. |
| Retained v3 Worker matches v3 source commit? | Verified locally | Worker extracted from retained archive byte-equals `git show 3dada…:worker/index.js`; Worker SHA-256 `5a9ce52d1b108c27ab3c351b8cbc135cc272a0016a2aca481d6884111d66342f`. |
| Saved release has source/archive/deployment provenance? | Verified (native metadata) | v3 is tied to that source revision, archive metadata and successful deployment ID. The archive reports five files. |
| Independently verified platform content hash / served bytes? | Requires provider confirmation (Q2) | Stored archive hash is `e9e0b46f5d09c5968987aa4e6ce15ce4575b94a3a18e9c95cd243de15dc43c50`. Neither raw local gzip hash nor uncompressed-tar hash matches; the platform's hash/canonicalization algorithm is undocumented. Do not call this a successful cryptographic attestation or evidence of tampering. No authenticated served-JavaScript comparison was completed. |
| Runtime dependencies/remote scripts controlled? | Verified for vault source | Browser code uses local modules and native Web Crypto; generated Worker is self-contained. No CDN scripts, third-party crypto packages, analytics or new dependency were added. Bundler uses Node standard library; build copies generated output. Ordinary Homebase dependencies are not shipped in this standalone vault Worker. |
| Can unauthorized frontend changes be ruled out? | Accepted limitation | No web-delivered client can independently protect an unlocked secret against a malicious deployer. Owner account, source access, host and device are trusted. Keep editors at zero and owner sign-in protected by MFA; check the release commit before approving each publication. MFA configuration was not inspected. |
| Is ordinary Homebase prevented from reading unlocked content? | Verified design boundary; infrastructure part requires Q2 | Separate origin, no iframe integration/bridge, no vault MCP and no ordinary Homebase credentials. Future Family entry should navigate top-level to the separate origin, not import its crypto/UI into ordinary Homebase's origin. |
| What can remix duplicate? | Requires provider confirmation (Q2) | `remix_enabled=true`. Ask whether source, database data, runtime configuration or grants are copied and who can invoke it for a private Site. No remix was attempted. Disable if available before real data unless provider confirms safe source-only semantics; no setting changed here. |

Practical safeguards: retain the separate project/origin; keep only the existing owner able to publish; use strong independent vault passphrases and account MFA; retain commit/asset hashes in the PR; avoid external scripts; require approval for updates. An immutable external verifier, enterprise SIEM, paid signing service or new secrets platform is not required for this household decision.

## 5. Permitted data scope

Terms §3.3 explicitly prohibits PHI as defined there and PCI data (with its specified third-party payment-provider exception). It treats other sensitive personal data separately, subject to applicable privacy obligations. The terms do not explicitly name SSNs/passports as a blanket prohibited category. Encryption does not exempt a prohibited category. This is a reading of published scope, not a legal-compliance certification.

| Intended type | Status | Boundary |
| --- | --- | --- |
| SSNs | Verified: not explicitly blanket-banned by cited terms | Highly sensitive identity data; rights/consent/security obligations still apply. Ask Q4 for a product-specific confirmation before real-data enablement. |
| Passport numbers | Verified: same terms distinction | Text reference only; no scans, travel-document image upload or payment details. |
| Birth certificate reference numbers | Verified: same terms distinction | Parent-managed reference, not a service for children to use. Do not infer that parent recordkeeping is a child-targeted app. |
| Insurance identifiers | Requires provider confirmation (Q4) for scope | Auto/home/life policy reference is different from health/claims information. Keep clinical details, health claims and PHI out. Insurance information is not automatically PHI in every context; this prototype should not make that determination on freeform notes. |
| Other family identification text | Accepted limitation: narrow purpose required | Do not treat Custom/Notes as authorization for unrestricted secret categories. Limit to ordinary convenience-copy identification references after approval. |
| Medical records/PHI and payment-card data | Verified restriction | Exclude. This vault implements no payment-provider exception and must not rely on encryption as permission. |

No new content filters were implemented because real-data entry remains disabled. Before any release, make the narrow allowed scope clear in the UI and retain the text-only/no-document restriction.

## 6. Provider request — ready to send, NOT sent

No official support-submission connector is available in this session. Use the chat bubble at **https://help.openai.com/**, as described at https://help.openai.com/en/articles/6614161-how-can-i-contact-support . The owner may add account details privately there. No need to provide passwords, keys, real identifiers, ciphertext, full logs or contact data.

**Subject: Private Sites encrypted identifier vault — ingress, storage and retention assurances**

I own a private, synthetic-only two-adult Family Vault prototype at https://homebase-vault-demo.carl-jeff.chatgpt.site . No real identifiers are enabled. Browser Web Crypto encrypts fields before upload; passwords/private keys stay local. The latest repository change adds short-lived per-adult private-key challenges for destructive actions, so a fresh identity-provider/MFA endpoint is no longer needed to implement that safeguard. Please confirm these remaining hosting questions:

**Q1 — Identity and routes:** Are inbound `oai-authenticated-user-id` and email headers stripped/replaced on every route, including service-token/bypass requests? Can any Worker/provider/alternate origin reach the application without that trusted dispatch? What identity do service tokens supply? Does a user's stable Site ID survive an email change, and how are external invitation/account replacements handled?

**Q2 — Isolation and delivery:** Please confirm that this Site's D1 resource and runtime bindings are separate from other Sites under my account and cannot be accessed by another project's Worker. What owner/editor/support/provider roles can inspect ciphertext, change code or use secrets? Can the private viewer remix the Site, and does remix copy database data, grants or runtime values? What does the saved archive `content_hash` hash/canonicalize, and is there a supported way to verify deployed frontend bytes against the saved artifact?

**Q3 — Retention and logging:** What are the actual history/snapshot/replica retention windows for this managed D1 database, including deleted password-wrapped key envelopes? What is deleted after row erase versus whole-Site deletion, on what timeline, with what exceptions? Are request bodies, authorization headers or diagnostics captured, how are they redacted and retained, and who can access them? General ChatGPT conversation retention is not the answer needed for hosted Site data.

**Q4 — Allowed scope:** Please confirm support for an encrypted-only, private adult-managed convenience copy of SSNs, passports, birth-certificate references and ordinary non-health insurance policy numbers, excluding PHI, medical/claim information, PCI data and document uploads. We understand encryption does not override restrictions. Please clarify the insurance boundary if needed.

Please link authoritative documentation or provide a written product-specific response. I am not asking to create a paid service, change authentication/sharing, or upload sensitive information.

## 7. Synthetic-device validation plan

Prepared, **not deployed**. Build output is ready locally; source remains the reviewed hardening branch. Publishing needs separate approval and exact source/artifact packaging through the normal workflow. Do not ship the unrelated Mac app-guard branch. The only new migration is schema-only `0002_action_proofs`; it preserves existing test records/wrapped keys. Old unproved erase requests are ignored. No live Homebase change is needed.

After approval, deploy only the existing separate demo project, preserve the two-person audience and runtime adult configuration, then record saved version/source/deployment IDs and compare served local assets with the approved build where a signed-in browser permits. Keep the DEMO input restriction. If any provider prerequisite fails, stop real-data planning; synthetic functional testing can still continue.

Use two separate signed-in browser sessions and disposable test passphrases. Neither adult should reveal their password to the other. Use existing fake records or clearly synthetic new records. Log only pass/fail and timestamps.

1. **Unlock independently:** each opens the same demo with their own login/passphrase. Wrong passphrase fails without resetting records. Confirm both see one shared fake record, initially masked.
2. **First-adult action key:** Jeff unlocks, selects Request action-key approval in Shared access and enters his existing test passphrase. Verify pending action-key fingerprint with that password; send/compare the fingerprint with Lindsay outside the demo.
3. **Approve fingerprint:** Lindsay unlocks and approves with the independently received fingerprint and her own password. First try a deliberately incorrect fingerprint: approval must fail. Re-unlock and approve the exact one. Jeff unlocks again. Existing fake records should be unchanged.
4. **Delete one fake record:** request deletion, first enter a wrong password: nothing is deleted and the view locks. Re-unlock and delete using the correct password. Both sessions should show the deletion after refresh. Do not use a record whose test contents need preserving.
5. **Concurrent edit:** open one remaining fake record in both sessions; Jeff saves a change, then Lindsay tries to save her stale version. Lindsay should receive a conflict/lock, not overwrite silently. Re-unlock to see Jeff's version and then edit intentionally.
6. **Locking:** on each device, background/return and confirm locked; leave untouched for two minutes; separately keep interacting for ten minutes and confirm absolute lock. Do not rely on a mobile tab timer while it is suspended. Check visible forms clear on return.
7. **Cancelled erase:** Jeff opens Start over, enters the required phrase and his password to authorize a request. It must not erase. Cancel it; Lindsay must not be able to complete that cancelled request. If the visible UI makes a new request, cancel that too rather than treating a newly created request as the old one.
8. **Whole erase — only after agreeing to lose the synthetic records:** one adult authorizes the request; that adult cannot self-confirm it. The other adult separately unlocks, enters the phrase and their own password and confirms. Check both sessions lock and first adult must initialize anew. No need to perform destructive steps merely to inspect a deployment.
9. **Expiry/retry:** authorize an erase request, let it expire (over ten minutes), then verify the other adult cannot complete the old request. The UI may start a new request; distinguish its new ID/time and cancel it. For network failure, reconnect, lock/unlock and inspect state before retrying. A fresh proof is needed; do not resend captured requests manually. In-memory adversarial tests already cover simultaneous proof reuse and transactional interruption; no network manipulation tooling is required on iPad.

Stop and report a discrepancy. Do not attempt real identifiers to test whether the synthetic restriction can be bypassed. The previous user-confirmed sharing/background tests apply to v3 only; the latest enrollment/proof flow still needs this plan.

## 8. Findings and release decision

No new exploitable application vulnerability was confirmed in this hosting-only pass. New observations are the unverified remix semantics and incomplete host artifact attestation; neither proves a leak or code substitution. The previously fixed source issues were not retested as an excuse to expand this investigation.

### Mandatory before real data

- Obtain satisfactory Q1 ingress/identity and Q2 isolation/privilege answers, or choose a separately approved host with those documented guarantees. A denied probe is not sufficient.
- Complete the separate source/protocol review already underway; resolve any high-impact findings. Do not label a model review an independent professional audit. Hiring a paid auditor is not automatically required for this small family use.
- Approve the synthetic-demo-only deployment, complete the device plan on the exact hardened release, and record release provenance. No merge or production approval is implied.
- Establish the permitted narrow data scope and make an informed owner decision on provider logging/history/deletion limits (Q3/Q4). An unknown physical purge date may be explicitly accepted; it must not be advertised as instant erasure. PHI/PCI exclusions are not waivable by application consent.
- Explicitly approve any later real-data enablement and production integration as a separate action.

### Optional improvements / accepted limits

No backup, password recovery, document storage, separate per-profile secrecy, selective key revocation or external rollback witness is required by the chosen scope. Keep owner account MFA, unique strong passphrases, device screen locks and zero extra Site editors. A paid independent audit is additional assurance, not a substitute for platform answers. Disable remix if supported and semantics remain unclear; do not add another infrastructure service just for it. Accept that JavaScript cannot erase clipboard copies, screenshots or physical memory, and that a trusted deployer or compromised device can steal unlocked data.

## 9. Qualitative disclosure risk

The overall deployment risk is **not yet sufficiently characterized** to recommend real data. No defensible numerical probability can be calculated: we lack ingress attestations, actual log/retention settings, account/MFA/device posture, deployment-access audit history, reviewer findings, attack exposure/incident rates and a defined observation period. A percentage would create false precision.

| Scenario | Qualitative likelihood and assumptions | Plaintext impact |
| --- | --- | --- |
| Random internet request without account access | Expected low if dispatch and origin isolation work as documented; actual boundary still awaits Q1. App crypto does not make unverified infrastructure safe by assumption. | High if a chain ultimately steals an unlocked key; identity spoofing alone exposes ciphertext/denial-of-service opportunities, not automatic decryption. |
| Stolen encrypted database/history only | Expected low disclosure likelihood with genuinely strong independent random passphrases and correct crypto; much higher/indeterminate for predictable/reused passwords. Attackers get offline guessing opportunities against historical wrappers. | High: shared family key can expose all records once either credential is cracked. |
| Stolen Homebase/ChatGPT session only | Limited by separate vault unlock and per-adult action proof. It can expose ciphertext or enable other abuse; it is not a decryption key. Provider identity behavior still matters. | Conditional high if combined with password capture, weak-password guessing or malicious frontend delivery. |
| Compromised owner/deployer or malicious served frontend | Likelihood unknown without account/deployment controls. Conditional exposure is high when a victim next unlocks: the attacker can change the code that receives the password. | High; client encryption does not defeat its own malicious frontend. |
| Lost locked iPhone/iPad | Depends on screen lock, OS/browser security and cached copies; those were not inspected. Background locking reduces opportunistic viewing. | High if device is compromised or copied clipboard/screenshots remain accessible. |
| Compromised/unlocked device, malicious extension, or an adult sharing credentials | Conditional exposure is high; outside the app's ability to guarantee prevention. | High. Physical originals being available does not undo a disclosure. |

**Smallest next actions:** send the single support request; finish the already-running code review; approve and run one synthetic-device validation release; then explicitly accept the listed residual limits and decide whether to enable real identifiers. No additional feature development or repeated review cycle is justified solely because provider answers are pending.

## References checked

- Sites identity contract supplied with the platform tooling (request identity, stable per-Site IDs, identity-less service access).
- https://learn.chatgpt.com/docs/sites/data-and-connections
- https://help.openai.com/en/articles/20001337-understanding-responsibilities-for-your-chatgpt-sites
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://learn.chatgpt.com/docs/enterprise/sites
- https://openai.com/policies/chatgpt-sites-terms/ (§3.3)
- https://openai.com/policies/chatgpt-sites-data-processing-addendum/ (§2.11)
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/platform/limits/
- https://help.openai.com/en/articles/6614161-how-can-i-contact-support
