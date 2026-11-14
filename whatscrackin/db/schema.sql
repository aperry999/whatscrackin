-- What's Crackin' website schema. Safe to run more than once.

create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists cities (
  id serial primary key,
  slug text unique not null,          -- e.g. tampa-fl
  name text not null,                 -- e.g. Tampa
  state text not null,                -- two-letter, e.g. FL
  status text not null default 'waiting' check (status in ('live', 'waiting')),
  goal integer,                       -- custom launch goal; null = suggested or default
  brewery_count integer,              -- used to suggest a goal for smaller markets
  lat double precision,               -- optional, used to preselect a live city for nearby visitors
  lng double precision,
  beehiiv_tag text,                   -- tag applied to subscribers of a live city
  created_at timestamptz not null default now(),
  launched_at timestamptz
);

create table if not exists city_requests (
  id serial primary key,
  city_id integer not null references cities(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (city_id, email)
);
create index if not exists city_requests_city_idx on city_requests (city_id);

create table if not exists trip_waitlist (
  email text primary key,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists admins (
  email text primary key,
  role text not null check (role in ('owner', 'editor')),
  invited_by text,
  created_at timestamptz not null default now()
);

create table if not exists login_tokens (
  token_hash text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- One row per trip-planner trip already alerted, so each trip emails the owners once.
create table if not exists trip_alerts (
  trip_id text primary key,
  created_at timestamptz not null default now()
);

-- Crackem Instagram checkup requests from breweries (/checkup).
create table if not exists checkup_requests (
  id serial primary key,
  brewery text not null,
  city text not null,
  ig_handle text not null,
  name text not null,
  email text not null,
  who_posts text,
  created_at timestamptz not null default now()
);
create index if not exists checkup_requests_created_idx on checkup_requests (created_at);

-- One generated report per checkup request. Drafts wait for an admin to send them.
create table if not exists checkup_reports (
  id text primary key,                -- unguessable, used in the report link
  request_id integer not null unique references checkup_requests(id) on delete cascade,
  status text not null check (status in ('building', 'draft', 'sent', 'failed')),
  metrics jsonb,
  content jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

-- The brewery's one-tap answer at the end of its report: yes, no or boosted (boosted posts only).
alter table checkup_reports add column if not exists ran_ads text;
