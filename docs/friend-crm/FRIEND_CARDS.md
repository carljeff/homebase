# Friend cards

Friends is private to the configured owner. Birthday and partner are optional additions to the existing friend JSON record; no database migration, collector update, or existing-record rewrite is required.

- Birthday is a validated `MM-DD` value or `null`. The editor provides month and day pickers, with no birth year collected. The exact date is visible only in the editor.
- A birthday today or within the next seven calendar days pins the card above other friends, ordered by soonest birthday. A gold highlight and text badge explain the priority. Other friends retain oldest-contact-first sorting.
- Birthday calculations use `America/Indiana/Indianapolis`, including year boundaries and daylight saving changes. February 29 is observed on February 28 in non-leap years.
- Partner is an optional name (maximum 100 characters), shown in the editor and collapsed Details section only. It does not create a relationship link or affect Messages matching.
- Legacy records missing either field continue to render. Editing preserves notes, tracking preferences, reminder settings, and current optimistic-concurrency versions. Mac contact import preserves existing records and returns only its existing minimal name/ID/opt-in roster; birthdays and partner names are not sent to the Mac.

Validation: 120 application tests pass, including calendar boundaries, invalid dates, priority ordering, editor save/clear behavior, and contact import preservation/privacy. Production build and TypeScript results are recorded in the change pull request. Visual preview remains unverified because the browser could not reach the local preview route during the preceding layout rollout.
