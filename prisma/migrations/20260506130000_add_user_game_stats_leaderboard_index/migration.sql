CREATE INDEX "UserGameStats_ruleType_boardSize_rating_wins_losses_idx"
ON "UserGameStats"("ruleType", "boardSize", "rating", "wins", "losses");
