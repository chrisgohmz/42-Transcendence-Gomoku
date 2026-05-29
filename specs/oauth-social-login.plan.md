# OAuth Social Login E2E Plan

- Auth entry points: visit `/en/login` and `/en/signup` with Playwright's dummy OAuth provider env vars and assert both branded GitHub and Google buttons render.
- Profile connections, unlinked state: sign in as a temporary credential user and assert GitHub and Google are available as enabled `Connect {provider}` controls with no disconnect action.
- Profile connections, linked state: add a mock Google account record for the same user, reload `/en/profile/edit`, and assert Google becomes a disabled connected provider button while GitHub stays connectable and a single enabled disconnect action appears.
- Layout guard: assert the profile edit page does not horizontally overflow and the branded connected button keeps its icon/text group centered.
