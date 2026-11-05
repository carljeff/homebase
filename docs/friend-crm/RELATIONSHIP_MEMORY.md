# Relationship memory: audit, implementation, and rollout

## Audited baseline

On November 4, 2026, Homebase's latest live build was v23, hosted source `b6bd70a9876efc6ae6c75a55d6871445b31b5678`. GitHub PR #17 (`feat/friend-birthdays`, commit `477dfe6f73bf328fe7a0091f6adc1d2918edb5f4`) contains the corresponding latest Friends application code. All `app`, `lib`, and `drizzle` files matched the hosted checkout before editing. The local checkout was clean. Open Friends work is stacked in PRs #11–17; no newer Friends PR was present during the audit. `main` is not the application baseline.

GitHub additionally contains the already-tested Mac discovery/vCard fixes from PRs #13/#15 that were not copied into the hosted source repository. The review candidate retains those newer tooling files; it does not replace them with hosted copies or change the installed Mac collector. Existing hosting identity, access, runtime secrets, D1/R2 bindings, migrations, and relay are retained.

## Incremental plan and storage

Extend the existing `friend` JSON record in `records`; no new contact kind, table, migration, bulk update, reimport, or record rewrite. Keep existing IDs, birthday/partner fields, notes, reminder intervals, message opt-ins and source infrastructure. Defaults are applied in memory when rendering legacy records, not written during reads.

New optional fields:

| Purpose | Fields |
| --- | --- |
| Meeting context | `meetingPlace`, `metOn`, `howWeMet`, `mutualConnections`, `tags` |
| Personal memory | `interests`, `occupation`, `children`, `commonGround` |
| Explicit contact details | `phone`, `email` |
| Other interactions | `lastInPerson`, `manualLastContact` |
| Dates and follow-up | `importantDates` (ID, label, date, annual), `followUpOn` |
| Dated notes | `relationshipNotes` (ID, note date, text, server creation/modification timestamps) |
| Optional suggestions | `stayConnected`, `suggestionState` (cause key, dismissal/snooze, expiry) |
| New-contact date | server-assigned `createdAt`; legacy unknown dates stay unknown |

Existing `birthday`, `partner`, general `notes`, `trackMessaging` and `reminderDays` are reused. Dated notes are bounded to 200 per contact (4,000 characters each), important dates to 30, tags to 20, and suggestion decisions to 100. These are modest household-scale limits, not an archival activity database.

## Interface

- **+ Add person:** only name is required. Meeting context, contact details, tags and a short note are optional and collapsed. Meeting date defaults to the Indianapolis calendar date and can be cleared. A stable capture UUID prevents duplicate creation on a retry. Normalized name, phone or email matches require review or explicit confirmation of a different person; records are never automatically merged.
- **People:** existing birthday priority, messaging recency sorting, date/elapsed labels, colors, source controls, opt-in and direct/group metrics remain. Expanded context and dated notes live in the existing collapsed Details section. Birthday remains editor-only except its existing upcoming badge; partner remains in Edit/Details.
- **Recently met:** filters the same contacts by known meeting or creation date within 90 days. It does not infer creation from an edit or import timestamp. Meeting context and a brief memory are shown. Later direct or manually recorded interactions are distinguished from group activity. No records migrate when someone ages out of this view.
- **Upcoming dates:** birthdays, important dates and explicitly set follow-up dates in the next 30 days. Existing seven-day birthday pinning remains unchanged.
- **Find someone:** basic accent/case-insensitive keyword search spans names, notes (including dated notes), partner, meeting/relationship context, tags, occupation, children, interests, and manually stored contact details. Search does not modify records or use an external service.
- **Dated notes:** add, edit and delete inside Details; sort by note date then creation time, newest first. Creation time survives edits, modification time is assigned on the server. General notes are independent. Note deletion requires an explicit action in the UI.
- **Saw them today:** records only the in-person date. Manual date editing is also available. It never changes message counts, last-message dates, group activity, or the Mac mapping.

## Stay Connected rules

At most three people are shown at once, with their explanation and a link back to the contact. No scores, streaks, automatic texts or notifications. Opt in per person (`stayConnected`) or explicitly set a reminder interval/follow-up date. No defaults turn suggestions on for imported contacts.

1. An explicitly recorded follow-up date is due.
2. An opted-in person has a birthday/important date within seven days.
3. An opted-in person was met 7–90 days ago and no later direct or manually recorded interaction is present.
4. The person's explicit reminder interval has elapsed since observed personal outgoing or manually recorded contact.
5. For an opted-in person, direct-message counts fell by at least half compared with a previous 30-day window containing at least four messages; personal outgoing contact is at least 14 days old.

Recent direct incoming/outgoing activity or an in-person/manual interaction in the past seven days suppresses inactivity suggestions. Group messages stay separate and are not evidence of personal outreach or an in-person meeting. For tracked contacts, stale/partial metadata or a missing contact match suppresses data-dependent inactivity suggestions; explicit dates remain usable. Without message tracking, manually entered dates and meeting history can provide the anchor.

