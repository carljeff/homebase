# Private dashboard reminders

The main dashboard includes a compact **Stay connected** panel for the existing Friends owner only. It appears when there is something to review; no empty permanent panel. Up to four people are shown, with a total count and View friends link. Clicking a name opens that exact person's existing card. Main navigation to Friends still opens the complete list.

Rules reuse existing fields and calendar-day recency:

- Explicit follow-up dates that are today or overdue appear first, oldest date first. The saved general note, or latest dated relationship note if general notes are empty, appears as a short context preview. Freeform note text does not become a reminder unless a follow-up date is set in that person's existing details.
- Otherwise, people whose recorded last contact is red (more than 30 Indianapolis calendar days) appear longest ago first. This is the same direct-or-group last-contact measure used by the Friends cards, not a claim about personal outreach. No opt-in reminder interval is required for this requested red-card summary.
- Messaging gaps require enabled, current, complete metadata (both snapshot and last successful sync within 24 hours), a matched activity record and permission to track that person. Missing/stale/partial activity cannot establish a gap. Explicit follow-ups still appear without messaging data.
- A manually recorded in-person or other contact within 30 calendar days suppresses a texting-gap reminder. Explicit follow-up timing, including future dates and existing snoozes/dismissals, takes precedence over a red fallback.
- Snooze uses the existing versioned friend_suggestion operation for seven days. Red-gap keys are stable for the same last-contact timestamp. Notes, birthdays, partner information, imported mappings and synchronization are untouched.

The existing server owner policy continues to filter private records and protect /api/crm/status. The dashboard does not mount or request CRM metadata for the other adult. No new migration, service, dependency, Mini update or automation is needed. Existing shared dashboard panels remain intact.

Synthetic rule tests cover ordering, household-day boundaries, direct/group recency, manual-contact suppression, stale/disabled/partial sources, opt-out, missing activity, future dates, snoozes and dismissals. Rendered React tests cover exact-person navigation, versioned snooze persistence, unchanged shared sections and no private rendering/CRM fetch for the other adult. Actual browser visual QA is not available in the environment; the production build and rendered interaction tests are the verification used.
