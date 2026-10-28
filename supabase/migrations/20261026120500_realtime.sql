-- Tables the app subscribes to, filtered by closet_id. See docs/backend.md (Realtime).
alter publication supabase_realtime add table hangers, absences, wears, commands;
