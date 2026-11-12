-- Stats views read by the app, the planner and the swipe deck.
-- security_invoker makes them respect the caller's RLS.
-- See docs/backend.md (Views).

-- Northern-hemisphere meteorological seasons
create function season_of(d date) returns text
language sql immutable set search_path = ''
as $$
  select case
    when extract(month from d) in (3, 4, 5) then 'spring'
    when extract(month from d) in (6, 7, 8) then 'summer'
    when extract(month from d) in (9, 10, 11) then 'fall'
    else 'winter'
  end;
$$;

create view garment_stats with (security_invoker = true) as
with base as (
  select
    g.id as garment_id,
    g.closet_id,
    g.status,
    g.price_cents,
    g.seasons,
    g.created_at,
    (now() at time zone c.timezone)::date as today
  from garments g
  join closets c on c.id = g.closet_id
),
agg as (
  select
    b.*,
    (select count(*) from wears w
      where w.garment_id = b.garment_id and w.worn_on > b.today - 90) as wears_90d,
    (select count(*) from wears w
      where w.garment_id = b.garment_id and w.worn_on >= date_trunc('year', b.today)::date) as wears_ytd,
    (select max(w.worn_on) from wears w where w.garment_id = b.garment_id) as last_worn_on,
    -- Considered but not worn: browsed or tried-on sessions that never became a wear
    (select count(*) from absences a
      where a.garment_id = b.garment_id
        and a.classification in ('browsed', 'tried_on')
        and not exists (select 1 from wears w where w.absence_id = a.id)) as browsed_count
  from base b
)
select
  garment_id,
  closet_id,
  wears_90d,
  wears_ytd,
  last_worn_on,
  browsed_count,
  case when wears_ytd > 0 then round(price_cents::numeric / wears_ytd) end as cost_per_wear,
  -- Days since the last wear (or since the garment was added) that fall in one of its
  -- seasons, so a winter coat isn't counted as idle in July
  (select count(*) from generate_series(
      coalesce(last_worn_on + 1, (created_at at time zone 'UTC')::date), today, interval '1 day') as d
    where seasons is null or cardinality(seasons) = 0 or season_of(d::date) = any (seasons)
  )::integer as idle_days_in_season
from agg;

create view closet_summary with (security_invoker = true) as
select
  c.id as closet_id,
  (select count(*) from hangers h where h.closet_id = c.id) as hanger_count,
  (select count(*) from garments g
    where g.closet_id = c.id and g.status <> 'rehomed' and g.photo_path is not null) as photographed_count,
  -- Share of garments still in the closet that were worn in the last 90 days
  (select round(100.0 * count(*) filter (where s.wears_90d > 0) / nullif(count(*), 0))
    from garment_stats s join garments g on g.id = s.garment_id
    where s.closet_id = c.id and g.status <> 'rehomed') as worn_90d_pct,
  -- Rehomed garments whose hanger assignment ended this (local) year
  (select count(distinct g.id) from garments g
    join hanger_assignments ha on ha.garment_id = g.id
    where g.closet_id = c.id and g.status = 'rehomed'
      and ha.ended_at >= date_trunc('year', now() at time zone c.timezone) at time zone c.timezone
  ) as rehomed_this_year
from closets c;
