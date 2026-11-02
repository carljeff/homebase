# Weekly Walmart shopping: shared saved-product handoff

This replaces the mock-shopping entry point in Homebase's grocery interface. It does not rely on the experimental Chrome helper. That helper can remain disabled; no installation is required for this flow.

## What works

Kitchen → Groceries → Send to Walmart opens a review of unchecked, non-pantry groceries (including staples and manually added items). Choose product opens an editor for the exact Walmart product URL, product name, brand, package size, usual package count, alternative product/link, substitution preference, optional price ceiling, household-entered saturated fat and notes. Search Walmart opens a normal Walmart search; no Walmart data is scraped. Save for household stores the approved choice using the existing authenticated API and shared D1 records. Both authorized adults can retrieve/edit it; refresh Homebase after another person changes it.

Saved choices are matched by normalized grocery name (case and whitespace), not by guessed fuzzy matches. A changed ingredient name may need a new choice. Old browser-local preferences are left untouched; when choosing a product with no shared record, an old local saved link/brand/size pre-fills the editor for explicit review and household save. Nothing is silently uploaded from browser storage.

Use usual package counts fills this trip's counts in one click, or enter counts individually. Counts never derive implicitly from recipe ounces/cups. Every included row needs a product and count before preparing the handoff. Missing matches and duplicate product IDs require attention; duplicate rows must be combined manually in the first row and excluded from the selection. No product is silently substituted for nutrition, price or availability. Popcorn reminds the shopper to prefer 0–1g saturated fat; entered nutrition is not claimed as independently verified.

Prepare shopping links freezes a ready list. Open each saved product, add the displayed packages in Walmart, and tick I reviewed this item in Walmart to track progress within the current handoff. Opening is never reported as a cart addition. Reviewing does not modify grocery purchase status. Copy prepared list includes package counts and exact links. Review Walmart cart opens Walmart's cart; all price, stock, store, fulfillment, substitutions and checkout decisions happen there. If the underlying list/product choices/counts change, stale prepared links are hidden until prepared again.

## Storage and authorization

New ordinary record kind: `walmart_product`. Fields are validated in `lib/walmart-catalog.ts` and persisted by `lib/walmart-store.ts` through the existing `/api/homebase` authenticated dispatcher. The existing signed-in household/site access and same-origin checks are preserved. No new account, key, payment information, credential or service is introduced. Household catalog data is ordinary shared data, not Vault content.

A deterministic SHA-256 key from the normalized grocery name prevents concurrent first saves from creating duplicate preferences. Edits use the existing optimistic version check. Stale writes fail with a Conflict message. Product key/name changes are rejected on update. Existing generic record storage requires no SQL migration. No existing recipes, meal plans, groceries, settings or private family records are rewritten by saving a product. Browser-local preferences and previous source/deployment versions are retained.

## Verification and limits

Automated tests cover the five named proof-of-concept groceries using synthetic products; explicit counts; duplicates; invalid URLs; exact preference matching; no silent substitutions; household read/edit visibility; concurrent creation; version conflicts; and preservation of unrelated settings and groceries. Existing regression tests are retained. TypeScript, focused lint and production builds are required before release. Old Chrome-helper tests remain regression tests only and are not evidence that Walmart automation works.

This release reduces repeated searching. It does not populate a real cart automatically, verify Walmart catalog information, enforce price ceilings, calculate estimated totals, or synchronize per-trip reviewed checkboxes across devices. Saved product preferences are shared; trip selection/counts/progress are session state. It does not clear/rebuild cart contents or initiate checkout. Do not call the original one-click goal complete until a real five-item weekly shopping trial demonstrates fewer steps. No real Walmart cart changes were made by this implementation.

## Next validation

On iPhone/iPad and Mac, save the actual products for unsweetened almond milk, Lemon Spindrift, keto bread, plantain chips and low-saturated-fat popcorn. Confirm brand/size, package counts and the preferred store on Walmart. On the second adult's device, refresh and verify the same saved choices appear. Time a five-item handoff and compare against manual searching. Actual cart addition is performed by the shopper. Future cart-population providers must be evaluated separately, remain modular and free unless approved, and demonstrate real end-to-end behavior before being offered as reliable automation.
