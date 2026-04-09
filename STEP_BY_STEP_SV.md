# Steg för steg – exakt vad du ska göra

Här är den praktiska ordningen. Följ den uppifrån och ner.

---

## 1. Packa upp ZIP-filen

När du laddat ner ZIP-filen:

1. Packa upp den på datorn.
2. Du får en mapp som heter `betting-odds-collector`.
3. Det är **hela projektet**.

---

## 2. Skapa Supabase-projekt

1. Gå till Supabase.
2. Skapa ett nytt projekt.
3. När projektet är klart går du till **SQL Editor**.
4. Öppna filen:

```text
sql/init.sql
```

5. Kopiera allt i den filen.
6. Klistra in i Supabase SQL Editor.
7. Kör SQL-scriptet.

Detta skapar tabellerna:

- `events`
- `odds_snapshots`
- `scrape_runs`

---

## 3. Hämta dina Supabase-nycklar

I Supabase-projektet:

1. Gå till **Project Settings**.
2. Gå till **API**.
3. Kopiera:
   - `Project URL`
   - `service_role key`

Du ska använda dem senare i GitHub Secrets.

---

## 4. Skapa GitHub-repo

1. Gå till GitHub.
2. Skapa ett nytt repo, till exempel:

```text
betting-odds-collector
```

3. Ladda upp **alla filer** från den uppackade mappen till repot.

Det viktiga är att strukturen ser ut så här i GitHub:

```text
betting-odds-collector/
  src/
  sql/
  .github/
  package.json
  tsconfig.json
  playwright.config.ts
  .env.example
  README.md
  STEP_BY_STEP_SV.md
```

---

## 5. Var varje fil ska ligga

Här är exakt var filerna ska ligga.

### I projektets rotmapp

Lägg dessa direkt i huvudmappen:

- `package.json`
- `tsconfig.json`
- `playwright.config.ts`
- `.env.example`
- `README.md`
- `STEP_BY_STEP_SV.md`

### I `sql/`

Lägg denna fil här:

- `sql/init.sql`

### I `src/adapters/`

Lägg denna fil här:

- `src/adapters/betsson.ts`

### I `src/core/`

Lägg dessa filer här:

- `src/core/browser.ts`
- `src/core/logger.ts`
- `src/core/matcher.ts`
- `src/core/normalize.ts`

### I `src/db/`

Lägg denna fil här:

- `src/db/supabase.ts`

### I `src/jobs/`

Lägg denna fil här:

- `src/jobs/scrapePrematch.ts`

### I `src/types/`

Lägg denna fil här:

- `src/types/odds.ts`

### I `src/`

Lägg denna fil direkt här:

- `src/index.ts`

### I `.github/workflows/`

Lägg denna fil här:

- `.github/workflows/scrape.yml`

---

## 6. Lägg in GitHub Secrets

I GitHub-repot:

1. Gå till **Settings**
2. Gå till **Secrets and variables**
3. Gå till **Actions**
4. Klicka på **New repository secret**

Skapa två secrets:

### Secret 1

**Name**
```text
SUPABASE_URL
```

**Value**
```text
Din Project URL från Supabase
```

### Secret 2

**Name**
```text
SUPABASE_SERVICE_ROLE_KEY
```

**Value**
```text
Din service_role key från Supabase
```

---

## 7. Vad `.env.example` är till för

Den filen används mest som mall om du kör lokalt.

Om du vill köra lokalt:

1. Kopiera `.env.example`
2. Döp kopian till `.env`
3. Fyll i riktiga värden

Exempel:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=din_riktiga_key
SCRAPE_TARGET=betsson
HEADLESS=true
BETSSON_LEAGUE_URL=https://www.betsson.com/sv/odds/fotboll/sverige/superettan
BETSSON_LEAGUE_NAME=Superettan
BETSSON_DEFAULT_YEAR=2026
```

---

## 8. Kör första testet lokalt

Om du vill testa på datorn först:

1. Installera Node.js 20+
2. Öppna terminal i projektmappen
3. Kör:

```bash
npm install
npx playwright install --with-deps chromium
npm run scrape
```

Om allt går bra ska scriptet:

- öppna Betsson-sidan
- läsa odds
- spara data i Supabase
- logga körningen i `scrape_runs`

---

## 9. Kör första testet i GitHub

När repot och secrets är på plats:

1. Gå till **Actions** i GitHub
2. Öppna workflow:

```text
Scrape prematch odds
```

3. Klicka **Run workflow**
4. Vänta tills jobbet är klart

Om det fungerar ska du få nya rader i:

- `scrape_runs`
- `events`
- `odds_snapshots`

---

## 10. Hur du kollar att det fungerade i Supabase

Gå till **Table Editor** i Supabase och kontrollera:

### `scrape_runs`
Här ser du om jobbet gick bra eller inte.

Kolla särskilt kolumnerna:

- `ok`
- `matches_seen`
- `rows_written`
- `error_text`

### `events`
Här ser du matcher som skapats.

### `odds_snapshots`
Här ser du själva oddsen.

Varje match ska ge tre rader:

- `1`
- `X`
- `2`

---

## 11. Viktigt att känna till

Den första adaptern använder ligasidans renderade text.
Det betyder:

- bra för första version
- enkel att komma igång med
- men starttiden är uppskattad mitt på dagen i UTC

Så detta är ett bra första datalager, men inte slutversionen.

---

## 12. Nästa steg efter första lyckade körningen

När första körningen fungerar ska du göra detta i ordning:

1. lägg till bättre exakt matchtid
2. lägg till bookmaker nummer 2
3. lägg till bookmaker nummer 3
4. bygg jämförelse mellan odds
5. bygg value/edge-logik
6. bygg UI eller dashboard

---

## 13. Om något går fel

Titta i denna ordning:

1. GitHub Actions-loggen
2. tabellen `scrape_runs`
3. att secrets är rätt
4. att SQL-scriptet verkligen körts
5. att Betsson-sidan fortfarande visar rätt textmönster

---

## 14. Kort förklaring av filerna

### `src/adapters/betsson.ts`
Här hämtas odds från Betsson.

### `src/jobs/scrapePrematch.ts`
Detta är jobbet som kör hela flödet.

### `src/core/normalize.ts`
Här delas varje match upp i tre oddsrader: 1, X, 2.

### `src/db/supabase.ts`
Här kopplar projektet upp sig mot Supabase.

### `.github/workflows/scrape.yml`
Här styrs den automatiska körningen i GitHub Actions.

---

## 15. Enklaste vägen om du vill komma igång snabbt

Om du vill göra det absolut enklast:

1. kör SQL i Supabase
2. ladda upp hela projektet till GitHub
3. lägg in två GitHub Secrets
4. kör workflow manuellt
5. kontrollera tabellerna i Supabase

Det är snabbaste vägen till första fungerande version.
