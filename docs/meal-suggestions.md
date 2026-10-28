# Private meal suggestions

## Architecture

The same authenticated API, D1 records table and private image routes are reused. No AI API, external data transfer, paid service, new database or credentials are required. The server computes suggestions from the private recipe catalog, effective household recipe edits, settings profile, current plans and explicitly confirmed cooking/feedback. Generic source code and synthetic tests are public; the household profile, recipes and history remain runtime database records. Do not add the actual profile or catalog as source fixtures.

## Experience

Tap a day or Add meal to open up to six suggestions. Cards show the saved photo, evidence-based reasons, saved cooking time when interpretable, substitutions and relevant uncertainty. Add goes straight to the selected day. Refresh excludes all previously shown recipe IDs in the current round, rather than reshuffling them; exhausting the pool offers an explicit new-round action. Strongly similar ingredient sets are not displayed together, so a narrow pool can yield fewer than six cards.

Browse all recipes retains the selected day, supports existing search/category/favorites controls, and exposes Add to meal plan on every recipe. The confirm screen defaults to that selected day and allows changing it. Replacing a recipe retains the previous recipe ID and resets the new selection to planned. Manual meals, leftovers, flexible nights and meals out remain available. Copying a week clears cooked/skipped outcomes; it never confirms cooking.

## Rules and uncertainty

Ranking balances favorites/name preferences, recent confirmed cooks and frequency, temporary feedback, selected-day/busy-day saved time, batch-cooking cues, protein preferences and ingredient/cuisine variety. A planned recipe is excluded from duplicate suggestions within that week, but historical plans are not treated as actual cooks. Repeated favorites lose ranking when cooked recently. Occasional favorites have a separate cooldown. Recent negative feedback is a bounded, temporary penalty; Not this week expires outside that week and never permanently hides a recipe.

Vegetarian-compatible eligibility checks ingredient lines. Enabled ground-beef and chicken rules preserve eligibility and annotate the suggested replacement. Other meat/seafood is not automatically treated as vegetarian-compatible. Existing explicitly plant-based ingredient lines are recognized. Avoided brands are filtered from suggestions, while the full library stays available. Enabled substitutions are saved with the meal and used when generating groceries; original recipes stay unchanged. Quantities still need review when changing products/units.

Legumes/soy and rich dairy/coconut are ingredient heuristics, not nutritional analyses. No grams, LDL effect or low-saturated-fat claim is invented. Unknown product-label saturated fat is shown as unknown. Saved substitute-label values can influence ranking relative to an editable preference. No full-recipe nutrition computation is performed. Missing or ambiguous times remain unspecified; multiple prep/cook durations are not blindly summed. Batch/leftover suitability is identified as a recipe-style estimate.

## Learning and corrections

`meal_event` records store delivered recommendation impressions, planned selections and standalone feedback/confirmed cooks. Recommendation impressions mean a set was returned to an opened picker, not proof that the user read every card. New planned selections use idempotent request IDs and a D1 batch for meal/event insertion. Feedback has request IDs to avoid duplicate records. Existing meals carry status planned/cooked/skipped/replaced, optional actual cook date, substitution snapshot and previous recipe IDs.

Only current meals explicitly marked cooked or active standalone cooked events contribute to confirmed cooking history. Recommendation, plan and rating events never imply cooking. Cooking dates cannot be future dates. Correcting the current outcome or deactivating/correcting feedback changes subsequent recommendations. History exposes these controls; recommendation/planned activity can be shown separately. Positive and negative ratings are available from the recipe view and do not confirm a cook.

## Editable profile / ChatGPT bridge

Kitchen Preferences → Edit household preferences exposes the structured food profile: preferred proteins, avoided brands, enjoyed/occasional name phrases, busy/batch weekdays (0=Sunday), cook-night/out targets, quick-time limit, rotation periods, heart-health priority and substitutions with optional product-label values. The profile can be imported as JSON, previewed in the editor and saved; current JSON can be displayed for copying into ChatGPT. Invalid ranges/rules are rejected by the server. The UI edits shared settings, not a browser-local preference.

There is no ChatGPT conversation-history integration declared for this Site, and no eligible conversation-history discovery capability is exposed in the current Sites tool surface. Authoring-time Personal Context can retrieve relevant context for the assistant; that does not grant this web app access to a user's chats or establish a continuous sync. Do not assume an API can read the full ChatGPT account history. The supported bridge is an explicitly reviewed structured profile, updated through the UI or Homebase's separately authenticated plugin using the settings record. ChatGPT should read the current settings id/version before updating it, preserve other settings, and only synchronize user-approved preferences. Past proposed meals must never be imported as confirmed cooking.

## Validation and limits

Tests cover permitted substitutions and other-meat exclusions, avoided brands, source preservation, cooking-vs-planning, recency, busy-day time, distinct refreshes, weekly feedback expiry, near-duplicates, planned-week duplicates, unknown nutrition, profile validation and grocery substitutions. Browser QA uses an isolated synthetic local catalog/profile and preview-only identity, removed before packaging. Production authentication/allowlist and private storage are preserved. An owner sign-in is still required for a full production browser walkthrough.

Ingredient/title heuristics cannot perfectly infer vegetarian compatibility, cuisine, kid appeal or leftover potential. The UI states uncertainty, and the full catalog remains accessible. Actual history begins empty until users confirm it. Panel preferences are shared household settings. Feedback/history currently use the generic records store without automatic retention pruning; future very large histories may need pagination/retention work. Recommendations are rules-based; optional AI explanations would require separate consent, a chosen data scope and explicit cost discussion.
