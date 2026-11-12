-- Garment photos taken in the app (docs/backend.md, Storage buckets).
-- Private bucket; paths are {closet_id}/{garment_id}/original.jpg and cutout.webp.
-- The app reads them through GET /api/garments/{id}/photo, which signs a short-lived URL.

insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

-- A signed-in user reaches only the folders of the closet they own (first path segment)
create policy "owner reads garment photos" on storage.objects for select to authenticated
  using (bucket_id = 'garments' and public.owns_closet(((storage.foldername(name))[1])::uuid));

create policy "owner adds garment photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'garments' and public.owns_closet(((storage.foldername(name))[1])::uuid));

create policy "owner replaces garment photos" on storage.objects for update to authenticated
  using (bucket_id = 'garments' and public.owns_closet(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'garments' and public.owns_closet(((storage.foldername(name))[1])::uuid));
