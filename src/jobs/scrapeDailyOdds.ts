import "dotenv/config";
import { scrapeTheOddsApiDailyOdds } from "../adapters/theOddsApi.js";
import { toNormalizedRows } from "../core/normalize.js";
import { makeSourceKey } from "../core/matcher.js";
import { supabase } from "../db/supabase.js";
import { logError, logInfo } from "../core/logger.js";

async function main() {
  const source = "the-odds-api";
  const startedAt = new Date().toISOString();

  const { data: runRow, error: runInsertError } = await supabase
    .from("scrape_runs")
    .insert({
      bookmaker: source,
      started_at: startedAt
    })
    .select("id")
    .single();

  if (runInsertError || !runRow) {
    throw new Error(`Failed to create scrape_run: ${runInsertError?.message}`);
  }

  const runId = runRow.id;

  try {
    const matches = await scrapeTheOddsApiDailyOdds();

    logInfo("Matches extracted", { source, count: matches.length });
    console.log(JSON.stringify(matches.slice(0, 3), null, 2));

    let rowsWritten = 0;

    for (const match of matches) {
      const normalizedRows = toNormalizedRows(match);
      const sample = normalizedRows[0];

      const sourceKey = makeSourceKey(
        sample.source,
        sample.event_id,
        sample.league,
        sample.home_team_norm,
        sample.away_team_norm,
        sample.commence_time,
        sample.bookmaker
      );

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .upsert(
          {
            sport: sample.sport,
            league: sample.league,
            home_team_norm: sample.home_team_norm,
            away_team_norm: sample.away_team_norm,
            commence_time: sample.commence_time,
            source_key: sourceKey
          },
          { onConflict: "source_key" }
        )
        .select("id")
        .single();

      if (eventError || !eventRow) {
        throw new Error(`Failed event upsert: ${eventError?.message}`);
      }

      const snapshotPayload = normalizedRows.map((row) => ({
        event_id: eventRow.id,
        bookmaker: row.bookmaker,
        market: row.market,
        selection: row.selection,
        odds: row.odds,
        source_url: row.source_url,
        scraped_at: row.scraped_at,
        raw: row.raw
      }));

      const { error: snapshotError } = await supabase
        .from("odds_snapshots")
        .insert(snapshotPayload);

      if (snapshotError) {
        throw new Error(`Failed snapshot insert: ${snapshotError.message}`);
      }

      rowsWritten += snapshotPayload.length;
    }

    await supabase
      .from("scrape_runs")
      .update({
        finished_at: new Date().toISOString(),
        ok: true,
        matches_seen: matches.length,
        rows_written: rowsWritten
      })
      .eq("id", runId);

    logInfo("Scrape completed", { source, matches: matches.length, rowsWritten });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabase
      .from("scrape_runs")
      .update({
        finished_at: new Date().toISOString(),
        ok: false,
        error_text: message
      })
      .eq("id", runId);

    logError("Scrape failed", { source, error: message });
    process.exit(1);
  }
}

main();
