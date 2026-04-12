export function logInfo(message: string, meta?: unknown) {
  console.log(JSON.stringify({ level: "info", message, meta }));
}

export function logError(message: string, meta?: unknown) {
  console.error(JSON.stringify({ level: "error", message, meta }));
}
