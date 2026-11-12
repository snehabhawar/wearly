-- Weekly plans, swipe decisions and the hub's light command queue.
-- See docs/backend.md (Data model > Planning, decisions, lights).

create table plans (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  week_start date not null,
  generated_at timestamptz not null default now(),
  forecast jsonb,
  unique (closet_id, week_start)
);

create table plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  day date not null,
  slot text not null check (slot in ('top', 'bottom', 'outer', 'one_piece')),
  garment_id uuid references garments (id) on delete set null,
  -- A hanger without a photographed garment is a mystery pick
  hanger_id uuid references hangers (id) on delete set null,
  reason text,
  status text not null default 'planned' check (status in ('planned', 'worn', 'swapped', 'skipped')),
  unique (plan_id, day, slot)
);

create table swipe_decisions (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references garments (id) on delete cascade,
  decision text not null check (decision in ('keep', 'let_go', 'style')),
  route text check (route in ('donate', 'resell', 'swap')),
  -- Keep starts a 30-day challenge
  challenge_until timestamptz,
  decided_at timestamptz not null default now(),
  check (route is null or decision = 'let_go')
);

create index swipe_decisions_garment_id_idx on swipe_decisions (garment_id);

-- Light commands for the hub. The hub polls, then acks what it forwarded.
create table commands (
  id bigint generated always as identity primary key,
  closet_id uuid not null references closets (id) on delete cascade,
  hanger_id uuid not null references hangers (id) on delete cascade,
  color text not null,
  pattern text not null,
  reason text,
  created_at timestamptz not null default now(),
  -- Stale commands never fire. Plan lights pass their own expiry (end of that local day)
  expires_at timestamptz not null default now() + interval '5 minutes',
  acked_at timestamptz,
  -- The fixed light vocabulary (docs/api.md, Light vocabulary)
  check ((color, pattern) in (('purple', 'steady'), ('amber', 'breathe'), ('white', 'blink2'), ('off', 'off')))
);

create index commands_pending_idx on commands (closet_id, hanger_id, created_at desc) where acked_at is null;

-- Once the hub acks a command, the hanger shows that light, so the app never shows one still queued
create function commands_apply_ack() returns trigger
language plpgsql set search_path = ''
as $$
begin
  update public.hangers set led_color = new.color, led_pattern = new.pattern
  where id = new.hanger_id;
  return new;
end;
$$;

create trigger commands_on_ack
  after update of acked_at on commands
  for each row when (old.acked_at is null and new.acked_at is not null)
  execute function commands_apply_ack();
