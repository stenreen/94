# Betting odds collector

Det här paketet innehåller en första fungerande struktur för att hämta pre-match 1X2-odds från Betsson, spara dem i Supabase och köra jobbet via GitHub Actions.

## Innehåll

- färdig repo-struktur
- SQL för Supabase
- Playwright scraper
- GitHub Actions workflow
- svensk steg-för-steg-guide

## Snabbstart

1. Skapa ett nytt Supabase-projekt.
2. Kör `sql/init.sql` i Supabase SQL Editor.
3. Skapa ett GitHub-repo och ladda upp alla filer.
4. Lägg in GitHub Secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Kör workflow manuellt första gången via **Actions > Scrape prematch odds > Run workflow**.

Läs sedan `STEP_BY_STEP_SV.md` för exakt ordning.
