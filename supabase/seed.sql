create extension if not exists pgcrypto;

-- Fixed IDs so the script and the app can refer to them
do $$
declare
  uid  uuid := '00000000-0000-0000-0000-0000000000a1';
  cid  uuid := '00000000-0000-0000-0000-0000000000c1';
  did  uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  -- Demo user
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'demo@wearly.app', crypt('wearly-demo', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', 'demo@wearly.app'),
    'email', now(), now(), now())
  on conflict do nothing;

  -- Closet (Cincinnati coords; change to yours)
  insert into closets (id, owner_id, name, timezone, wear_profile, latitude, longitude)
  values (cid, uid, 'Demo closet', 'America/New_York', 'demo', 39.1031, -84.5120);

  -- Dev hub. Secret: dev-hub-secret (must match HUB_DEV_SECRET in .env.local)
  insert into devices (id, closet_id, kind, name, secret_hash)
  values (did, cid, 'hub', 'Dev hub', encode(digest('dev-hub-secret', 'sha256'), 'hex'));

  -- 24 hangers
  insert into hangers (id, closet_id, number, on_rail, garment_on, led_color, led_pattern)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
         cid, n, true, true, null, null
  from generate_series(1, 24) n;

  -- 18 photographed garments on hangers 1-18
  insert into garments (id, closet_id, name, category, color, seasons, formality,
                        price_cents, photo_path, tags_source, status, created_at)
  select ('00000000-0000-0000-0000-0000000002' || lpad(n::text, 2, '0'))::uuid,
         cid, g.name, g.category, g.color, g.seasons, g.formality, g.price,
         '/demo/garments/' || lpad(n::text, 2, '0') || '.jpg', 'user', 'active',
         now() - interval '14 months'
  from (values
    (1,  'White oxford shirt',   'top',       'white',  '{spring,summer,fall}',  3, 4500),
    (2,  'Navy linen shirt',     'top',       'navy',   '{spring,summer}',       2, 5200),
    (3,  'Grey crewneck tee',    'top',       'grey',   '{spring,summer,fall}',  1, 1800),
    (4,  'Black fitted tee',     'top',       'black',  '{spring,summer,fall}',  1, 2000),
    (5,  'Striped breton top',   'top',       'blue',   '{spring,fall}',         2, 3800),
    (6,  'Cream knit sweater',   'top',       'cream',  '{fall,winter}',         2, 6800),
    (7,  'Olive overshirt',      'outer',     'olive',  '{spring,fall}',         2, 7400),
    (8,  'Camel wool coat',      'outer',     'camel',  '{fall,winter}',         4, 18900),
    (9,  'Dark indigo jeans',    'bottom',    'indigo', '{spring,summer,fall,winter}', 2, 7800),
    (10, 'Black trousers',       'bottom',    'black',  '{spring,summer,fall,winter}', 4, 6900),
    (11, 'Beige chinos',         'bottom',    'beige',  '{spring,summer,fall}',  3, 5900),
    (12, 'Floral midi skirt',    'bottom',    'multi',  '{spring,summer}',       3, 4900),
    (13, 'Denim jacket',         'outer',     'blue',   '{spring,fall}',         2, 8200),
    (14, 'Black blazer',         'outer',     'black',  '{spring,summer,fall,winter}', 5, 12900),
    (15, 'Linen wrap dress',     'one_piece', 'green',  '{spring,summer}',       3, 8800),
    (16, 'Rust turtleneck',      'top',       'rust',   '{fall,winter}',         2, 5400),
    (17, 'Grey wide-leg pants',  'bottom',    'grey',   '{spring,fall,winter}',  3, 6200),
    (18, 'Burgundy silk blouse', 'top',       'burgundy','{spring,fall}',        4, 9400)
  ) as g(n, name, category, color, seasons, formality, price);

  -- 6 mystery garments (no photo, no tags) on hangers 19-24
  insert into garments (id, closet_id, status, created_at)
  select ('00000000-0000-0000-0000-0000000002' || lpad(n::text, 2, '0'))::uuid,
         cid, 'active', now() - interval '14 months'
  from generate_series(19, 24) n;

  -- 3 rehomed garments (history only): ids 31-33, previously on hangers 19-21
  insert into garments (id, closet_id, name, category, color, seasons, formality,
                        price_cents, photo_path, tags_source, status, created_at)
  values
   ('00000000-0000-0000-0000-000000000231', cid, 'Old green hoodie', 'top',    'green', '{fall,winter}',  1, 3500, null, 'user', 'rehomed', now() - interval '14 months'),
   ('00000000-0000-0000-0000-000000000232', cid, 'Pleated skirt',    'bottom', 'plaid', '{fall,winter}',  3, 3200, null, 'user', 'rehomed', now() - interval '14 months'),
   ('00000000-0000-0000-0000-000000000233', cid, 'Boxy denim vest',  'outer',  'blue',  '{spring,fall}',  2, 4100, null, 'user', 'rehomed', now() - interval '14 months');

  -- Open assignments for hangers 1-24 (current garments)
  insert into hanger_assignments (hanger_id, garment_id, started_at)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
         ('00000000-0000-0000-0000-0000000002' || lpad(n::text, 2, '0'))::uuid,
         case when n between 19 and 21 then now() - interval '40 days'
              else now() - interval '14 months' end
  from generate_series(1, 24) n;

  -- Ended assignments for the rehomed three (hangers 19-21)
  insert into hanger_assignments (hanger_id, garment_id, started_at, ended_at)
  values
   ('00000000-0000-0000-0000-000000000119', '00000000-0000-0000-0000-000000000231', now() - interval '14 months', now() - interval '40 days'),
   ('00000000-0000-0000-0000-000000000120', '00000000-0000-0000-0000-000000000232', now() - interval '14 months', now() - interval '40 days'),
   ('00000000-0000-0000-0000-000000000121', '00000000-0000-0000-0000-000000000233', now() - interval '14 months', now() - interval '40 days');
end $$;
