-- Row-level security: a signed-in user only reaches rows of the closet they own.
-- The service role (hub ingest, wear engine, scripts) bypasses RLS.
-- See docs/backend.md (Row-level security).

-- After MVP the body switches to closet_members; the policies stay unchanged.
create function owns_closet(target_closet_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.closets
    where id = target_closet_id and owner_id = (select auth.uid())
  );
$$;

revoke execute on function owns_closet(uuid) from public, anon;
grant execute on function owns_closet(uuid) to authenticated;

alter table closets enable row level security;
alter table devices enable row level security;
alter table hangers enable row level security;
alter table garments enable row level security;
alter table hanger_assignments enable row level security;
alter table sensor_events enable row level security;
alter table absences enable row level security;
alter table wears enable row level security;
alter table plans enable row level security;
alter table plan_items enable row level security;
alter table swipe_decisions enable row level security;
alter table commands enable row level security;

create policy "owner manages closet" on closets for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Tables with closet_id that users may change
create policy "owner manages hangers" on hangers for all to authenticated
  using (owns_closet(closet_id)) with check (owns_closet(closet_id));
create policy "owner manages garments" on garments for all to authenticated
  using (owns_closet(closet_id)) with check (owns_closet(closet_id));
create policy "owner manages wears" on wears for all to authenticated
  using (owns_closet(closet_id)) with check (owns_closet(closet_id));
create policy "owner manages plans" on plans for all to authenticated
  using (owns_closet(closet_id)) with check (owns_closet(closet_id));

-- Child tables check through their parent
create policy "owner manages hanger assignments" on hanger_assignments for all to authenticated
  using (exists (select 1 from hangers h where h.id = hanger_id and owns_closet(h.closet_id)))
  with check (exists (select 1 from hangers h where h.id = hanger_id and owns_closet(h.closet_id)));
create policy "owner manages plan items" on plan_items for all to authenticated
  using (exists (select 1 from plans p where p.id = plan_id and owns_closet(p.closet_id)))
  with check (exists (select 1 from plans p where p.id = plan_id and owns_closet(p.closet_id)));
create policy "owner manages swipe decisions" on swipe_decisions for all to authenticated
  using (exists (select 1 from garments g where g.id = garment_id and owns_closet(g.closet_id)))
  with check (exists (select 1 from garments g where g.id = garment_id and owns_closet(g.closet_id)));

-- Read-only for users: only the service role writes these
create policy "owner reads devices" on devices for select to authenticated
  using (owns_closet(closet_id));
create policy "owner reads sensor events" on sensor_events for select to authenticated
  using (owns_closet(closet_id));
create policy "owner reads absences" on absences for select to authenticated
  using (owns_closet(closet_id));
create policy "owner reads commands" on commands for select to authenticated
  using (owns_closet(closet_id));

-- devices.secret_hash is never selectable by users
revoke select on devices from anon, authenticated;
grant select (id, closet_id, kind, name, last_seen_at, created_at) on devices to authenticated;
