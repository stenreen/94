import { chromium, Browser, Page } from "playwright";

export async function withBrowser<T>(
  fn: (page: Page, browser: Browser) => Promise<T>
): Promise<T> {
  const headless = process.env.HEADLESS !== "false";

  const browser = await chromium.launch({
    headless
  });

  const context = await browser.newContext({
    locale: "sv-SE",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    return await fn(page, browser);
  } finally {
    await context.close();
    await browser.close();
  }
}
