-- white/blink2 (Find it) is momentary: the hanger blinks twice, then shows its previous light
-- again (docs/api.md, Light vocabulary). So an ack only copies the lasting lights onto the hanger.
create or replace function commands_apply_ack() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.color = 'white' then
    return new;
  end if;
  update public.hangers set led_color = new.color, led_pattern = new.pattern
  where id = new.hanger_id;
  return new;
end;
$$;
