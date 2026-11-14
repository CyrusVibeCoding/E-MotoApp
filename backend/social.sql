-- Additive social foundation. Existing group tables and RPC are untouched.
create schema if not exists repride_private;
revoke all on schema repride_private from public, anon, authenticated;

create table repride_private.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (length(display_name) between 1 and 48),
  bio text not null default '' check (length(bio) <= 240),
  visibility text not null default 'private' check (visibility in ('private','public')),
  build jsonb not null default '{}',
  privacy_revision integer not null default 0,
  created_at timestamptz not null default now()
);
create table repride_private.friendships (
  requester uuid not null references repride_private.profiles(id) on delete cascade,
  recipient uuid not null references repride_private.profiles(id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(requester, recipient), check (requester <> recipient)
);
create unique index friendship_pair on repride_private.friendships(least(requester,recipient), greatest(requester,recipient));
create index friendship_recipient on repride_private.friendships(recipient);
create table repride_private.follows (
  follower uuid not null references repride_private.profiles(id) on delete cascade,
  followed uuid not null references repride_private.profiles(id) on delete cascade,
  primary key(follower, followed), check (follower <> followed)
);
create table repride_private.blocks (
  blocker uuid not null references repride_private.profiles(id) on delete cascade,
  blocked uuid not null references repride_private.profiles(id) on delete cascade,
  primary key(blocker, blocked), check (blocker <> blocked)
);
create table repride_private.posts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references repride_private.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index posts_owner_date on repride_private.posts(owner,created_at desc);
create table repride_private.publications (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references repride_private.profiles(id) on delete cascade,
  origin text not null check (length(origin) between 1 and 150),
  ride_date date not null,
  meters double precision not null check (meters >= 0 and meters < 10000000),
  moving_seconds double precision check (moving_seconds >= 0),
  average_speed double precision check (average_speed >= 0 and average_speed <= 45),
  top_speed double precision check (top_speed >= 0 and top_speed <= 45),
  route jsonb not null default '[]',
  hidden boolean not null default false,
  map_hidden boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner, origin)
);
create index publications_owner_date on repride_private.publications(owner,created_at desc);
create table repride_private.presence (
  owner uuid primary key references repride_private.profiles(id) on delete cascade,
  latitude double precision not null check (abs(latitude) <= 90),
  longitude double precision not null check (abs(longitude) <= 180),
  observed_at timestamptz not null,
  expires_at timestamptz not null
);
create table repride_private.reports (
  reporter uuid not null references repride_private.profiles(id) on delete cascade,
  reported uuid not null references repride_private.profiles(id) on delete cascade,
  reason text not null check (length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table repride_private.profiles enable row level security;
alter table repride_private.friendships enable row level security;
alter table repride_private.follows enable row level security;
alter table repride_private.blocks enable row level security;
alter table repride_private.posts enable row level security;
alter table repride_private.publications enable row level security;
alter table repride_private.presence enable row level security;
alter table repride_private.reports enable row level security;
revoke all on all tables in schema repride_private from public, anon, authenticated;

create function repride_private.blocked(a uuid, b uuid) returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from repride_private.blocks where (blocker=a and blocked=b) or (blocker=b and blocked=a))
$$;
create function repride_private.friends(a uuid, b uuid) returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from repride_private.friendships where accepted and ((requester=a and recipient=b) or (requester=b and recipient=a)))
$$;
create function repride_private.can_read(viewer uuid, author uuid) returns boolean language sql stable set search_path = '' as $$
  select viewer=author or (not repride_private.blocked(viewer,author) and exists(select 1 from repride_private.profiles p where p.id=author and (p.visibility='public' or repride_private.friends(viewer,author))))
$$;
revoke all on function repride_private.blocked(uuid,uuid), repride_private.friends(uuid,uuid), repride_private.can_read(uuid,uuid) from public, anon, authenticated;

-- The non-exposed handler owns authorization. The public invoker delegates to it.
create function repride_private.social_action(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); target uuid; result jsonb; profile repride_private.profiles;
  build jsonb; observed timestamptz; expires timestamptz; line jsonb; coord jsonb; mod jsonb; clean_mods jsonb; clean_line jsonb; clean_route jsonb;
