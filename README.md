# Homebase

A private, shared family dashboard: Kitchen, Projects, Dashboard, with empty Family and Friends foundations. The public repository contains application code and fictional examples only. Runtime records belong in the private Sites D1 database.

## Architecture

ChatGPT Sites hosts the Vinext/React application in a Cloudflare Worker, provisions D1, supplies authenticated visitor identity, and restricts visitors through the Site's private allowlist. Every application and MCP operation requires an authenticated visitor. All allowed Site visitors are household editors of the **same household**. Do not make this Site public or invite people who should not read and edit all household records. A Sites "viewer" is allowed to use/edit the household application but cannot thereby edit its source.

Breakaway is a separate Sites project; its GitHub relay is not the dashboard source. Homebase links to it and never updates it. Sites uses its own managed source Git remote for publication; this repository is the reviewable source mirror. Pushing GitHub alone does not deploy. Use the Sites workflow, then mirror the same authored source to a feature branch and open a PR. No separate database provider or paid infrastructure has been introduced. Platform quotas, availability, and plan eligibility still apply; there is no promise of unlimited free hosting. Worker memory is 128 MB. Back up application records before larger changes.

## Features

- Recipe CRUD, ingredient quantities, instructions, tags, likes, notes, and last 25 previous recipe versions; mobile cooking view and structured JSON imports.
- Dated meal plans, cook/leftovers/flex nights, serving scaling, previous/next weeks and copy-to-next-week. Scheduling uses a day editor rather than drag-and-drop.
- Generated grocery lists consolidate case-insensitive names with matching units; no automatic unit conversion. Pantry entries exclude matching name/unit entirely (presence tracking, not inventory subtraction). Manual entries, staples, checked items and pantry records survive generation. Generated unchecked items are rebuilt. Recurring staples remain editable list entries; automatic recurring replenishment is not implemented.
- Projects and tasks, subtasks, priority, due/reminder dates, completion archive. Reminders appear in the dashboard; there are no push/email notifications.
- Upcoming dates, highlights, selectable dashboard panels, editable shared food preferences. Shared data refreshes every 15 seconds while visible and after writes. Per-record versions reject stale edits.
- Family and Friends are placeholders, with no child data, chore tracker, contact data or message integration.
- PWA manifest and responsive layouts; no offline data cache or service worker yet.

## Setup / development

Use Node 22.13+ and the included Sites starter dependency installer. `npm run db:generate` generates Drizzle SQL; never modify applied migrations. `npx tsc --noEmit` checks types. `node --experimental-strip-types --test tests/domain.test.ts` exercises domain behavior. The Sites build helper builds the Worker and deployment metadata. For local D1 migration instructions see `docs/development.md`.

Production authentication is provided by Sites dispatch; never expose the raw Worker directly or trust caller-supplied identity headers on an alternative host. Local test identities are only for loopback preview requests. A production private-Site denial is distinct from app-level 401.

## Household access

Owner access is configured at creation. To add a second person, verify their exact ChatGPT sign-in email, check external invites are enabled with Sites `get_site`, and add that visitor to the custom allowlist without making the Site public. They sign in separately. Test their shared edit/read access before adding sensitive family details. Do not store medical targets or child profiles until access has been independently verified.

## ChatGPT integration

See `docs/api.md`. Publishing the MCP-capable Site provisions a private plugin. Install/connect that generated Homebase plugin; ordinary GitHub access does **not** grant access to household data. Authentication and Site access checks apply separately. No credentials belong in this repository. See the deployed Site's connection metadata for its exact plugin ID.

## Future modules

Future profile records should carry `{id, householdId, displayName, details, version}`; contacts, activities, sizes and gift ideas should be separate profile-related record kinds with schema validation. Future friend and interaction records should carry `{id, householdId, friendId, occurredAt, source, summary, consent}`; store minimal interaction metadata and no message content by default. No iMessage source is connected. Before multi-household expansion, add explicit memberships and household foreign keys and filter every query by membership; the current database is intentionally one household per private Site.
