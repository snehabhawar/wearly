-- Sensing: the raw event log and what the wear engine derives from it.
-- See docs/backend.md (Data model > Sensing and wears, Wear engine).

-- Append-only source of truth. Derived tables must stay rebuildable from it.
create table sensor_events (
  id bigint generated always as identity primary key,
  closet_id uuid not null references closets (id) on delete cascade,
  device_id uuid references devices (id) on delete set null,
  hanger_id uuid not null references hangers (id) on delete cascade,
  on_rail boolean not null,
  garment_on boolean not null,
  -- Per-hanger counter from the hanger, used to drop retried duplicates
  seq integer,
  -- The hub has no clock: occurred_at = received_at - age_ms
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create unique index sensor_events_hanger_seq_key on sensor_events (hanger_id, seq) where seq is not null;
create index sensor_events_hanger_occurred_idx on sensor_events (hanger_id, occurred_at);
create index sensor_events_closet_id_idx on sensor_events (closet_id);

create function sensor_events_reject_update() returns trigger
language plpgsql as $$
begin
  -- The one allowed change: the foreign key clearing device_id when a hub is deleted
  if old.device_id is not null and new.device_id is null
     and to_jsonb(new) - 'device_id' = to_jsonb(old) - 'device_id' then
    return new;
  end if;
  raise exception 'sensor_events is append-only';
end;
$$;

create trigger sensor_events_no_update
  before update on sensor_events
  for each row execute function sensor_events_reject_update();

-- One row per "garment away" session. closet_id is denormalized so Realtime can filter on it.
create table absences (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  hanger_id uuid not null references hangers (id) on delete cascade,
  -- The garment assigned to the hanger when it left; null if the hanger had none
  garment_id uuid references garments (id) on delete set null,
  left_at timestamptz not null,
  returned_at timestamptz,
  classification text not null default 'open'
    check (classification in ('open', 'browsed', 'tried_on', 'worn', 'worn_washed', 'missing')),
  -- After MVP: outfits table. No foreign key until it exists.
  outfit_id uuid,
  check (returned_at is null or returned_at >= left_at)
);

-- At most one session still away per hanger ('open', or 'missing' while still out)
create unique index absences_away_hanger_key on absences (hanger_id) where returned_at is null;
create index absences_closet_left_idx on absences (closet_id, left_at);
create index absences_garment_id_idx on absences (garment_id);

-- What every stat counts.
create table wears (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  garment_id uuid not null references garments (id) on delete cascade,
  -- Local date (closet timezone) of the absence's left_at
  worn_on date not null,
  source text not null default 'sensor' check (source in ('sensor', 'manual', 'confirmed')),
  absence_id uuid references absences (id) on delete cascade,
  -- After MVP: outfits table
  outfit_id uuid,
  created_at timestamptz not null default now()
);

-- The sweep writes a provisional wear while the garment is still out; never count it twice
create unique index wears_absence_id_key on wears (absence_id) where absence_id is not null;
create index wears_garment_worn_on_idx on wears (garment_id, worn_on);
create index wears_closet_worn_on_idx on wears (closet_id, worn_on);