Only one inactivity explanation is selected for a person at a time. Dismissing its stable cause key does not expose another equivalent inactivity explanation on the next refresh. A dismissal remains saved for that cause; a changed interaction or a new annual event can create a new cause. Snoozes expire after seven days in the UI (the connector also accepts 30). Expired snoozes can be pruned, but permanent dismissals are not silently evicted. Notes do not create follow-up dates or count as personal interactions automatically.

Calendar dates use `America/Indiana/Indianapolis`; existing message-count windows remain UTC calendar days. February 29 keeps the established February 28 observation in non-leap years. Main-card order and colors still represent messaging recency, with birthday priority; separate manual dates influence suggestions and appear in Details.

## Explicit connector operations

The existing `/mcp` endpoint retains `homebase_list` and `homebase_write`. An owner-only `homebase_friends` tool adds:

| Action | Required input / effect |
| --- | --- |
| `search` | `query`; returns matching records and versions |
| `quick_add` | stable `requestId` UUID, `data.name`; optional quick-entry fields |
| `update` | `id`, current `version`, `patch` of explicitly requested fields |
| `note_save` | contact `id`/`version`, note `{id,date,text}`; `edit:true` for an existing note |
| `note_delete` | contact `id`/`version`, `noteId` |
| `saw_today` | contact `id`/`version`; only after an explicitly reported meeting |
| `suggestion` | contact `id`/`version`, cause `key`, `disposition`, optional snooze `days` |

Search before creating. Inspect a current record before updating; combine existing context deliberately rather than replacing it by inference. Set `followUpOn` only if explicitly requested. Partial updates preserve omitted fields. Generic existing friend saves also merge omitted fields, protect server creation dates and require note/suggestion changes to use their explicit actions. Optimistic versions reject conflicting edits. Note IDs make identical retries safe; a changed creation retry cannot silently replace an existing note.

These operations reuse the authenticated browser dispatcher (`friend_` action prefix) and existing owner checks. The tool is omitted and rejected for other household adults. Forged visitor IDs or client flags do not grant access. No additional service, OAuth scope, secret or Mac credential is needed. The Homebase build must be deployed to make the new endpoint behavior live. ChatGPT may require refreshing the Homebase connector/tool discovery to expose `homebase_friends`; no relay deployment is required.

## Privacy and preservation

Phone/email explicitly entered here are private Homebase relationship details. They are not automatically enrolled into the Mac's local matching file. Existing multi-handle matching remains controlled locally through the current selected-contact helper and metadata opt-in. No new relationship fields are accepted in collector activity uploads or returned by the minimal Mac roster. No Apple message bodies, previews or attachments are read for this feature, stored as notes, inferred into profiles, or logged.

No Messages SQL, collector, relay worker, signing, retry, launchd, keychain, cursor or source mode is changed by this enhancement. No production records or installed Mac files have been modified during development. The unchanged collector/discovery package is retained exactly from the latest GitHub baseline.

## Validation and remaining gates

- 137 application tests pass, including all existing regression suites and new helper/server/browser-DOM/connector tests.
- 36 Mac Python tests pass on synthetic databases/configuration, including incremental sync, matching, parsing, privacy, installer, retries and discovery.
- 6 standalone relay tests pass from `tools/messages-crm/relay`.
- TypeScript and focused lint for new Friends code/tests pass. Existing `lib/operations.ts` and `app/mcp/route.ts` contain pre-existing explicit-any lint findings; no full-repository lint-clean claim is made.
- Tests verify byte-equivalent legacy records after reads, preservation after signed ingestion/contact imports, untouched device source state during memory writes, partial-save retention, version conflicts, duplicate/retry safety, dated-note CRUD/timestamps, birthday sorting, direct/group separation, filters/search, persistent dismissal and snooze behavior, and owner/nonowner browser/MCP/API access.
- Production build must pass before saving the review candidate. Actual results and artifact provenance are recorded in the PR.
- Visual browser/mobile QA is incomplete: the managed preview reported another Vinext server at PID 14 under `/site` and would not start. That unrelated process was not killed or replaced. DOM-level interaction tests pass; iPhone layout should be checked after an approved rollout.
- No real contacts, contact identifiers, credentials or message data were used in tests or committed. Real live Mac sync/reboot/SSH/VNC validation is not claimed in this change.

## Deployment and rollback

This is a review candidate, not automatic production rollout. Before deployment, recheck live Site/source and GitHub heads for concurrent work, inspect the focused PR, and obtain user approval for this expanded behavior. Preserve the Site audience and protected runtime configuration. No migration or production data modification command should be run.

After approval: deploy the exact saved build; verify owner access and hidden Friends for another account, inspect a few existing cards, create a synthetic person/note through the UI if the user approves production test data, verify search and birthday priority, then confirm the real collector's health sequence continues advancing. Refresh connector discovery if needed.

Rollback means deploying the last owner-protected build, currently v23. New memory fields remain stored in the records table and are not deleted by a code rollback. Avoid editing contacts with the older application until returning to the newer build, because the old schema can discard fields it does not recognize. Never roll back to a pre-owner-privacy build or truncate/import/recreate the database. Prefer a forward fix if users have begun saving memory data.
