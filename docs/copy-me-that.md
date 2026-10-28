# Private Copy Me That imports

## Storage and authorization

The existing Sites D1 database stores `imported_recipes`: stable import identity, immutable current imported source, source hash, household override JSON, image hash and optimistic version. Imported source content (including original recipe HTML) is **runtime data**, never a migration, asset, build input or repository fixture. Ordinary application responses omit raw HTML. The UI renders text, never untrusted HTML.

Sites provisions the `BUCKET` R2 binding declared in `.openai/hosting.json`. Images use immutable SHA-256 object keys. No R2 public domain, public bucket or signed public URL is created. `/api/recipe-images/[hash]` first requires Sites-verified user identity, then verifies a live recipe references the object. It returns private/no-store and nosniff headers. Raw SVG/HTML uploads are rejected. Sites' private access allowlist authorizes household visitors before requests reach the Worker; every app/MCP/image route also checks identity. This is one private household per Site, not a multi-tenant database. Do not make the Site public. No separate repository, provider account or paid service is needed; hosted platform quotas and plan eligibility still apply.

All allowed visitors can edit the shared household. Adding the second household member still requires their verified ChatGPT sign-in email. GitHub access does not grant recipe access.

## Repeatable workflow

Kitchen → Recipes → Import ZIP. Choose a Copy Me That ZIP containing `recipes.html` and referenced images. The file is parsed on the device; only preview metadata/source records are sent to authenticated Homebase. The original ZIP is not uploaded or embedded into the app. A complete preview shows added, updated, unchanged, archived and potentially conflicting entries. Apply is a separate action. Imports run in batches of ten; interrupted imports can be safely resumed by choosing the ZIP and previewing again. Each record checks the version and source hash captured at preview; concurrent edits stop the stale import. Earlier successful batches remain saved, and re-preview identifies them as unchanged.

Limits: 32 MB ZIP, 64 MB total expanded, 8 MB per ZIP entry, 5 MB per image, 5,000 entries. JPEG, PNG, GIF and WebP are supported after signature validation. Traversal paths, missing image references, empty titles, ambiguous duplicate identities and unsupported images stop parsing before apply. Larger collections should be split into separate exports rather than silently dropping recipes.

## Matching and customization

Prefer a Copy Me That provider ID when exported; otherwise use normalized original source URL. Distinct entries sharing a source URL use URL plus title. Recipes without a source URL use normalized title. Original URLs and all original content remain separately preserved. Tracking query parameters and URL fragments do not affect identity. A title change for a title-only recipe, or a change in ambiguity of a shared source URL, can require manual reconciliation. The preview identifies weak matches. Recipes missing from a new export are not deleted.

Updates replace imported source beneath independent household overrides. Favorites, household cooking notes, substitutions, likes and overridden fields survive. The preview flags fields changed in both layers, preserving the household value. The cooking view exposes the current original source separately. “Use latest imported content” resets edited content fields after confirmation while keeping favorites, likes and household notes. Source notes are displayed separately from household notes. Hiding/deleting an imported recipe archives it; later imports report it as archived instead of resurrecting it.

Quantities are parsed conservatively for groceries, with original ingredient lines preserved. Unmeasured or range-based amounts are flagged for quantity review; original text is never replaced by a guessed amount. No unit conversion is performed. Unspecified serving counts use an explicitly marked planning default until edited; absent cooking times remain unspecified. Original headings and text remain visible in the original-source view.

## Authorized agent/CLI workflow

Use the generated Homebase plugin, separately authenticated from GitHub. `homebase_write` keeps its existing `action:"import_recipes"` contract with `data:{format:"copymethat",mode:"preview"|"apply"}` and `recipes:[{source,...}]`. Preview returns versions and hashes; apply must send those exact values plus imageBase64 when an image is not yet stored. Maximum ten entries per call. `mode:"audit"` checks up to twenty private images per call using `data.offset`, reporting counts and the next offset, without returning image bytes or the catalog. `mode:"reset"` accepts current id/version and fields to reset.

For local preparation, run `node --experimental-strip-types scripts/prepare-cmt-import.ts /outside/source/export.zip /outside/source/private-imports`. It refuses input/output inside the source checkout, emits private batches with owner-only file permissions, and prints counts only. Send these through the authorized plugin; do not commit or upload them as source. Remove temporary private batches when finished. Public tests contain synthetic examples only.

## Verification

Run `node --experimental-strip-types --test tests/*.test.ts`, TypeScript and the production build. Tests cover export structure (including DIV ingredients), stable identity, source hashing, household/source conflict preservation, raw quantities, malicious paths, unsupported images and duplicates. Check production unauthenticated recipe/image/MCP endpoints deny access, then audit private image existence through the authenticated plugin. Verify both household users before adding other sensitive family information.
