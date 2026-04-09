import { z } from "zod";
import { RawMatchOdds } from "../types/odds";
import { logInfo } from "../core/logger";

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.APIFOOTBALL_API_KEY;

if (!API_KEY) {
  throw new Error("Missing APIFOOTBALL_API_KEY");
}

const OddsValueSchema = z.object({
  value: z.string(),
  odd: z.union([z.string(), z.number()])
});

const BetSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  values: z.array(OddsValueSchema).optional()
});

const BookmakerSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  bets: z.array(BetSchema).optional()
});

const ResponseItemSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string()
  }).optional(),
  league: z.object({
    id: z.number().optional(),
    name: z.string().optional()
  }).optional(),
  teams: z.object({
    home: z.object({ name: z.string().optional() }).optional(),
    away: z.object({ name: z.string().optional() }).optional()
  }).optional(),
  bookmakers: z.array(BookmakerSchema).optional()
});

const ApiResponseSchema = z.object({
  results: z.number().optional(),
  paging: z.object({ current: z.number().optional(), total: z.number().optional() }).optional(),
  response: z.array(ResponseItemSchema)
});

type FetchParams = {
  leagueId: number;
  season: number;
  date: string;
  bookmakerId?: string;
};

function parseLeagueIds(raw: string | undefined): number[] {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
}

function detectTargetDate(): string {
  if (process.env.TARGET_DATE) return process.env.TARGET_DATE;
  return new Date().toISOString().slice(0, 10);
}

function numberFromOdd(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pickH2HValues(values: Array<{ value: string; odd: string | number }>): {
  one: number;
  draw: number;
  two: number;
} | null {
  let one: number | null = null;
  let draw: number | null = null;
  let two: number | null = null;

  for (const item of values) {
    const label = item.value.trim().toLowerCase();
    const odd = numberFromOdd(item.odd);
    if (odd === null) continue;

    if (["home", "1"].includes(label)) one = odd;
    if (["draw", "x"].includes(label)) draw = odd;
    if (["away", "2"].includes(label)) two = odd;
  }

  if (one !== null && draw !== null && two !== null) {
    return { one, draw, two };
  }

  return null;
}

function extractH2HMarket(bookmakers: z.infer<typeof BookmakerSchema>[]): {
  bookmakerName: string;
  odds1: number;
  oddsX: number;
  odds2: number;
} | null {
  for (const bookmaker of bookmakers) {
    for (const bet of bookmaker.bets ?? []) {
      const betName = (bet.name ?? "").toLowerCase();
      const looksLikeMatchWinner =
        betName.includes("match winner") ||
        betName.includes("winner") ||
        betName.includes("result") ||
        betName.includes("1x2");

      if (!looksLikeMatchWinner) continue;
      const parsed = pickH2HValues(bet.values ?? []);
      if (!parsed) continue;

      return {
        bookmakerName: bookmaker.name ?? "Unknown bookmaker",
        odds1: parsed.one,
        oddsX: parsed.draw,
        odds2: parsed.two
      };
    }
  }

  return null;
}

async function fetchOddsPage(params: FetchParams, page = 1) {
  const url = new URL(`${API_BASE}/odds`);
  url.searchParams.set("league", String(params.leagueId));
  url.searchParams.set("season", String(params.season));
  url.searchParams.set("date", params.date);
  url.searchParams.set("page", String(page));

  if (params.bookmakerId) {
    url.searchParams.set("bookmaker", params.bookmakerId);
  }

  const res = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY
    }
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed ${res.status} for ${url.toString()}`);
  }

  const json = await res.json();
  return ApiResponseSchema.parse(json);
}

export async function scrapeApiFootballDailyOdds(): Promise<RawMatchOdds[]> {
  const leagueIds = parseLeagueIds(process.env.LEAGUE_IDS);
  const season = Number(process.env.SEASON ?? new Date().getUTCFullYear());
  const date = detectTargetDate();
  const bookmakerId = process.env.BOOKMAKER_ID?.trim() || undefined;

  if (leagueIds.length === 0) {
    throw new Error("No LEAGUE_IDS configured");
  }

  const output: RawMatchOdds[] = [];

  for (const leagueId of leagueIds) {
    let page = 1;
    let totalPages = 1;

    do {
      const payload = await fetchOddsPage({ leagueId, season, date, bookmakerId }, page);
      totalPages = payload.paging?.total ?? 1;

      logInfo("API-Football page fetched", {
        leagueId,
        page,
        totalPages,
        results: payload.results ?? payload.response.length
      });

      for (const item of payload.response) {
        const fixtureId = item.fixture?.id;
        const commenceTime = item.fixture?.date;
        const leagueName = item.league?.name;
        const home = item.teams?.home?.name;
        const away = item.teams?.away?.name;
        const market = extractH2HMarket(item.bookmakers ?? []);

        if (!fixtureId || !commenceTime || !leagueName || !home || !away || !market) {
          continue;
        }

        output.push({
          source: "api-football",
          bookmaker: market.bookmakerName,
          league: leagueName,
          league_id: item.league?.id,
          fixture_id: fixtureId,
          home_team: home,
          away_team: away,
          commence_time: commenceTime,
          source_url: `${API_BASE}/odds?league=${leagueId}&season=${season}&date=${date}`,
          odds_1: market.odds1,
          odds_x: market.oddsX,
          odds_2: market.odds2,
          raw: item
        });
      }

      page += 1;
    } while (page <= totalPages);
  }

  return output;
}
