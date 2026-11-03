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

## Guided shopping and link-first editing

The prepared handoff now shows one product at a time with package count, size, notes and optional price limit. Open in Walmart opens the exact saved link. Reviewed → Next records only the shopper's review, Skip leaves an item for later, Previous allows revisiting, and the end screen links to the first skipped item and Walmart cart. The underlying grocery review is hidden during guided shopping; Edit shopping list returns to it. No cart contents are read or written.

Reviewed/skipped position is saved in this browser. After reload, use Resume saved shopping trip to restore the prepared selection/counts and current item. Restoration rechecks the grocery-list identity and the current product/quantity snapshot. Changed products or counts require a fresh review; new generated grocery IDs start a different trip. Start guided shopping explicitly starts new progress. Browser storage failures are reported without blocking manual product links. Trip progress is device-local; household product links remain durable and shared.

The product editor now starts with the Walmart URL. When a valid product URL contains a readable title slug and the product name is empty, it suggests a name. Suggest name from link can explicitly replace an existing name. Numeric-only URLs yield no guess. Suggestions are unverified and require user review before household save. Brand, size, nutrition, price and stock are not fetched or inferred from the URL; this version makes no requests to Walmart pages. Unsupported page extraction is not a prerequisite for the shopping flow.

Validation includes React DOM tests of next/skip/previous-style navigation, remount restoration and stale-trip rejection; URL suggestion tests, corrupt-storage handling, household catalog regression tests, TypeScript, focused lint and production build. These are synthetic DOM checks, not real mobile browser or Walmart-cart verification. Managed browser preview remains unavailable in this environment.

## Package-count suggestions and fuzzy saved-product matching

Saved products can optionally include the total amount and unit in one purchasable package. Enter both or neither (for example 64 fl oz per half-gallon milk carton). Existing records remain valid without these fields and are not rewritten. Compatible US-volume, mass and explicit item-count units convert within their own dimensions; ounce weight is never treated as fluid-ounce volume. Counts round up to whole packages, capped at the existing 99-package limit. Unknown/zero quantities, unsupported grocery units, incompatible dimensions and missing package metadata produce no automatic suggestion. Existing usual counts remain a separate option. Use suggestion or Use suggested package counts explicitly applies the calculation for review; it does not alter grocery needs or purchase status.

For groceries with no exact normalized saved-name match, up to three similar existing household products can be offered for confirmation. Matching normalizes punctuation, plural wording, almondmilk/almond milk and conservative single-character spelling differences. Distinct milk bases and explicit unsweetened/gluten-free/dairy-free/vegan requirements are guarded against conflicting or unverified suggestions. This is not an allergy classifier or a nutrition guarantee. No fuzzy candidate is auto-selected, even when only one exists. Product name and size are visible alongside the original saved grocery wording.

Use this product for [grocery] saves a new explicit household preference under that wording with the existing product link and settings. Future occurrences of that wording then match exactly. This is a separate preference, so later edits to one grocery's choice do not silently update other names' choices. Concurrent saves still use deterministic-key conflict protection. Two selected rows targeting the same product continue to require manual consolidation; fuzzy matching does not bypass duplicate attention.

Tests cover conversion boundaries, rounding, unknown quantities, weight/volume mismatches, qualifier conflicts, spelling, multiple candidates, explicit UI approval/application and shared persistence of approved mappings/conversion metadata. Guided shopping, resume state and existing household data behavior are preserved. No Walmart data is fetched and no cart action or checkout is performed.

## One shopping tab

Normal clicks on product, search, suggestion-check and cart links now use a shared caller-held Walmart tab reference during the current Homebase page session. Before navigating a newly created blank tab to Walmart, Homebase clears its opener, preserving protection against Walmart navigating back into Homebase. Subsequent clicks navigate that same reference without reading its page or accessing account data. Modified clicks (Command/Ctrl/Shift) and JavaScript-disabled links retain normal browser behavior.

Popup blocking, a closed tab, or browser/Walmart isolation may prevent reuse. Homebase then stops creating automatic additional tabs and shows explicit options to open a new shopping tab or open the link in the current tab. Guided trips remain resumable on returning. Reuse is not guaranteed across a Homebase reload, browser restart, independent Homebase tabs or cross-origin isolation. Safari/iOS may also control tab focus. No iframe, account access, cart modification, new permissions or weakening of opener protections is introduced.

Tests exercise first open, product-to-product navigation, search/cart reuse, popup blocking, closed/severed references and the actual guided-link click handlers. Real Safari/Chrome behavior still needs device verification; the synthetic tests establish application behavior, not a universal two-tab guarantee.
