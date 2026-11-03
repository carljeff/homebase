# Walmart handoff validation — 2026-11-02

Draft PR: https://github.com/carljeff/homebase/pull/9
Issue: https://github.com/carljeff/homebase/issues/8

## Source and deployment baseline

GitHub `main` is a README placeholder. Continue work on `feat/walmart-shopping-handoff`, whose PR targets `feat/vault-phase1`. Do not deploy GitHub `main`.

Homebase actually deploys from the separate Sites source repository `appgprj_6ae16be43dfc8191a5aa58ab5d7c3532`, branch `main`. Site version 9 has source commit `987e6049642cbb5ab542a51d22ee2bbb346390c7`. A read-only checkout of that repository confirmed the draft's tracked application source differs only in `app/homebase.tsx` (Walmart wiring and calendar recipe-view fix) and the added handoff component. No schema, authentication, bindings or storage changes are required here. Release preparation must reconcile the reviewed GitHub commit into that Sites source repository, then obtain deployment approval. No production source was pushed, saved or deployed during this work.

## Implementation

- Unchecked, non-pantry grocery selection remains independent from grocery purchase status.
- Exact HTTPS product URLs are validated against walmart.com/www.walmart.com; credentials, ports, arbitrary subdomains and non-product routes are rejected. Canonical links strip tracking and slug text and use product IDs, preventing duplicate products under alternate slugs.
- Package counts require explicit review (integers 1–99), separate from recipe units and unknown grocery quantities. No automatic conversion of ounces/cups into product packages.
- Preference loading validates untrusted browser storage. Brand/size and product links remain local browser preferences, not household-wide persistence. No store prices, nutrition or stock are claimed as verified.
- Export is a versioned, mock-only JSON batch. Duplicate product IDs are rejected. Product/search links remain manual, user-initiated navigation. Nothing marks groceries purchased.
- The separate visible desktop rehearsal imports that batch and navigates an iframe to local synthetic product pages. Approval is per item. Pause/stop interrupts pending navigation, stop is terminal until reload, and concurrent approvals cannot double-click. Persistent local mock ledger blocks retries after confirmed or uncertain attempts. The runner checks local origin, product identity and an explicit quantity receipt. No alternate products are automatically chosen; unavailable/mismatched/challenge pages require manual review.

## Free Mac rehearsal

Requires Python 3 already installed and a current browser (Chrome or Safari). No paid services, account, extension, credentials or Walmart permissions are used. From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory tools/walmart-mock
```

Open http://127.0.0.1:8765/index.html on the same Mac. Import `tools/walmart-mock/example.json` or the batch exported from Homebase's grocery review. Click Resume and approve the displayed item. Observe its package count and mock confirmation, then Resume for the next item. Try Pause and Stop. Reimporting the same batch will block duplicates, including after reload. To repeat a disposable rehearsal, explicitly clear this localhost site's browser storage. Stop the local server with Ctrl+C afterward. Do not use these synthetic IDs as real shopping links.

For manual negative fixtures open `/product.html?id=10001&state=unavailable` or `state=challenge`; automated DOM tests cover these outcomes. The mock UI does not implement a live-site adapter. It only loads a hardcoded local fixture path. Its runner refuses any page outside `http://127.0.0.1:8765/product.html`.

## Checks and results

- Dependencies: pinned pnpm installer passed, 661 packages reused, zero downloaded. The tracked installer shell files lack executable bits; invoked with `bash scripts/sites-env.sh -- bash scripts/install-pnpm.sh`.
- TypeScript: `npm run typecheck` passes after fixing duplicate preference-default spread diagnostics found during implementation.
- Tests: `npm test` passes 48/48 (37 existing and 11 new). Uses in-memory SQLite/D1 for server tests and linkedom for synthetic DOM click and desktop UI tests; never production data or Walmart pages.
- Production build: `npm run build` passes.
- Changed Walmart files: `npm run lint:walmart` passes.
- Repository lint: fails with 134 errors and 14 warnings. A separate unchanged worktree at original PR head `8becd40` reproduces 135 errors and 14 warnings. The Walmart hydration lint error was fixed; remaining failures predate this change. No broad rule suppressions were added to make legacy lint appear clean.
- Browser preview: managed daemon reported http://terminal.local:4173/ running, but the cloud browser returned ERR_CONNECTION_REFUSED. Browser routing is unavailable. DOM tests are not proof of real Chrome/Safari/Mac operation. No visual browser QA or native Mac run is claimed.

## Live integration and release limitations

Not ready for a live automated Walmart release or deployment. Remaining work: native Mac browser rehearsal, actual live-site adapter design and verification, household preference persistence if desired, and repository-wide lint remediation. No store-specific prices/availability, cart reconciliation, substitutions, price-ceiling enforcement or live confirmation selectors have been implemented. Local duplicate prevention is per browser and does not establish the contents of a Walmart cart.

Walmart published Agentic Access Terms dated October 21, 2026:
https://www.walmart.com/help/article/walmart-agentic-access-terms/d048fc229d7549738d7c05a4317e24d7

The current terms describe direct browser agents as well as a separate Agent Gateway; they require informed consent, truthful agent identification, respect for consent gates/customer preferences and no evasion of safeguards. They do not establish that this prototype is a verified Walmart integration. A future live adapter must verify the then-current requirements and technical feasibility. This work does not accept terms, connect an account, or enable live actions. User approval remains required before account connection, real cart changes or deployment. No checkout functionality exists.

## Live mock rehearsal release

User authorized publishing the prototype for testing on November 2. The hosted rehearsal is now included in `public/walmart-mock`, linked from Kitchen → Groceries. A Load sample batch button avoids local server or file setup. The same tested runner permits only the exact same-origin synthetic product fixture; Walmart domains remain rejected. Reset clears only mock rehearsal browser storage. No database migrations, account integration or real cart actions were added. Previous deployed Site version 9 is retained as the rollback point; restoring code does not undo subsequent household data edits.
