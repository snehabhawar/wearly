-- Live FASHN try-on in Style it (docs/backend.md, AI jobs).
-- ai_jobs tracks every external AI call; a try-on job chains one FASHN prediction per garment.
-- The private tryon bucket holds results ({closet_id}/{job_id}.webp) and the user's own
-- model photo ({closet_id}/model.jpg).

-- The user's own full-body photo for try-on; null means the demo model
alter table closets add column model_photo_path text;

create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  closet_id uuid not null references closets (id) on delete cascade,
  kind text not null check (kind in ('tryon', 'tagging', 'bg_remove')),
  provider text not null default 'fashn',
  -- The provider's prediction running right now (one per chain step)
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  -- tryon: { model, steps: [{ garment_id, category }] }
  input jsonb not null default '{}',
  -- tryon: { step } while running
  output jsonb not null default '{}',
  output_path text,
  -- Same model photo + same garment photos = same image: reused instead of paying again
  cache_key text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index ai_jobs_closet_created_idx on ai_jobs (closet_id, created_at desc);
create index ai_jobs_cache_idx on ai_jobs (closet_id, kind, cache_key);

alter table ai_jobs enable row level security;
create policy "owner manages ai jobs" on ai_jobs for all to authenticated
  using (owns_closet(closet_id)) with check (owns_closet(closet_id));

insert into storage.buckets (id, name, public)
values ('tryon', 'tryon', false)
on conflict (id) do nothing;

create policy "owner reads try-on images" on storage.objects for select to authenticated
  using (bucket_id = 'tryon' and public.owns_closet(((storage.foldername(name))[1])::uuid));

create policy "owner adds try-on images" on storage.objects for insert to authenticated
  with check (bucket_id = 'tryon' and public.owns_closet(((storage.foldername(name))[1])::uuid));

create policy "owner replaces try-on images" on storage.objects for update to authenticated
  using (bucket_id = 'tryon' and public.owns_closet(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'tryon' and public.owns_closet(((storage.foldername(name))[1])::uuid));

create policy "owner removes try-on images" on storage.objects for delete to authenticated
  using (bucket_id = 'tryon' and public.owns_closet(((storage.foldername(name))[1])::uuid));
