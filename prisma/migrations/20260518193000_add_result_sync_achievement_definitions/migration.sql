INSERT INTO "AchievementDefinition" ("code", "name", "description", "points", "createdAt", "updatedAt")
VALUES
  (
    'ai_win',
    'AI Victor',
    'Win a match against an AI opponent.',
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'win_streak_3',
    'Hat Trick',
    'Win three matches in a row.',
    20,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO NOTHING;
