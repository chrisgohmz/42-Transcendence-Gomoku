# AI Solo Mode Notes

Issue #42 is implemented as a private server-authoritative match.

- `/api/matches/solo` creates a normal `Match` with two `PLAYER` participants: the signed-in user and `Kata Reader`, an AI participant with `userId: null`.
- `/api/matches/[id]/ai-turn` is the only endpoint that can submit AI moves. It verifies the signed-in user owns the human participant, rechecks state inside a transaction, and writes the AI move with the same `MatchMove` model as human play.
- The match screen in `/ai` uses `MatchBoard`, the extracted board component also used by `HumanMatchRoom`, so the actual board UI stays shared across vs AI and vs Human.

The AI engine lives in `app/lib/matches/ai-engine.ts`.

- Candidate pruning only searches empty intersections near existing stones. Empty boards open in the center.
- Every candidate is evaluated with shape scoring for open twos, threes, fours, immediate wins, and urgent blocks.
- Difficulty controls search depth, candidate limit, defense weight, score noise, top-move pool size, mistake chance, and server response delay.
- Minimax is depth-limited with alpha-beta pruning. It is intentionally not a perfect engine: final selection randomizes among close top moves, and easier levels occasionally widen that pool.

Difficulty presets:

- Beginner: 1-ply search, small candidate set, high noise/mistake chance.
- Apprentice: 2-ply search with moderate pruning and balanced defense.
- Expert: 2-ply search with stronger defense and lower randomness.
- Master: 3-ply search, larger candidate set, low randomness, stronger defensive weighting.
