create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  league text not null,
  home_team_norm text not null,
  away_team_norm text not null,
  commence_time timestamptz not null,
  source_key text not null unique,
  created_at timestamptz default now()
);

create table if not exists odds_snapshots (
  id bigint generated always as identity primary key,
  event_id uuid not null references events(id) on delete cascade,
  bookmaker text not null,
  market text not null,
  selection text not null,
  odds numeric(10,3) not null,
  source_url text,
  scraped_at timestamptz not null default now(),
  raw jsonb
);

create table if not exists scrape_runs (
  id uuid primary key default gen_random_uuid(),
  bookmaker text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  matches_seen int default 0,
  rows_written int default 0,
  error_text text
);

create index if not exists idx_events_source_key on events(source_key);
create index if not exists idx_events_commence_time on events(commence_time);
create index if not exists idx_odds_event_bookmaker on odds_snapshots(event_id, bookmaker, market, selection);
create index if not exists idx_odds_scraped_at on odds_snapshots(scraped_at desc);
