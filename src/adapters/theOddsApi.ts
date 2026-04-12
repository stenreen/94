import { z } from "zod";
import { RawMatchOdds } from "../types/odds.js";
import { logInfo } from "../core/logger.js";

const API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.THEODDS_API_KEY;

if (!API_KEY) {
  throw new Error("Missing THEODDS_API_KEY");
}

const OutcomeSchema = z.object({
  name: z.string(),
  price: z.number()
}).passthrough();

const MarketSchema = z.object({
  key: z.string(),
  outcomes: z.array(OutcomeSchema)
}).passthrough();

const BookmakerSchema = z.object({
  key: z.string().optional(),
  title: z.string(),
  markets: z.array(MarketSchema)
}).passthrough();

const EventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  sport_title: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(BookmakerSchema).optional()
}).passthrough();

const SportSchema = z.object({
  key: z.string(),
  group: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  has_outrights: z.boolean().optional()
}).passthrough();

const DEFAULT_LEAGUE_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_sweden_allsvenskan"
];

function parseCsv(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getLeagueKeys(): string[] {
  const configured = parseCsv(process.env.LEAGUE_KEYS);
  return configured.length > 0 ? configured : DEFAULT_LEAGUE_KEYS;
}

function getRegions(): string {
  return process.env.REGIONS?.trim() || "eu";
}

function getMarkets(): string {
  return process.env.MARKETS?.trim() || "h2h";
}

function getOddsFormat(): "decimal" | "american" {
  const value = process.env.ODDS_FORMAT?.trim().toLowerCase();
  return value === "american" ? "american" : "decimal";
}

function getDateFormat(): "iso" | "unix" {
  const value = process.env.DATE_FORMAT?.trim().toLowerCase();
  return value === "unix" ? "unix" : "iso";
}

function getLookaheadHours(): number {
  const raw = Number(process.env.LOOKAHEAD_HOURS ?? "168");
  if (!Number.isFinite(raw) || raw <= 0) return 168;
  return Math.floor(raw);
}

function getIncludeLinks(): boolean {
  return (process.env.INCLUDE_LINKS ?? "false").trim().toLowerCase() === "true";
}

function nowIsoRoundedToHour(): string {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now.toISOString();
}

function futureIso(hoursAhead: number): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + hoursAhead);
  return d.toISOString();
}

async function fetchJson<T>(url: URL, schema: z.ZodSchema<T>): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`The Odds API request failed ${response.status} for ${url.toString()}`);
  }

  const json = await response.json();
  return {
    data: schema.parse(json),
    headers: response.headers
  };
}

function makeApiKeyUrl(path: string): URL {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("apiKey", API_KEY as string);
  return url;
}


function sanitizeUrl(url: URL): string {
  const clone = new URL(url.toString());
  clone.searchParams.delete("apiKey");
  return clone.toString();
}

export async function listActiveSports(): Promise<z.infer<typeof SportSchema>[]> {
  const url = makeApiKeyUrl("/sports/");
  const { data, headers } = await fetchJson(url, z.array(SportSchema));

  logInfo("The Odds API sports fetched", {
    count: data.length,
    requestsRemaining: headers.get("x-requests-remaining"),
    requestsUsed: headers.get("x-requests-used"),
    requestsLast: headers.get("x-requests-last")
  });

  return data;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractH2HMarket(
  bookmakers: z.infer<typeof BookmakerSchema>[],
  homeTeam: string,
  awayTeam: string
): Array<{ bookmaker: string; odds1: number; oddsX: number; odds2: number }> {
  const homeNorm = normalizeName(homeTeam);
  const awayNorm = normalizeName(awayTeam);
  const rows: Array<{ bookmaker: string; odds1: number; oddsX: number; odds2: number }> = [];

  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets.find((m) => m.key === "h2h");
    if (!market) continue;

    let one: number | null = null;
    let draw: number | null = null;
    let two: number | null = null;

    for (const outcome of market.outcomes) {
      const name = normalizeName(outcome.name);
      if (name === homeNorm) one = outcome.price;
      else if (name === awayNorm) two = outcome.price;
      else if (["draw", "tie", "x"].includes(name)) draw = outcome.price;
    }

    if (one !== null && draw !== null && two !== null) {
      rows.push({
        bookmaker: bookmaker.title,
        odds1: one,
        oddsX: draw,
        odds2: two
      });
    }
  }

  return rows;
}

export async function scrapeTheOddsApiDailyOdds(): Promise<RawMatchOdds[]> {
  const leagueKeys = getLeagueKeys();
  const bookmakers = parseCsv(process.env.BOOKMAKERS);
  const regions = getRegions();
  const markets = getMarkets();
  const oddsFormat = getOddsFormat();
  const dateFormat = getDateFormat();
  const includeLinks = getIncludeLinks();
  const commenceTimeFrom = nowIsoRoundedToHour();
  const commenceTimeTo = futureIso(getLookaheadHours());
  const output: RawMatchOdds[] = [];

  for (const sportKey of leagueKeys) {
    const url = makeApiKeyUrl(`/sports/${sportKey}/odds/`);
    url.searchParams.set("markets", markets);
    url.searchParams.set("oddsFormat", oddsFormat);
    url.searchParams.set("dateFormat", dateFormat);
    url.searchParams.set("commenceTimeFrom", commenceTimeFrom);
    url.searchParams.set("commenceTimeTo", commenceTimeTo);
    if (bookmakers.length > 0) {
      url.searchParams.set("bookmakers", bookmakers.join(","));
    } else {
      url.searchParams.set("regions", regions);
    }
    if (includeLinks) {
      url.searchParams.set("includeLinks", "true");
    }

    const { data, headers } = await fetchJson(url, z.array(EventSchema));

    logInfo("The Odds API league fetched", {
      sportKey,
      events: data.length,
      requestsRemaining: headers.get("x-requests-remaining"),
      requestsUsed: headers.get("x-requests-used"),
      requestsLast: headers.get("x-requests-last")
    });

    for (const event of data) {
      const rows = extractH2HMarket(event.bookmakers ?? [], event.home_team, event.away_team);

      for (const row of rows) {
        output.push({
          source: "the-odds-api",
          bookmaker: row.bookmaker,
          league: event.sport_title,
          sport_key: event.sport_key,
          event_id: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          source_url: sanitizeUrl(url),
          odds_1: row.odds1,
          odds_x: row.oddsX,
          odds_2: row.odds2,
          raw: event
        });
      }
    }
  }

  logInfo("The Odds API final extracted count", {
    matches: output.length
  });

  return output;
}