begin
  if uid is null then raise exception 'Sign in to connect with riders.'; end if;
  if action in ('publish_ride','presence','clear_routes') then
    perform 1 from repride_private.profiles where id=uid for update;
  end if;
  if action='me' then
    select to_jsonb(p) into result from repride_private.profiles p where id=uid;
    return jsonb_build_object('id',uid,'profile',result);
  end if;
  if action='save_profile' then
    build := coalesce(payload->'build','{}');
    if octet_length(build::text)>20000 or jsonb_typeof(build)<>'object' then raise exception 'Build is too large.'; end if;
    -- Only the canonical bike fields enter public profile data.
    build := jsonb_build_object('make',left(coalesce(build->>'make',''),80),'model',left(coalesce(build->>'model',''),80),
      'nickname',left(coalesce(build->>'nickname',''),80),'color',coalesce(build->>'color','#a5d9ef'),'mods',coalesce(build->'mods','[]'));
    if jsonb_typeof(build->'mods') <> 'array' or jsonb_array_length(build->'mods')>100 then raise exception 'Invalid installed mods.'; end if;
    if (build->>'color') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid build color.'; end if;
    clean_mods := '[]'::jsonb;
    for mod in select value from jsonb_array_elements(build->'mods') loop
      if jsonb_typeof(mod->'id') is distinct from 'string' or jsonb_typeof(mod->'name') is distinct from 'string' or jsonb_typeof(mod->'category') is distinct from 'string'
        or length(trim(mod->>'id')) not between 1 and 150 or length(trim(mod->>'name')) not between 1 and 100 or length(trim(mod->>'category')) not between 1 and 40 then raise exception 'Invalid installed mod.'; end if;
      clean_mods := clean_mods || jsonb_build_array(jsonb_build_object('id',trim(mod->>'id'),'name',trim(mod->>'name'),'category',trim(mod->>'category')));
    end loop;
    build := jsonb_set(build,'{mods}',clean_mods);
    insert into repride_private.profiles(id,username,display_name,bio,visibility,build)
      values(uid,lower(trim(payload->>'username')),trim(payload->>'display_name'),coalesce(payload->>'bio',''),coalesce(payload->>'visibility','private'),build)
      on conflict(id) do update set username=excluded.username,display_name=excluded.display_name,bio=excluded.bio,visibility=excluded.visibility,build=excluded.build;
    return jsonb_build_object('ok',true);
  end if;
  if not exists(select 1 from repride_private.profiles where id=uid) then raise exception 'Set up your rider profile first.'; end if;
  if action='search' then
    select coalesce(jsonb_agg(row),'[]') into result from (
      select p.id,p.username,p.display_name,p.visibility from repride_private.profiles p
      where p.id<>uid and not repride_private.blocked(uid,p.id)
      and (p.username ilike '%' || left(trim(payload->>'query'),48) || '%' or p.display_name ilike '%' || left(trim(payload->>'query'),48) || '%')
      order by p.username limit 30
    ) row;
    return result;
  end if;
  if action='connections' then
    select coalesce(jsonb_agg(row),'[]') into result from (
      select p.id,p.username,p.display_name,f.accepted,(f.recipient=uid) incoming
      from repride_private.friendships f join repride_private.profiles p on p.id=case when f.requester=uid then f.recipient else f.requester end
      where (f.requester=uid or f.recipient=uid) and not repride_private.blocked(uid,p.id) order by f.created_at desc limit 200
    ) row;
    return result;
  end if;
  if action in ('profile','request','accept','remove_friend','follow','unfollow','block','report') then
    target := (payload->>'target')::uuid;
    if target is null or not exists(select 1 from repride_private.profiles where id=target) then raise exception 'Rider unavailable.'; end if;
    if action='block' then
      if target=uid then raise exception 'Choose another rider.'; end if;
      insert into repride_private.blocks values(uid,target) on conflict do nothing;
      delete from repride_private.friendships where (requester=uid and recipient=target) or (requester=target and recipient=uid);
      delete from repride_private.follows where (follower=uid and followed=target) or (follower=target and followed=uid);
      return jsonb_build_object('ok',true);
    end if;
    if repride_private.blocked(uid,target) then raise exception 'Rider unavailable.'; end if;
    if action='profile' then
      select * into profile from repride_private.profiles where id=target;
      result := jsonb_build_object('id',profile.id,'username',profile.username,'display_name',profile.display_name,'bio',profile.bio,'visibility',profile.visibility,
        'can_read',repride_private.can_read(uid,target),'build',case when repride_private.can_read(uid,target) then profile.build else null end,
        'total_meters',case when repride_private.can_read(uid,target) then (select coalesce(sum(meters),0) from repride_private.publications where owner=target and not deleted and (not hidden or uid=target)) else null end,
        'ride_count',case when repride_private.can_read(uid,target) then (select count(*) from repride_private.publications where owner=target and not deleted and (not hidden or uid=target)) else null end,
        'friend',repride_private.friends(uid,target),'following',exists(select 1 from repride_private.follows where follower=uid and followed=target),
        'requested',exists(select 1 from repride_private.friendships where requester=uid and recipient=target),
        'incoming',exists(select 1 from repride_private.friendships where requester=target and recipient=uid and not accepted));
      return result;
    elsif action='request' then
      insert into repride_private.friendships(requester,recipient) values(uid,target) on conflict do nothing;
    elsif action='accept' then
      update repride_private.friendships set accepted=true where requester=target and recipient=uid;
    elsif action='remove_friend' then
      delete from repride_private.friendships where (requester=uid and recipient=target) or (requester=target and recipient=uid);
    elsif action='follow' then
      insert into repride_private.follows values(uid,target) on conflict do nothing;
    elsif action='unfollow' then
      delete from repride_private.follows where follower=uid and followed=target;
    elsif action='report' then
      insert into repride_private.reports(reporter,reported,reason) values(uid,target,trim(payload->>'reason'));
    end if;
    return jsonb_build_object('ok',true);
  end if;
  if action='post' then
    insert into repride_private.posts(id,owner,body) values((payload->>'id')::uuid,uid,trim(payload->>'body')) on conflict do nothing;
    return jsonb_build_object('ok',true);
  end if;
  if action='delete_post' then
    delete from repride_private.posts where id=(payload->>'id')::uuid and owner=uid;
    return jsonb_build_object('ok',true);
  end if;
  if action='publish_ride' then
    if coalesce((payload->>'privacy_revision')::integer,0) <> (select privacy_revision from repride_private.profiles where id=uid) then raise exception 'Privacy settings changed. Retry with current privacy zones.'; end if;
    if octet_length(coalesce(payload->'route','[]')::text)>1000000 or jsonb_typeof(payload->'route')<>'array' then raise exception 'Invalid shared route.'; end if;
    clean_route := '[]'::jsonb;
    for line in select value from jsonb_array_elements(coalesce(payload->'route','[]')) loop
      if jsonb_typeof(line)<>'array' then raise exception 'Invalid shared segment.'; end if;
      clean_line := '[]'::jsonb;
      for coord in select value from jsonb_array_elements(line) loop
        if not (coord ? 'latitude' and coord ? 'longitude') or not (abs((coord->>'latitude')::double precision)<=90 and abs((coord->>'longitude')::double precision)<=180) then raise exception 'Invalid shared coordinate.'; end if;
        clean_line := clean_line || jsonb_build_array(jsonb_build_object('latitude',(coord->>'latitude')::double precision,'longitude',(coord->>'longitude')::double precision));
      end loop;
      clean_route := clean_route || jsonb_build_array(clean_line);
    end loop;
    -- Exact start times, addresses, and private points have no columns here.
    insert into repride_private.publications(owner,origin,ride_date,meters,route,moving_seconds,average_speed,top_speed)
      values(uid,payload->>'origin',(payload->>'ride_date')::date,(payload->>'meters')::double precision,clean_route,(payload->>'moving_seconds')::double precision,(payload->>'average_speed')::double precision,(payload->>'top_speed')::double precision)
      on conflict(owner,origin) do nothing;
    return jsonb_build_object('ok',true);
  end if;
  if action='clear_routes' then
    update repride_private.profiles set privacy_revision=privacy_revision+1 where id=uid;
    update repride_private.publications set route='[]'::jsonb where owner=uid;
    delete from repride_private.presence where owner=uid;
    return jsonb_build_object('revision',(select privacy_revision from repride_private.profiles where id=uid));
  end if;
  if action='ride_visibility' then
    update repride_private.publications set hidden=coalesce((payload->>'hidden')::boolean,hidden),
      map_hidden=coalesce((payload->>'map_hidden')::boolean,map_hidden),deleted=deleted or coalesce((payload->>'deleted')::boolean,false),
      route=case when coalesce((payload->>'deleted')::boolean,false) then '[]'::jsonb else route end
      where owner=uid and origin=payload->>'origin';
    return jsonb_build_object('ok',true);
  end if;
  if action='presence' then
    delete from repride_private.presence where expires_at<=now();
    if coalesce((payload->>'stop')::boolean,false) then
      delete from repride_private.presence where owner=uid;
    else
      if coalesce((payload->>'privacy_revision')::integer,0) <> (select privacy_revision from repride_private.profiles where id=uid) then raise exception 'Privacy settings changed.'; end if;
      observed := to_timestamp((payload->>'timestamp')::double precision/1000);
      expires := least(to_timestamp((payload->>'until')::double precision/1000), now()+interval '15 minutes');
      if observed<now()-interval '15 seconds' or observed>now()+interval '5 seconds' or expires<=now() then raise exception 'A fresh location is required.'; end if;
      insert into repride_private.presence values(uid,(payload->>'latitude')::double precision,(payload->>'longitude')::double precision,observed,least(expires,now()+interval '30 seconds'))
        on conflict(owner) do update set latitude=excluded.latitude,longitude=excluded.longitude,observed_at=excluded.observed_at,expires_at=excluded.expires_at;
    end if;
    return jsonb_build_object('ok',true);
  end if;
  if action='locations' then
    select coalesce(jsonb_agg(row),'[]') into result from (
      select p.id,p.display_name,p.username,l.latitude,l.longitude,l.observed_at,l.expires_at
      from repride_private.presence l join repride_private.profiles p on p.id=l.owner
      where l.expires_at>now() and l.observed_at>now()-interval '20 seconds' and repride_private.friends(uid,l.owner) and not repride_private.blocked(uid,l.owner)
    ) row;
    return result;
  end if;
  if action='feed' then
    target := nullif(payload->>'target','')::uuid;
    select coalesce(jsonb_agg(row order by row.created_at desc,row.id desc),'[]') into result from (
      select a.*,p.username,p.display_name from (
        select 'post:'||id::text id,owner,'post' kind,body,null::date ride_date,null::double precision meters,null::jsonb route,false hidden,false map_hidden,null::double precision moving_seconds,null::double precision average_speed,null::double precision top_speed,created_at from repride_private.posts
        union all
        select 'ride:'||id::text,owner,'ride',null,ride_date,meters,case when map_hidden then '[]'::jsonb else route end,hidden,map_hidden,moving_seconds,average_speed,top_speed,ride_date::timestamptz from repride_private.publications where not deleted
      ) a join repride_private.profiles p on p.id=a.owner
      where repride_private.can_read(uid,a.owner) and (not a.hidden or a.owner=uid)
      and (case when target is not null then a.owner=target else a.owner=uid or repride_private.friends(uid,a.owner) or exists(select 1 from repride_private.follows where follower=uid and followed=a.owner) end)
      and (payload->>'before' is null or (a.created_at,a.id)<((payload->>'before')::timestamptz,payload->>'before_id'))
      order by a.created_at desc,a.id desc limit 20
    ) row;
    return result;
  end if;
  raise exception 'Unknown social action.';
end;
$$;
revoke all on function repride_private.social_action(text,jsonb) from public, anon;
grant usage on schema repride_private to authenticated;
grant execute on function repride_private.social_action(text,jsonb) to authenticated;
create function public.repride_social(action text, payload jsonb default '{}') returns jsonb language sql security invoker set search_path = '' as $$
  select repride_private.social_action(action,payload)
$$;
revoke all on function public.repride_social(text,jsonb) from public, anon;
grant execute on function public.repride_social(text,jsonb) to authenticated;
