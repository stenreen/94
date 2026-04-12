export function makeSourceKey(
  source: string,
  eventId: string | undefined,
  league: string,
  homeTeamNorm: string,
  awayTeamNorm: string,
  commenceTime: string,
  bookmaker: string
): string {
  if (eventId) {
    return `${source}|event|${eventId}|${bookmaker.toLowerCase()}`;
  }

  return [
    source.trim().toLowerCase(),
    league.trim().toLowerCase(),
    homeTeamNorm,
    awayTeamNorm,
    new Date(commenceTime).toISOString(),
    bookmaker.trim().toLowerCase()
  ].join("|");
}
