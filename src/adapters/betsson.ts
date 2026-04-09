import { Page } from "playwright";
import { RawMatchOdds } from "../types/odds.js";

const BETSSON_LEAGUE_URL =
  process.env.BETSSON_LEAGUE_URL ??
  "https://www.betsson.com/sv/odds/fotboll/sverige/superettan";

const BETSSON_LEAGUE_NAME =
  process.env.BETSSON_LEAGUE_NAME ?? "Superettan";

const BETSSON_DEFAULT_YEAR = Number(
  process.env.BETSSON_DEFAULT_YEAR ?? new Date().getUTCFullYear()
);

const SWEDISH_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  mars: 2,
  april: 3,
  maj: 4,
  juni: 5,
  juli: 6,
  augusti: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11
};

const DATE_HEADING_RE =
  /^(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(\d{1,2})\s+([a-zåäö]+)$/i;

function cleanLine(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDecimalOdds(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function parseOdds(value: string): number {
  return Number(value.replace(",", "."));
}

function parseSwedishDateHeading(
  line: string,
  year: number
): string | null {
  const match = cleanLine(line).match(DATE_HEADING_RE);
  if (!match) return null;

  const day = Number(match[2]);
  const monthName = match[3].toLowerCase();
  const monthIndex = SWEDISH_MONTHS[monthName];

  if (monthIndex === undefined) return null;

  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0)).toISOString();
}

function extractVisibleLines(text: string): string[] {
  return text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
}

function uniqueByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function parseBetssonLeagueText(
  lines: string[],
  sourceUrl: string,
  league: string,
  year: number
): RawMatchOdds[] {
  const results: RawMatchOdds[] = [];
  let currentDateIso: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const maybeDate = parseSwedishDateHeading(line, year);
    if (maybeDate) {
      currentDateIso = maybeDate;
      continue;
    }

    if (
      line === "Matchresultat" &&
      currentDateIso &&
      i + 6 < lines.length &&
      lines[i + 3] === "Oavgjort" &&
      isDecimalOdds(lines[i + 2]) &&
      isDecimalOdds(lines[i + 4]) &&
      isDecimalOdds(lines[i + 6])
    ) {
      const homeTeam = lines[i + 1];
      const awayTeam = lines[i + 5];
      const odds1 = parseOdds(lines[i + 2]);
      const oddsX = parseOdds(lines[i + 4]);
      const odds2 = parseOdds(lines[i + 6]);

      if (!homeTeam || !awayTeam) continue;
      if (homeTeam === "Totalt antal mål" || awayTeam === "Totalt antal mål") {
        continue;
      }

      results.push({
        bookmaker: "betsson",
        league,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: currentDateIso,
        source_url: sourceUrl,
        odds_1: odds1,
        odds_x: oddsX,
        odds_2: odds2,
        raw: {
          parser: "betsson-league-text-v1",
          date_heading_iso: currentDateIso,
          extracted_from_lines: lines.slice(Math.max(0, i - 2), i + 10)
        }
      });
    }
  }

  return uniqueByKey(
    results,
    (m) =>
      [
        m.bookmaker,
        m.league,
        m.home_team.toLowerCase(),
        m.away_team.toLowerCase(),
        m.commence_time
      ].join("|")
  );
}

async function acceptCookiesIfPresent(page: Page): Promise<void> {
  const candidates = [
    page.getByRole("button", { name: /acceptera/i }),
    page.getByRole("button", { name: /accept/i }),
    page.getByRole("button", { name: /godkänn/i })
  ];

  for (const locator of candidates) {
    try {
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click({ timeout: 1500 });
        return;
      }
    } catch {
      // ignorera
    }
  }
}

export async function scrapeBetssonFootballPrematch(
  page: Page
): Promise<RawMatchOdds[]> {
  await page.goto(BETSSON_LEAGUE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await acceptCookiesIfPresent(page);

  const body = page.locator("body");
  await body.waitFor({ state: "visible", timeout: 15000 });

  await page.waitForTimeout(2500);

  const bodyText = await body.evaluate((el) => {
    const node = el as HTMLElement;
    return node.innerText || node.textContent || "";
  });

  const lines = extractVisibleLines(bodyText);
  const matches = parseBetssonLeagueText(
    lines,
    BETSSON_LEAGUE_URL,
    BETSSON_LEAGUE_NAME,
    BETSSON_DEFAULT_YEAR
  );

  return matches;
}
