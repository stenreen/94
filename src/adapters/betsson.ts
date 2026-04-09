import { Page } from "playwright";
import { RawMatchOdds } from "../types/odds";

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
  return /^\d+([.,]\d+)?$/.test(value.trim());
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

    // Variant 1:
    // Matchresultat
    // Hemmalag
    // 2.10
    // Oavgjort
    // 3.40
    // Bortalag
    // 3.20
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

      if (homeTeam && awayTeam) {
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
            parser: "betsson-league-text-v2-variant1",
            date_heading_iso: currentDateIso,
            extracted_from_lines: lines.slice(Math.max(0, i - 2), i + 10)
          }
        });
      }
    }

    // Variant 2, lite lösare:
    // Matchresultat ... Oavgjort ...
    if (line === "Matchresultat" && currentDateIso) {
      const windowLines = lines.slice(i, i + 12);

      const drawIndex = windowLines.findIndex((x) => x === "Oavgjort");
      if (drawIndex > 1 && drawIndex + 2 < windowLines.length) {
        const maybeHome = windowLines[1];
        const maybeOdds1 = windowLines[2];
        const maybeOddsX = windowLines[drawIndex + 1];
        const maybeAway = windowLines[drawIndex + 2];
        const maybeOdds2 = windowLines[drawIndex + 3];

        if (
          maybeHome &&
          maybeAway &&
          isDecimalOdds(maybeOdds1) &&
          isDecimalOdds(maybeOddsX) &&
          isDecimalOdds(maybeOdds2)
        ) {
          results.push({
            bookmaker: "betsson",
            league,
            home_team: maybeHome,
            away_team: maybeAway,
            commence_time: currentDateIso,
            source_url: sourceUrl,
            odds_1: parseOdds(maybeOdds1),
            odds_x: parseOdds(maybeOddsX),
            odds_2: parseOdds(maybeOdds2),
            raw: {
              parser: "betsson-league-text-v2-variant2",
              date_heading_iso: currentDateIso,
              extracted_from_lines: windowLines
            }
          });
        }
      }
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
    page.getByRole("button", { name: /godkänn/i }),
    page.getByRole("button", { name: /jag accepterar/i }),
    page.getByRole("button", { name: /allow all/i })
  ];

  for (const locator of candidates) {
    try {
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click({ timeout: 1500 });
        console.log("BETSSON cookie button clicked");
        return;
      }
    } catch {
      // ignorera
    }
  }

  console.log("BETSSON no cookie button clicked");
}

export async function scrapeBetssonFootballPrematch(
  page: Page
): Promise<RawMatchOdds[]> {
  const networkHits: Array<{
    url: string;
    status: number;
    type: string;
    contentType: string;
  }> = [];

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";
      const resourceType = response.request().resourceType();

      const looksInteresting =
        resourceType === "xhr" ||
        resourceType === "fetch" ||
        contentType.includes("json") ||
        /odds|event|fixture|market|sport|match/i.test(url);

      if (looksInteresting) {
        networkHits.push({
          url,
          status: response.status(),
          type: resourceType,
          contentType
        });
      }
    } catch {
      // ignorera
    }
  });

  await page.goto(BETSSON_LEAGUE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  console.log("BETSSON current url:", page.url());

  try {
    console.log("BETSSON title:", await page.title());
  } catch {
    console.log("BETSSON title: <unavailable>");
  }

  await acceptCookiesIfPresent(page);

  const body = page.locator("body");
  await body.waitFor({ state: "visible", timeout: 15000 });

  await page.waitForTimeout(5000);

  const bodyText = await body.evaluate((el) => {
    const node = el as HTMLElement;
    return node.innerText || node.textContent || "";
  });

  console.log("BETSSON bodyText preview start");
  console.log(bodyText.slice(0, 3000));
  console.log("BETSSON bodyText preview end");

  const lines = extractVisibleLines(bodyText);

  console.log("BETSSON lines count:", lines.length);
  console.log("BETSSON first 80 lines:");
  console.log(JSON.stringify(lines.slice(0, 80), null, 2));

  const matches = parseBetssonLeagueText(
    lines,
    BETSSON_LEAGUE_URL,
    BETSSON_LEAGUE_NAME,
    BETSSON_DEFAULT_YEAR
  );

  console.log("BETSSON parsed matches count:", matches.length);
  console.log(JSON.stringify(matches.slice(0, 3), null, 2));

  console.log("BETSSON network hits count:", networkHits.length);
  console.log(
    JSON.stringify(
      networkHits
        .slice(0, 20)
        .map((x) => ({
          url: x.url,
          status: x.status,
          type: x.type,
          contentType: x.contentType
        })),
      null,
      2
    )
  );

  return matches;
}
