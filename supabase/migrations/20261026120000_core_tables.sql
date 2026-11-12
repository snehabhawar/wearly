-- Core tables: closets, hub devices, hangers, garments and the hanger <-> garment link.
-- See docs/backend.md (Data model > Core).

create table closets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My closet',
  -- Decides local dates (which day a wear counts on)
  timezone text not null default 'UTC',
  wear_profile text not null default 'real' check (wear_profile in ('real', 'demo')),
  -- Feed the weather forecast for the planner
  latitude double precision,
  longitude double precision,
  -- When the closet-wide sweep last ran; throttles it on hub polls
  last_swept_at timestamptz,
  created_at timestamptz not null default now()
);

-- MVP: one closet per user
create unique index closets_owner_id_key on closets (owner_id);

create table devices (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  kind text not null default 'hub' check (kind in ('hub')),
  name text not null default 'Hub',
  -- sha256 hex of the bearer secret; the hub API looks devices up by it
  secret_hash text not null unique,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index devices_closet_id_idx on devices (closet_id);

create table hangers (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  -- Engraved on the pod; the hub and app refer to hangers by number
  number integer not null check (number >= 1),
  -- Current state only; history lives in sensor_events
  on_rail boolean not null default true,
  garment_on boolean not null default true,
  led_color text not null default 'off' check (led_color in ('purple', 'amber', 'white', 'off')),
  led_pattern text not null default 'off' check (led_pattern in ('steady', 'breathe', 'blink2', 'off')),
  state_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (closet_id, number)
);

create table garments (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  -- Every descriptive field is optional: a garment can exist with only a hanger
  name text,
  category text check (category in ('top', 'bottom', 'outer', 'one_piece')),
  color text,
  seasons text[] check (seasons <@ array['spring', 'summer', 'fall', 'winter']),
  formality smallint check (formality between 1 and 5),
  price_cents integer check (price_cents >= 0),
  photo_path text,
  cutout_path text,
  tags_source text check (tags_source in ('ai', 'user')),
  status text not null default 'active' check (status in ('active', 'let_go', 'rehomed', 'missing')),
  created_at timestamptz not null default now()
);

create index garments_closet_id_idx on garments (closet_id);

create table hanger_assignments (
  id uuid primary key default gen_random_uuid(),
  hanger_id uuid not null references hangers (id) on delete cascade,
  garment_id uuid not null references garments (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);

-- At most one open assignment per hanger and per garment
create unique index hanger_assignments_open_hanger_key on hanger_assignments (hanger_id) where ended_at is null;
create unique index hanger_assignments_open_garment_key on hanger_assignments (garment_id) where ended_at is null;
create index hanger_assignments_garment_id_idx on hanger_assignments (garment_id);
