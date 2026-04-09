export function makeSourceKey(
  bookmaker: string,
  league: string,
  homeTeamNorm: string,
  awayTeamNorm: string,
  commenceTime: string
): string {
  return [
    bookmaker.trim().toLowerCase(),
    league.trim().toLowerCase(),
    homeTeamNorm,
    awayTeamNorm,
    new Date(commenceTime).toISOString()
  ].join("|");
}
