import "dotenv/config";
import { listActiveSports } from "../adapters/theOddsApi.js";

async function main() {
  const sports = await listActiveSports();
  const soccer = sports.filter((s: { key: string }) => s.key.startsWith("soccer_"));
  console.log(JSON.stringify(soccer, null, 2));
}

main();

