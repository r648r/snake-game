CREATE TABLE IF NOT EXISTS scores (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(16)  NOT NULL,
  score      INTEGER      NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);
