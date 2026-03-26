CREATE TABLE IF NOT EXISTS respondents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    final_winner_palette_id TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    respondent_id TEXT NOT NULL,
    round_name TEXT NOT NULL,
    matchup_key TEXT NOT NULL,
    left_palette_id TEXT NOT NULL,
    right_palette_id TEXT NOT NULL,
    selected_palette_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(respondent_id, matchup_key),
    FOREIGN KEY (respondent_id) REFERENCES respondents(id)
);