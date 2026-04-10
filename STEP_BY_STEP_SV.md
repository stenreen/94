# API-Football gratisversion – steg för steg

Det här är den gratis ombyggda versionen.

## Vad som är ändrat
- Betsson/Playwright är borttaget.
- Projektet använder nu API-Football i stället.
- Tanken är **1 körning per dag** för att hålla sig inom gratisnivån.

## Gratisbudget – enkel regel
API-Footballs gratisplan ger **100 requests per dag**. Odds finns även i gratisplanen. Deras guide säger också att `/odds` kan filtreras med `league + season + date`, vilket gör det naturligt att köra ungefär **1 odds-request per liga och dag**.

Praktiskt betyder det:
- teoretiskt kan du ligga nära 100 ligor om allt är extremt snålt
- praktiskt rekommenderar jag **10–30 ligor**
- vill du ha marginal för felsökning, retries och testkörningar: håll dig kring **10–20 ligor**

## Filstruktur
- `src/adapters/apiFootball.ts` = hämtar odds från API-Football
- `src/jobs/scrapeDailyOdds.ts` = kör jobbet och sparar till Supabase
- `sql/init.sql` = tabellerna i Supabase
- `.github/workflows/scrape.yml` = dagligt schema i GitHub Actions

## 1. Skapa API-Football-konto
1. Gå till API-Football.
2. Registrera gratis konto.
3. Hämta din API-nyckel.

## 2. Skapa/öppna Supabase-projekt
1. Gå till Supabase.
2. Skapa nytt projekt eller använd ditt befintliga.
3. Öppna **SQL Editor**.
4. Kör innehållet i `sql/init.sql`.

## 3. Hämta dina Supabase-värden
Du behöver:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4. Lägg upp koden i GitHub
Lägg upp hela projektmappen i ett repo.

## 5. Lägg in GitHub Secrets
I GitHub:
**Settings → Secrets and variables → Actions**

Skapa dessa tre secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APIFOOTBALL_API_KEY`

## 6. Välj ligor
I workflow-filen finns denna rad:

```yaml
LEAGUE_IDS: "113,39,140,135,78,61,94,88,203,144"
```

Det är bara exempel. Du kan ändra till vilka ligor du vill.

### Tumregel
- 1 liga = ungefär 1 odds-request per dag
- 10 ligor = ungefär 10 requests per dag
- 20 ligor = ungefär 20 requests per dag

## 7. Säsong
I workflow-filen finns:

```yaml
SEASON: "2026"
```

Ändra om du vill hämta en annan säsong.

## 8. Kör manuellt första gången
I GitHub:
1. gå till **Actions**
2. välj workflowet
3. klicka **Run workflow**

## 9. Kontrollera i Supabase
Kör dessa frågor i SQL Editor:

```sql
select * from scrape_runs order by started_at desc limit 5;
```

```sql
select * from events order by created_at desc limit 20;
```

```sql
select * from odds_snapshots order by scraped_at desc limit 50;
```

## 10. Om du vill öka antalet ligor
Ja, det går mycket bättre nu när du bara kör **1 gång per dag**.

Min rekommendation:
- börja med 5–10 ligor
- om loggarna ser bra ut, höj till 15–20
- håll lite marginal under 100 requests/dag

## 11. Om du vill fokusera på en bookmaker
Du kan använda miljövariabeln `BOOKMAKER_ID` i `.env` eller lägga till den i workflowet senare.
Det är valfritt.

## 12. Viktigt om GitHub-repot
GitHub-hosted runners är gratis i **public repos**. Om du kör private repo på gratisplan har du en begränsad mängd GitHub Actions-minuter.

## 13. Nästa steg efter att detta fungerar
När du har data i tabellerna är nästa naturliga steg:
- SQL-fråga för **bästa odds per match**
- enkel dashboard
- value/edge-logik
- topplista per liga
