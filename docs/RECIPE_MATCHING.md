# Matching a meal-plan title to a saved recipe

A meal transcribed from a handwritten note may have a title but no `recipeId`. Calendar recipe opening cannot resolve an unlinked title by ID. This enhancement adds matching and explicit linking without recreating meals or recipes.

## Review existing meals

Click an unlinked cook night, a specifically named leftovers entry, or a meal whose recipe link is unavailable. The matcher searches saved titles and ingredients, tolerates common spelling differences, recognizes pasta names/plurals and selected common abbreviations, and ignores a trailing “+ Side” note. Suggestions show actual saved titles and a reason, not a claimed probability. Preview ingredients/instructions and household substitutions before choosing **Use this recipe**. Search can be refined; **Browse all recipes** keeps the existing library/replacement flow available.

Linking is explicit and version checked. It preserves the meal's ID, title, date, type, servings, status, cooked date, notes, and other plan information. It does not regenerate groceries, mark anything cooked, create recipes or recommendation events, or modify the recipe. Existing per-meal substitutions take precedence; missing substitutions are added using the existing household rules. If a broken old link is repaired, its old ID is retained in previous-recipe history. Replacing a valid existing choice still uses Meal options.

The matcher pins the meal version from when it opened so background refresh cannot silently approve a changed meal. A repeated identical link is safe; a stale edit or unavailable recipe is rejected. Errors remain visible inside the matcher. Generic leftovers/custom meals with no specific dish still open their normal editor. Linked meals retain direct recipe opening and a separate Meal options button.

## Future shorthand and conversational planning

Existing linked meal records provide confirmed shorthand examples; no new alias table or migration is introduced. Conflicting examples or duplicate recipe titles remain ambiguous. If that history is removed, the shorthand is no longer learned.

New cook meals saved without a recipe ID may receive a unique normalized exact-title match or a unique previously confirmed shorthand match. Fuzzy/ingredient/modified-base matches are never auto-linked, no matter how high their rank. Existing records are not bulk updated, and clearing an existing link during an edit does not immediately recreate it. Explicit recipe IDs always take precedence.

The existing authenticated MCP endpoint adds read-only **homebase_match_recipes** with `{title}`. It returns candidate recipe IDs, actual saved titles, reasons, kind and ambiguity. Before creating a meal from shorthand, search the library and include the chosen ID. `homebase_write` also exposes existing `plan_recipe` behavior and explicit `link_meal_recipe` with `{mealId,version,recipeId}`. The same read/link actions are available through the browser dispatcher. The connector may need tool-discovery refresh after deployment. No new service, credentials, paid AI or dependencies are used.

Only household-shared recipes/meals are searched. Friends ownership, private relationship memory, source synchronization, birthdays and calendar-day recency remain unchanged.

## Validation and limitations

152 application tests pass, including shorthand/side notes, typos, pasta synonyms, ingredient search, ambiguous duplicate titles, conflicting learned aliases, exact-only automatic linking, plan/substitution preservation, read-only matching, safe retries, stale versions, broken links, authenticated connector operations, and rendered matching-preview/confirmation/direct-opening behavior. TypeScript and focused matching/test lint pass. Existing lint findings in legacy Homebase/operations modules remain outside scope. Production build/deployment provenance is recorded in the PR.

The matcher operates on already transcribed titles; it does not read handwriting images. Ingredients and instructions come from saved recipes, without nutrition inference. A similar title can still be a different dish (for example Homemade Pizza versus Cauliflower Pizza). Review is required when the intended recipe is not clear. Some handwritten dishes may not yet exist in the library. No live meal records are relinked by the deployment itself.

Visual/mobile browser preview remains unavailable in the existing managed environment; DOM interaction tests cover the real component. No database migration or Mac update is needed. Preserve the latest full Homebase baseline when deploying.
