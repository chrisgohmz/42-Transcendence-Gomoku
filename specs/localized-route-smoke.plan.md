# Localized Route Smoke

## Scenarios

- Public localized routes: visit representative user-facing routes in `en`, `ja`, and `zh`, assert the localized primary heading and one route-specific translated element render, and fail on runtime translation artifacts.
- Protected social redirects: visit protected social routes while signed out in each locale and assert they redirect to the localized login page instead of server-rendering an error.
- Human match room: seed a stored human match session, mock the match state API, and assert the localized active match room and board render in each locale.

## Notes

- The suite focuses on missing translation/runtime failures from broad i18n changes.
- Match APIs are mocked in the browser test so the human match room path does not depend on database state or a realtime server.
