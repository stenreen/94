import { RawMatchOdds, NormalizedOddsRow } from "../types/odds.js";

function normalizeTeamName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/ fc$/i, "")
    .replace(/ football club$/i, "");
}

export function toNormalizedRows(match: RawMatchOdds): NormalizedOddsRow[] {
  const homeNorm = normalizeTeamName(match.home_team);
  const awayNorm = normalizeTeamName(match.away_team);
  const scrapedAt = new Date().toISOString();

  return [
    {
      source: "the-odds-api",
      bookmaker: match.bookmaker,
      sport: "football",
      league: match.league,
      sport_key: match.sport_key,
      event_id: match.event_id,
      home_team_raw: match.home_team,
      away_team_raw: match.away_team,
      home_team_norm: homeNorm,
      away_team_norm: awayNorm,
      commence_time: match.commence_time,
      market: "h2h",
      selection: "1",
      odds: match.odds_1,
      source_url: match.source_url,
      scraped_at: scrapedAt,
      raw: match.raw
    },
    {
      source: "the-odds-api",
      bookmaker: match.bookmaker,
      sport: "football",
      league: match.league,
      sport_key: match.sport_key,
      event_id: match.event_id,
      home_team_raw: match.home_team,
      away_team_raw: match.away_team,
      home_team_norm: homeNorm,
      away_team_norm: awayNorm,
      commence_time: match.commence_time,
      market: "h2h",
      selection: "X",
      odds: match.odds_x,
      source_url: match.source_url,
      scraped_at: scrapedAt,
      raw: match.raw
    },
    {
      source: "the-odds-api",
      bookmaker: match.bookmaker,
      sport: "football",
      league: match.league,
      sport_key: match.sport_key,
      event_id: match.event_id,
      home_team_raw: match.home_team,
      away_team_raw: match.away_team,
      home_team_norm: homeNorm,
      away_team_norm: awayNorm,
      commence_time: match.commence_time,
      market: "h2h",
      selection: "2",
      odds: match.odds_2,
      source_url: match.source_url,
      scraped_at: scrapedAt,
      raw: match.raw
    }
  ];
}
