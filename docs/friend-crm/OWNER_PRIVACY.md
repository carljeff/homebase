# Publication status

Deployed with approval as Homebase v21 on November 4, 2026. The owner enrolled successfully through the authenticated Homebase connector, and existing Friends records exactly matched the predeployment baseline. Household audience, relay audience, Mac pairing, keys, mappings and schedule were unchanged. Actual other-account sign-in was not performed; denial checks use synthetic owner/other-account identities across the real handlers and components.

# Friends: one private owner

The Friends feature is now restricted to one configured Site owner. Other household adults retain shared Kitchen, recipes, groceries, projects, Family, settings and their existing wishlist privacy behavior, but do not receive Friends records, source labels, activity snapshots or collector management access.

## Owner identity and enrollment

`FRIENDS_OWNER_EMAIL` is a protected server runtime setting, provisioned from the Site owner's verified access configuration. It is never embedded in client code, hosting manifests, GitHub or the Mac configuration. The first authenticated page/API/MCP request with that verified platform email binds the stable **Site visitor ID** into a dedicated `friends_access` policy row. Account/workspace IDs are not guessed or substituted for the Site visitor ID. Another ID cannot replace this enrollment, even with a matching email. Later authorization uses the bound Site ID; the stored email digest also ties the policy to the configured enrollment setting. Missing/invalid configuration or an unbound policy denies Friends access.

The new additive schema migration creates only the policy table. It does not rewrite/delete Friend records, timestamps, versions, notes, contact mappings, source snapshots, sequence counters, signing keys or other household data. Existing Friends are treated as the private owner's legacy records. Only sources whose owner matches the policy can upload or return status. Other source rows are retained but inaccessible/inactive through these APIs.

## Enforced boundaries

- Record store: Friends are excluded by default from ordinary lists; only an explicit authorized owner ID can include them. Create/update/delete also enforce the owner check, including direct store use and forged generic API operations. Other record kinds retain existing behavior.
- Page/dashboard: the server derives the Friends capability from authenticated identity. Desktop and mobile navigation omit Friends for other visitors, and its component is not rendered for them. A client-modified capability flag cannot authorize any API operation.
- Browser APIs: generic Homebase results filter Friends; unauthorized Friend CRUD and all CRM status/device/manual-import operations are rejected. They never return snapshots or source metadata to another account.
- ChatGPT/MCP: shared lists use the same store/dispatcher checks. Non-owner tool metadata removes the Friend write option and fields. Forged calls remain denied even if a client cached an older schema.
- Relay: existing signed intake and contact-discovery/creation routes independently verify that the enabled device's owner matches the policy before using private records. Possession of a previously issued non-owner device key cannot bypass this policy. Homebase's household audience and the relay's approved public audience are unchanged.

The Mac's existing key/configuration and launchd job require no changes. On initial deployment an upload arriving before owner enrollment can be rejected and remain pending; the owner's normal Homebase page/API/ChatGPT access completes enrollment, after which the unchanged retry succeeds. The deployment workflow verifies the owner's existing records through the authenticated Homebase connector. Refreshing Homebase also initializes the policy if needed.

## Verification

Synthetic tests cover missing configuration, wrong-email enrollment, stable-ID binding/takeover prevention, preservation of legacy records and sequence, filtered shared lists, denied CRUD and kind/ID forgery, browser API status codes, MCP schema/results/forged calls, actual server page capability and desktop/mobile navigation, collector status/management, manual imports, signed activity upload/retries and signed contact roster access. Shared household feature regression tests remain in the full suite. No second person's credentials or personal account are used for these checks.

For a live check, the owner should see Friends with a **Private to you** badge after refreshing. An independently signed-in other household account should have no Friends tab or Friends records in API/MCP output. Do not share keys or switch credentials through chat to perform this check.

## Maintenance, future expansion and rollback

Do not remove another household adult's access to the whole Site to hide Friends; keep the feature policy separate from household sharing. Do not manually change the bound ID or runtime email simply to add a second user: existing Friends must remain private to their current owner.

A future private Friends space for another adult can be added through a deliberate per-record owner migration using the bound legacy owner ID as provenance. It must not expose this owner's existing contacts or activity to that adult. This update intentionally does not implement that expansion.

For a fail-closed pause, retain this gated build and remove/disable its owner enrollment configuration through supported runtime tools; Friends becomes unavailable while shared household features remain. Restoring an older pre-privacy application build would restore household-wide Friends visibility and is **not** a privacy-preserving rollback. Keep the additive policy table on code rollback; avoid destructive down-migrations. Never reset the Mac's cursor or revoke its signing key just to correct the Friends policy.
