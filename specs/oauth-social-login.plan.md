# OAuth Social Login E2E Plan

- Auth entry points: visit `/en/login` and `/en/signup` with Playwright's dummy OAuth provider env vars and assert both branded GitHub and Google buttons render.
- Account connections, unlinked state: sign in as a temporary credential user and assert GitHub and Google are available as enabled `Connect {provider}` controls with no disconnect action.
- Account connections, linked state: add a mock Google account record for the same user, reload `/en/account`, and assert Google becomes a disabled connected provider button while GitHub stays connectable and a single enabled disconnect action appears.
- Layout guard: assert the account page does not horizontally overflow and the branded connected button keeps its icon/text group centered.
