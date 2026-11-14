-- Dedicated non-exposed schema; all access goes through one checked RPC.
create schema if not exists emoto_private;
revoke all on schema emoto_private from public, anon, authenticated;
create table emoto_private.groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  expires_at timestamptz not null default now() + interval '12 hours'
);
create table emoto_private.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  group_id uuid not null references emoto_private.groups(id) on delete cascade,
  name text not null check (length(name) between 1 and 32),
  lease_until timestamptz not null default now() + interval '90 seconds',
  latitude double precision, longitude double precision, accuracy double precision,
  observed_at timestamptz,
  received_at timestamptz,
  sharing boolean not null default false
);
create index on emoto_private.members(group_id);
create table emoto_private.attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_at timestamptz not null, count integer not null
);
alter table emoto_private.groups enable row level security;
alter table emoto_private.members enable row level security;
alter table emoto_private.attempts enable row level security;
revoke all on all tables in schema emoto_private from public, anon, authenticated;

-- Invoked by the authenticated handler and scheduled maintenance only.
create function emoto_private.cleanup() returns void language sql
set search_path = '' as $$
  delete from emoto_private.members where lease_until <= now();
  delete from emoto_private.groups g where expires_at <= now()
    or not exists(select 1 from emoto_private.members m where m.group_id = g.id);
  delete from emoto_private.attempts where window_at < now() - interval '1 day';
$$;
revoke all on function emoto_private.cleanup() from public, anon, authenticated;

-- SECURITY DEFINER is isolated in the non-exposed schema. Identity comes ONLY
-- from auth.uid(), never from request fields or editable metadata.
create function emoto_private.group_action(action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); gid uuid; g emoto_private.groups;
  n text; attempt_count integer; lat double precision; lon double precision;
  acc double precision; observed timestamptz;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serialize actions per identity, including concurrent create/join/leave.
  perform pg_advisory_xact_lock(hashtext(uid::text));
  perform emoto_private.cleanup();
  if action in ('create', 'join') then
    n := trim(payload->>'name');
    if n is null or length(n) not between 1 and 32 then
      raise exception 'Use a display name of 1-32 characters';
    end if;
    insert into emoto_private.attempts values(uid, now(), 1)
    on conflict(user_id) do update set
      count = case when attempts.window_at < now() - interval '1 minute' then 1 else attempts.count + 1 end,
      window_at = case when attempts.window_at < now() - interval '1 minute' then now() else attempts.window_at end
    returning count into attempt_count;
    -- Return errors so failed joins still commit the rate-limit counter.
    if attempt_count > 10 then return jsonb_build_object('error', 'Too many attempts. Wait one minute.'); end if;
    select group_id into gid from emoto_private.members where user_id = uid;
    if gid is not null then
      select * into g from emoto_private.groups where id = gid for update;
      if action = 'join' and g.code <> upper(trim(payload->>'code')) then
        return jsonb_build_object('error', 'Leave your current group first.');
      end if;
    elsif action = 'create' then
      insert into emoto_private.groups(code)
      values(upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))) returning * into g;
      gid := g.id;
    else
      select * into g from emoto_private.groups
      where code = upper(trim(payload->>'code')) and expires_at > now() for update;
      if g.id is null then return jsonb_build_object('error', 'Invalid or expired invite code.'); end if;
      gid := g.id;
    end if;
    if (select count(*) from emoto_private.members where group_id = gid) >= 20
      and not exists(select 1 from emoto_private.members where user_id = uid) then
      return jsonb_build_object('error', 'This group is full.');
    end if;
    insert into emoto_private.members(user_id, group_id, name) values(uid, gid, n)
      on conflict(user_id) do update set name = excluded.name, lease_until = now() + interval '90 seconds';
  elsif action in ('sync', 'leave') then
    gid := (payload->>'group_id')::uuid;
    select * into g from emoto_private.groups where id = gid and expires_at > now() for update;
    if action = 'leave' then
      delete from emoto_private.members where user_id = uid and group_id = gid;
      perform emoto_private.cleanup();
      return jsonb_build_object('left', true);
    end if;
    if g.id is null or not exists(select 1 from emoto_private.members
      where user_id = uid and group_id = gid and lease_until > now()) then
      return jsonb_build_object('error', 'Group session expired. Create or join again.', 'expired', true);
    end if;
    update emoto_private.members set lease_until = now() + interval '90 seconds', sharing = false
      where user_id = uid;
    if payload->'location' is not null and payload->'location' <> 'null'::jsonb then
      lat := (payload#>>'{location,latitude}')::double precision;
      lon := (payload#>>'{location,longitude}')::double precision;
      acc := (payload#>>'{location,accuracy}')::double precision;
      observed := to_timestamp((payload#>>'{location,timestamp}')::double precision / 1000);
      if lat between -90 and 90 and lon between -180 and 180 and acc between 0 and 35
        and observed between now() - interval '15 seconds' and now() + interval '5 seconds' then
        update emoto_private.members set latitude = lat, longitude = lon, accuracy = acc,
          observed_at = observed, received_at = now(), sharing = true
          where user_id = uid and (observed_at is null or observed >= observed_at);
      end if;
    end if;
  else raise exception 'Unknown group action'; end if;
  return jsonb_build_object('id', g.id, 'code', g.code, 'expires_at', g.expires_at,
    'server_time', now(), 'self_id', uid,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.user_id, 'name', m.name, 'latitude', m.latitude, 'longitude', m.longitude,
      'accuracy', m.accuracy, 'observed_at', m.observed_at, 'received_at', m.received_at,
      'sharing', m.sharing)) from emoto_private.members m
      where m.group_id = gid and m.lease_until > now()), '[]'::jsonb));
end;
$$;
revoke all on function emoto_private.group_action(text,jsonb) from public, anon;
grant usage on schema emoto_private to authenticated;
grant execute on function emoto_private.group_action(text,jsonb) to authenticated;
create function public.emoto_group(action text, payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select emoto_private.group_action(action, payload);
$$;
revoke all on function public.emoto_group(text,jsonb) from public, anon;
grant execute on function public.emoto_group(text,jsonb) to authenticated;

-- Configure pg_cron in Supabase and run backend/schedule.sql for physical cleanup.
-- Access expiry is enforced on every request even without the scheduled job.
