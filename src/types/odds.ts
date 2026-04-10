export type Selection = "1" | "X" | "2";

export type NormalizedOddsRow = {
  source: "api-football";
  bookmaker: string;
  sport: "football";
  league: string;
  league_id?: number;
  fixture_id?: number;
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
  source: "api-football";
  bookmaker: string;
  league: string;
  league_id?: number;
  fixture_id?: number;
  home_team: string;
  away_team: string;
  commence_time: string;
  source_url: string;
  odds_1: number;
  odds_x: number;
  odds_2: number;
  raw?: unknown;
};
