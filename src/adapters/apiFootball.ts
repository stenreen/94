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
  fixture: z
    .object({
      id: z.number(),
      date: z.string()
    })
    .optional(),
  league: z
    .object({
      id: z.number().optional(),
      name: z.string().optional()
    })
    .optional(),
  teams: z
    .object({
      home: z.object({ name: z.string().optional() }).optional(),
      away: z.object({ name: z.string().optional() }).optional()
    })
    .optional(),
  bookmakers: z.array(BookmakerSchema).optional()
});

const OddsApiResponseSchema = z.object({
  results: z.number().optional(),
  paging: z
    .object({
      current: z.number().optional(),
      total: z.number().optional()
    })
    .optional(),
  response: z.array(ResponseItemSchema)
});

const LeagueSeasonSchema = z.object({
  year: z.number(),
  current: z.boolean().optional()
});

const LeagueInfoSchema = z.object({
  league: z
    .object({
      id: z.number().optional(),
      name: z.string().optional()
    })
    .optional(),
  seasons: z.array(LeagueSeasonSchema).optional()
});

const LeagueApiResponseSchema = z.object({
  results: z.number().optional(),
  response: z.array(LeagueInfoSchema)
});

type FetchOddsParams = {
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

function getLookaheadDays(): number {
  const n = Number(process.env.LOOKAHEAD_DAYS ?? "4");
  if (!Number.isFinite(n) || n < 0) return 4;
  return Math.floor(n);
}

function getStartDate(): Date {
  if (process.env.TARGET_DATE) {
    const d = new Date(`${process.env.TARGET_DATE}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function formatDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDateRange(): string[] {
  const start = getStartDate();
  const lookaheadDays = getLookaheadDays();
  const dates: string[] = [];

  for (let i = 0; i <= lookaheadDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    dates.push(formatDateUTC(d));
  }

  return dates;
}

function numberFromOdd(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function pickH2HValues(
  values: Array<{ value: string; odd: string | number }>,
  homeTeamName: string,
  awayTeamName: string
): {
  one: number;
  draw: number;
  two: number;
} | null {
  let one: number | null = null;
  let draw: number | null = null;
  let two: number | null = null;

  const homeNorm = normalizeLabel(homeTeamName);
  const awayNorm = normalizeLabel(awayTeamName);

  for (const item of values) {
    const label = normalizeLabel(item.value);
    const odd = numberFromOdd(item.odd);
    if (odd === null) continue;

    if (
      label === homeNorm ||
      ["home", "1", "1 (home)", "home team"].includes(label)
    ) {
      one = odd;
      continue;
    }

    if (["draw", "x", "tie"].includes(label)) {
      draw = odd;
      continue;
    }

    if (
      label === awayNorm ||
      ["away", "2", "2 (away)", "away team"].includes(label)
    ) {
      two = odd;
      continue;
    }
  }

  if (one !== null && draw !== null && two !== null) {
    return { one, draw, two };
  }

  return null;
}

function extractH2HMarket(
  bookmakers: z.infer<typeof BookmakerSchema>[],
  homeTeamName: string,
  awayTeamName: string
): {
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
        betName.includes("1x2") ||
        betName.includes("fulltime result") ||
        betName.includes("full time result");

      if (!looksLikeMatchWinner) continue;

      const parsed = pickH2HValues(
        bet.values ?? [],
        homeTeamName,
        awayTeamName
      );

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

async function fetchJson(url: URL) {
  const res = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY as string
    }
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed ${res.status} for ${url.toString()}`);
  }

  return res.json();
}

async function fetchCurrentSeasonForLeague(leagueId: number): Promise<number> {
  if (process.env.SEASON) {
    const forced = Number(process.env.SEASON);
    if (Number.isFinite(forced)) return forced;
  }

  const url = new URL(`${API_BASE}/leagues`);
  url.searchParams.set("id", String(leagueId));
  url.searchParams.set("current", "true");

  const json = await fetchJson(url);
  const payload = LeagueApiResponseSchema.parse(json);

  const first = payload.response[0];
  const currentSeason = first?.seasons?.find((s) => s.current)?.year;

  if (currentSeason && Number.isFinite(currentSeason)) {
    return currentSeason;
  }

  const currentYear = new Date().getUTCFullYear();
  return currentYear;
}

async function fetchOddsPage(params: FetchOddsParams, page = 1) {
  const url = new URL(`${API_BASE}/odds`);
  url.searchParams.set("league", String(params.leagueId));
  url.searchParams.set("season", String(params.season));
  url.searchParams.set("date", params.date);
  url.searchParams.set("page", String(page));

  if (params.bookmakerId) {
    url.searchParams.set("bookmaker", params.bookmakerId);
  }

  const json = await fetchJson(url);
  return OddsApiResponseSchema.parse(json);
}

export async function scrapeApiFootballDailyOdds(): Promise<RawMatchOdds[]> {
  const leagueIds = parseLeagueIds(process.env.LEAGUE_IDS);
  const bookmakerId = process.env.BOOKMAKER_ID?.trim() || undefined;
  const dates = buildDateRange();

  if (leagueIds.length === 0) {
    throw new Error("No LEAGUE_IDS configured");
  }

  const output: RawMatchOdds[] = [];
  const seenKeys = new Set<string>();
  const seasonCache = new Map<number, number>();
  let noMarketDebugCount = 0;

  for (const leagueId of leagueIds) {
    let season = seasonCache.get(leagueId);

    if (!season) {
      season = await fetchCurrentSeasonForLeague(leagueId);
      seasonCache.set(leagueId, season);

      logInfo("API-Football season resolved", {
        leagueId,
        season
      });
    }

    for (const date of dates) {
      let page = 1;
      let totalPages = 1;

      do {
        const payload = await fetchOddsPage(
          { leagueId, season, date, bookmakerId },
          page
        );

        totalPages = payload.paging?.total ?? 1;

        logInfo("API-Football page fetched", {
          leagueId,
          season,
          date,
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

          if (!fixtureId || !commenceTime || !leagueName || !home || !away) {
            continue;
          }

          const market = extractH2HMarket(item.bookmakers ?? [], home, away);

          if (!market) {
            if (item.bookmakers?.length && noMarketDebugCount < 15) {
              noMarketDebugCount += 1;
              console.log("NO_H2H_MARKET_FOR_FIXTURE", {
                fixtureId,
                home,
                away,
                leagueName,
                bookmakerNames: item.bookmakers.map((b) => b.name),
                firstBetNames: item.bookmakers
                  .flatMap((b) => (b.bets ?? []).map((x) => x.name))
                  .slice(0, 12)
              });
            }
            continue;
          }

          const dedupeKey = `${fixtureId}|${market.bookmakerName}`;
          if (seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);

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
  }

  logInfo("API-Football final extracted count", {
    matches: output.length
  });

  return output;
}
