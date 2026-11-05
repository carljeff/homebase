# Private hosted Homebase Vault Demo

Synthetic text only. User-approved separate browser demo; **not the live Homebase application**. No real identifiers, documents, uploads, Bitwarden connection or ordinary Homebase API/MCP access. This dedicated origin contains only vault code and a fake-family selector; it does not embed in live Homebase. Framing is deliberately denied. Live Family-tab integration and Safari cross-origin frame behavior remain untested.

## Tester instructions

1. Open the private demo URL with your own ChatGPT sign-in. No terminal membership code is required.
2. Choose a disposable TEST passphrase of at least 16 characters, tick first-use initialization and unlock. Never use an existing real password. For later unlocks, use the same passphrase without initialization.
3. Choose a fake family member. Add a test record using the provided DEMO: defaults. Create/edit/reveal/hide/copy/delete are functional. Identifier values are limited to three digits and test dates to 2099. Do not enter real sensitive details anywhere.
4. Background/leave the page or wait two minutes idle to verify locking. Server access sessions also expire after two minutes idle, with a ten-minute absolute cap.
5. Encrypted test data persists in this demo's separate D1 database across reloads. If you forget the TEST passphrase, use **Start over — erase test data**. This irreversibly resets this tester's demo and invalidates its sessions; it is not a recovery mechanism. Encrypted export exists; import/recovery remains disabled.

## Boundaries and access

The Site must remain **owner-private**. Dispatch provides trusted visitor identity; the Worker rejects missing ID/email, including service-bypass requests without identity. No application credentials or keys are configured. API login accepts only `{}`; vault passphrases never leave the client. A random short-lived bearer session is held in browser memory; only its hash, visitor ID and expiry are stored server-side. Every database operation is scoped to the authenticated visitor. This is private single-tester isolation, **not Jeff/Lindsay shared cryptographic membership**. Do not widen the Site audience to simulate completed two-adult enrollment.

All titles, categories, identifiers, expiration values, notes and location text are AES-GCM encrypted in the browser before upload. Key wrapping uses the existing PBKDF2/Web Crypto prototype, 600,000 iterations, with fresh random salts/nonces and non-extractable unwrapped keys. Context authentication binds vault/profile/record/revision. The server stores wrapped key configuration and ciphertext envelopes, never vault passphrases/keys/record plaintext. Headers and SQL/session IDs are operational metadata, not encrypted by this layer. There are no request-body logs or analytics. Ordinary browser storage is not used for vault secrets; private Site authentication uses the platform's cookies. No secrets are stored in the source manifest.

The dedicated origin uses a restrictive CSP, no CORS, no embedding, exact-origin writes, bounded streaming request sizes and per-visitor quotas. Session/config checks also guard inserts against a reset/lock race. These controls do not make browser-delivered code immune to a compromised vault deployment, extension or device. JavaScript cannot guarantee secure erasure. Clipboard copies/downloads remain outside vault control.

## Code and validation

`vault/` contains the browser-only client and crypto; `worker/handler.mjs` is the ciphertext transport; `scripts/bundle.mjs` deterministically generates the single-file Worker, including its private static assets; `drizzle/` is schema-only migration for this demo's own database. `.openai/hosting.json` identifies this demo alone. Never copy the production Homebase project ID, bindings, runtime credentials or data into this checkout.

Run `node scripts/bundle.mjs`, `node --test tests.mjs`, `bash scripts/build.sh`, `node scripts/validate-artifact.mjs`. The unchanged local prototype's seven tests and 169-test Homebase suite remain the baseline; hosted tests separately cover visitor/session identity, service-token rejection, cross-visitor isolation, ciphertext request/response/database canaries, strict fields, tampering, revision/delete/reset, expiry, CSP/no-store/CORS and passphrase-local source contracts.

Not an independent security audit. Second-adult enrollment, trusted membership changes, key rotation, offline recovery/import, durable backup/restore guarantees, ingress bypass testing and real mobile/browser verification remain incomplete. This deployment is authorized for synthetic browser testing only; real sensitive data and changes to live Homebase still require separate approval.
