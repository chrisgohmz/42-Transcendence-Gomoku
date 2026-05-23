# Messages

## Scenarios

- Friend message flow: navigating to the Friends page and clicking the friend-specific Message link opens the Messages page with a composer that uses the friend's accessible label, allowing the user to send a message that appears in the thread without relying on a realtime echo.

## Notes

- The friend, conversation, and message data are seeded directly through Prisma so the test does not depend on chat seed scripts.
- The composer is asserted via a user-visible locator (`getByRole("textbox", { name: /Message <friend>/ })`) rather than the implementation `input[name="message"]`.
- The sent message is asserted by reading the thread, which exercises the POST response → local state path and does not require the socket round-trip to land first.
