# One-package supervised almond milk test

This is an experimental Chrome helper for a single user-approved Add to cart click. It is not a verified Walmart integration. No live cart or signed-in browser was used during automated testing.

1. Unzip the helper download.
2. In Chrome open chrome://extensions, enable Developer mode, choose Load unpacked, and select the folder containing manifest.json.
3. In your own Walmart tab, choose your exact almond milk. Sign in yourself if needed. Check package size, flavor, price, store and fulfillment. Ensure this product is not already in your cart.
4. Click Chrome's puzzle-piece menu → Homebase supervised almond milk test. Click Inspect this product. Review the displayed product, check the approval box, then approve ONE package.
5. Open Walmart's cart yourself and verify the result. The helper does not claim a click means the product was added. Do not retry an uncertain attempt.

No subscriptions, external servers, Walmart API credentials or paid services. Permissions are activeTab, scripting and storage. Clicking the extension gives temporary access to the selected tab. No persistent Walmart host access, content scripts, account connection, cookie/password/payment access or checkout code. The helper only accepts Walmart product pages with one visible almond milk heading and one unambiguous enabled Add to cart button. It blocks obvious verification/challenge pages and quantity controls; it never solves challenges. Close the popup before approval to cancel. Remove the extension at chrome://extensions to revoke its access after testing.

An attempt record is stored locally before any click and automatic retry is blocked, including after browser interruption. Attempts are not purchases. The cart remains the source of truth. This is not a batch shopper; it cannot verify existing cart contents, price/availability, selected options or successful addition. The user must review those on Walmart. If Walmart's current page markup differs or it offers multiple Add buttons, it will stop rather than guess. Do not use mock product IDs for this test.

Agent identification: the product name/version are in manifest.json. This helper does not disguise automation or answer identity prompts; stop if Walmart requests agent identification that this version cannot supply. Current Walmart Agentic Access Terms must be respected; no term acceptance is automated. Terms reviewed in this task: https://www.walmart.com/help/article/walmart-agentic-access-terms/d048fc229d7549738d7c05a4317e24d7 (October 21, 2026 version).

Automated tests cover synthetic DOM inspection, strict product checks, changed products, challenges, ambiguous buttons, consent, one-package limits, pre-click persistence, concurrent actions and uncertain outcomes. Actual Chrome/Walmart compatibility remains to be tested by the user. No Homebase deployment is necessary to install this helper.

## Version 0.1.1

Button matching now checks the rendered Add to cart text as well as an exact accessibility label. Only buttons intersecting the viewport and unobstructed at their visible center qualify. Offscreen recommendations are excluded; multiple qualifying buttons still block the action. This addresses two plausible causes of the first user-reported mismatch, but the screenshot alone does not establish Walmart's DOM structure. Chrome/Walmart verification remains user-supervised.

To update without losing the local attempt history, replace the files inside the extension folder you previously loaded, then open chrome://extensions and click its Reload button. Refresh the Walmart product tab before inspecting it again. Do not uninstall simply to retry a previous uncertain click.

## Version 0.1.2 — retry recovery

If a prior action is locked but you refreshed Walmart's cart and verified the exact product is absent: Inspect the product, choose “Item absent from cart? Unlock retry”, and confirm the absence check. This only unlocks that product; it does not add anything. Inspect again, review the product, and approve separately. The recovery retains the previous status locally and rechecks the active product. Uncertain actions remain locked without this explicit recovery. Adapter results that guarantee no click now record `not_clicked` and do not require recovery; earlier stored `blocked` results are also retryable. Never clear all extension storage merely to retry.
