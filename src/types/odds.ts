export type Selection = "1" | "X" | "2";

export type NormalizedOddsRow = {
  source: "the-odds-api";
  bookmaker: string;
  sport: "football";
  league: string;
  sport_key?: string;
  event_id?: string;
  home_team_raw: string;
  away_team_raw: string;
  home_team_norm: string;
  away_team_norm: string;
  commence_time: string;
  market: "h2h";
  selection: Selection;
  odds: number;
  source_url: string;
  scraped_at: string;
  raw?: unknown;
};

export type RawMatchOdds = {
  source: "the-odds-api";
  bookmaker: string;
  league: string;
  sport_key?: string;
  event_id?: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  source_url: string;
  odds_1: number;
  odds_x: number;
  odds_2: number;
  raw?: unknown;
};
