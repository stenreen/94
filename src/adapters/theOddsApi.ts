import { RawMatchOdds } from "../types/odds";
import { logInfo } from "../core/logger";

const API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.THEODDS_API_KEY;

if (!API_KEY) {
  throw new Error("Missing THEODDS_API_KEY");
}

type OddsApiSport = {
  key?: string;
  group?: string;
  title?: string;
  description?: string;
  active?: boolean;
  has_outrights?: boolean;
};

type OddsApiOutcome = {
  name?: string;
  price?: number;
};

type OddsApiMarket = {
  key?: string;
  outcomes?: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key?: string;
  title?: string;
  markets?: OddsApiMarket[];
};

type OddsApiEvent = {
  id?: string;
  sport_key?: string;
  sport_title?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OddsApiBookmaker[];
};

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
  return process.env.ODDS_FORMAT?.trim().toLowerCase() === "american"
    ? "american"
    : "decimal";
}

function getDateFormat(): "iso" | "unix" {
  return process.env.DATE_FORMAT?.trim().toLowerCase() === "unix"
    ? "unix"
    : "iso";
}

function getLookaheadHours(): number {
  const n = Number(process.env.LOOKAHEAD_HOURS ?? "168");
  if (!Number.isFinite(n) || n <= 0) return 168;
  return Math.floor(n);
}

function getIncludeLinks(): boolean {
  return process.env.INCLUDE_LINKS?.trim().toLowerCase() === "true";
}

function nowIsoRoundedToHour(): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function futureIso(hoursAhead: number): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + hoursAhead);
  return d.toISOString();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sanitizeUrl(url: URL): string {
  const clone = new URL(url.toString());
  clone.searchParams.delete("apiKey");
  return clone.toString();
}

function makeUrl(path: string): URL {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("apiKey", API_KEY as string);
  return url;
}

async function fetchJson<T>(url: URL): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `The Odds API request failed ${response.status} for ${sanitizeUrl(url)} :: ${text}`
    );
  }

  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}

function extractH2HRows(
  bookmakers: OddsApiBookmaker[],
  homeTeam: string,
  awayTeam: string
): Array<{
  bookmakerName: string;
  odds1: number;
  oddsX: number;
  odds2: number;
}> {
  const homeNorm = normalizeName(homeTeam);
  const awayNorm = normalizeName(awayTeam);

  const rows: Array<{
    bookmakerName: string;
    odds1: number;
    oddsX: number;
    odds2: number;
  }> = [];

  for (const bookmaker of bookmakers) {
    const market = (bookmaker.markets ?? []).find((m) => m.key === "h2h");
    if (!market) continue;

    let one: number | null = null;
    let draw: number | null = null;
    let two: number | null = null;

    for (const outcome of market.outcomes ?? []) {
      const name = normalizeName(outcome.name ?? "");
      const price = outcome.price;

      if (typeof price !== "number" || !Number.isFinite(price)) continue;

      if (name === homeNorm) {
        one = price;
      } else if (name === awayNorm) {
        two = price;
      } else if (name === "draw" || name === "tie" || name === "x") {
        draw = price;
      }
    }

    if (one !== null && draw !== null && two !== null) {
      rows.push({
        bookmakerName: bookmaker.title ?? bookmaker.key ?? "unknown",
        odds1: one,
        oddsX: draw,
        odds2: two
      });
    }
  }

  return rows;
}

export async function listActiveSports(): Promise<OddsApiSport[]> {
  const url = makeUrl("/sports/");
  const { data, headers } = await fetchJson<OddsApiSport[]>(url);

  const sports = Array.isArray(data) ? data : [];

  logInfo("The Odds API sports fetched", {
    count: sports.length,
    requestsRemaining: headers.get("x-requests-remaining"),
    requestsUsed: headers.get("x-requests-used"),
    requestsLast: headers.get("x-requests-last")
  });

  return sports;
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

  if (leagueKeys.length === 0) {
    throw new Error("No LEAGUE_KEYS configured");
  }

  const output: RawMatchOdds[] = [];

  for (const sportKey of leagueKeys) {
    const url = makeUrl(`/sports/${sportKey}/odds/`);
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

    const { data, headers } = await fetchJson<OddsApiEvent[]>(url);
    const events = Array.isArray(data) ? data : [];

    logInfo("The Odds API league fetched", {
      sportKey,
      events: events.length,
      requestsRemaining: headers.get("x-requests-remaining"),
      requestsUsed: headers.get("x-requests-used"),
      requestsLast: headers.get("x-requests-last")
    });

    for (const event of events) {
      const eventId = event.id;
      const sportTitle = event.sport_title;
      const homeTeam = event.home_team;
      const awayTeam = event.away_team;
      const commenceTime = event.commence_time;

      if (!eventId || !sportTitle || !homeTeam || !awayTeam || !commenceTime) {
        continue;
      }

      const rows = extractH2HRows(event.bookmakers ?? [], homeTeam, awayTeam);

      for (const row of rows) {
        output.push({
          source: "the-odds-api",
          bookmaker: row.bookmakerName,
          league: sportTitle,
          event_id: eventId,
          sport_key: event.sport_key,
          home_team: homeTeam,
          away_team: awayTeam,
          commence_time: commenceTime,
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
