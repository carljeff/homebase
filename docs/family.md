# Private Family profiles and wishlists

Profiles (`kind: family`) and gift ideas (`kind: wishlist`) use the existing private D1 `records` table. No household names, birthdays, sizes, wishlist links, or gift content is seeded in application source or migrations. Initial profiles are created privately through the authenticated API. Unknown details stay blank. Names are unique case-insensitively; stable name-derived UUIDs and a partial unique index prevent duplicate creation. Profiles are edited rather than deleted so linked wishlists are retained.

## Interface

Family cards open About, Wishlist, and Important dates tabs. An emoji or initials can be used as an optional avatar; no remote avatar fetch or public image URL is required. Profile editing supports birthday, interests, favorites, sizes, personal notes, Amazon wishlist URL, and dates with optional reminders and annual recurrence. Birthdays and upcoming dates appear on the dashboard. Reminder dates are in-app only, not scheduled notifications.

Gift ideas support HTTPS product links, notes, priority, purchase status, and surprise visibility. `source` (manual/amazon) and `externalId` reserve space for a future approved import; no Amazon account integration or scraping runs today. Original external links open only on explicit navigation.

## Server-enforced surprise privacy

A surprise item (default) is visible and editable **only to the authenticated account that created it**, before and after purchase. The entire record is filtered from API and connector reads for all other accounts, including other parents. Direct edits and deletes also check this rule. Author IDs are assigned server-side and immutable; recipient profile IDs cannot be changed after creation. Optimistic version checks prevent overwriting newer changes.

Shared items (`surprise:false`) and their notes and purchase status are visible/editable to every authorized household account, including any future recipient with access. The form explains this before saving. Surprise protection intentionally does not guess a profile's account or rely on a display name. A person who created an item already knows it; creating an item does not hide it from its own author. This conservative model avoids accidentally revealing another person's gifts until explicit recipient-account linking and trusted co-giver permissions are designed.

Sites still enforces the existing private audience; app and MCP routes require verified identity. App/MCP responses use `Cache-Control: no-store`. No public data endpoints, external AI service, client local-storage persistence, or publicly embedded family data is added. Site owners/administrators and database operators retain infrastructure-level access.

## Connector/API

`homebase_list` returns family profiles and only wishlist records visible to the caller. `homebase_write` supports `action:save`, `kind:family|wishlist`; updates require `id` and current `version` from list. The server's MCP schema documents fields. A generated client may need its tool schema refreshed after publication.

Family fields: name, role (parent/child/other), avatar, birthday (YYYY-MM-DD or empty), interests, favorites, clothingSizes, shoeSize, amazonWishlistUrl, notes, dates [{id UUID,title,date,annual,reminder,notes}]. Wishlist fields: profileId UUID, title, url, notes, priority (low/medium/high), purchased, surprise, source, externalId. Do not supply or transfer creatorId: the server assigns it.

For an idempotent private initial setup, the existing connector also accepts `action:save, kind:settings, data:{familyOperation:{action:ensure_profiles,profiles:[...]}}`. This is a command envelope and does not create or replace household settings. It skips existing case-insensitive names without overwriting their details. HTTP clients can use `action:ensure_family, profiles:[...]` instead. Never put a real setup payload in this public repository.
