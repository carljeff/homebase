# Release validation

- TypeScript no-emit check and production Worker build passed.
- Four domain tests passed: serving scaling and duplicate merging; leftovers exclusion; pantry name/unit matching; schema bounds/timezones; recipe notes retention.
- Browser tested with isolated local D1 and a temporary preview-only test identity: demo creation, recipe/cooking view, saving a planned recipe meal, generating expected groceries, shopping checkbox update, project subtask update, completion/archive, and editable household preferences.
- Phone layout inspected in a 390-pixel iframe; bottom navigation, dinner card, grocery summary and household settings work at this width. This is responsive browser QA, not a physical iPhone test.
- Temporary preview identity and QA wrapper were removed before final packaging and are absent from GitHub and the deployed source.
- Production publication succeeded. Anonymous production browser reached the ChatGPT sign-in gate. Production authenticated CRUD and two-user authorization have not been independently tested because owner browser authentication and the second visitor's verified email are pending.
- No children’s information, personal medical settings, credentials, or private household records were committed. Fictional demo content is opt-in and persisted only through authenticated app operations.

## Follow-up checks before sensitive data

1. Owner signs in and saves a non-sensitive test record on production; refresh another device and confirm it appears.
2. Invite second household editor using the verified sign-in email and confirm their read/edit access.
3. Verify a signed-in but uninvited account cannot visit Homebase.
4. Confirm the Homebase plugin can read the same household through its own authorized connection.

## Known first-release limits

Shared data polls every 15 seconds while visible; reminders appear only in-app. Pantry is presence tracking rather than stock accounting. Unit conversion and drag-and-drop scheduling are not implemented. Avoid concurrent grocery regeneration from multiple devices. Recipe imports may partially succeed on a storage/transport failure; refresh before retrying. Recipe history retains 25 prior versions. Dashboard layout customization currently toggles panels; ordering and per-user layouts are future work. Full offline/PWA behavior is not implemented. Future Family/Friends data models are documented, not active private-profile interfaces.
