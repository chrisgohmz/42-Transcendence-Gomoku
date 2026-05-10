# Human Lobby

## Scenarios

- Create Room: visiting the human lobby loads the match list, clicking Create Room sends a match creation request, stores the returned participant session, and opens the active human match board.
- Join Room: visiting the human lobby renders waiting matches from the match API, clicking the row join control sends a join request, stores the returned participant session, and opens the active human match board.

## Notes

- API calls are mocked in the browser test so the scenario covers the client lobby wiring without depending on database state.
- The visual room metadata widgets are out of scope for this transfer.
