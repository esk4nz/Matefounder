create extension if not exists pgcrypto;
create extension if not exists vector;

-- DROP: on_auth_user_created, storage policies (profile-images), таблиці, функції.
drop trigger if exists on_auth_user_created on auth.users;

drop policy if exists "profile_images_public_read" on storage.objects;
drop policy if exists "profile_images_insert_own" on storage.objects;
drop policy if exists "profile_images_update_own" on storage.objects;
drop policy if exists "profile_images_delete_own" on storage.objects;

drop table if exists public.user_matches cascade;
drop table if exists public.reports cascade;
drop table if exists public.reviews cascade;
drop table if exists public.chat_messages cascade;
drop table if exists public.chat_participants cascade;
drop table if exists public.chat_rooms cascade;
drop table if exists public.listing_images cascade;
drop table if exists public.listings cascade;
drop table if exists public.profile_tags cascade;
drop table if exists public.user_blocks cascade;
drop table if exists public.tags cascade;
drop table if exists public.profiles cascade;
drop table if exists public.cities cascade;
drop table if exists public.regions cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.username_is_taken(text) cascade;
drop function if exists public.admin_console_list_users(text, integer, integer) cascade;

-- regions, cities
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  updated_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete restrict,
  name text not null,
  updated_at timestamptz not null default now()
);

create index if not exists cities_region_id_idx on public.cities (region_id);
create index if not exists cities_region_name_idx on public.cities (region_id, lower(name));

-- profiles, tags, profile_tags
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  first_name text not null,
  last_name text not null,
  avatar_path text,
  bio text,
  gender text,
  city_id uuid references public.cities (id) on delete set null,
  embedding vector(768),
  is_blocked boolean not null default false,
  is_admin boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 3 and 40),
  constraint profiles_gender_chk check (
    gender is null or gender in ('male', 'female')
  ),
  constraint profiles_no_admin_while_blocked check (not (is_admin and is_blocked))
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create index if not exists profiles_city_idx
  on public.profiles (city_id)
  where city_id is not null and not is_blocked;

create index if not exists profiles_embedding_hnsw_idx
  on public.profiles
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create table public.tags (
  id integer generated always as identity primary key,
  slug text not null unique,
  label_uk text not null
);

create table public.profile_tags (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id integer not null references public.tags (id) on delete cascade,
  primary key (profile_id, tag_id)
);

create index if not exists profile_tags_tag_id_idx on public.profile_tags (tag_id);

-- listings, listing_images
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  city_id uuid not null references public.cities (id) on delete restrict,
  price integer not null check (price >= 0),
  title text not null,
  description text not null,
  available_from date not null,
  available_until date,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint listings_type_chk check (type in ('searching', 'offering')),
  constraint listings_dates_chk check (
    available_until is null or available_until >= available_from
  )
);

create index if not exists listings_city_active_idx
  on public.listings (city_id)
  where is_active = true;

create index if not exists listings_creator_idx on public.listings (creator_id);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  image_path text not null,
  order_index integer not null default 0 check (order_index >= 0)
);

create index if not exists listing_images_listing_order_idx
  on public.listing_images (listing_id, order_index);

-- chat_rooms, chat_participants, chat_messages
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  is_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.chat_participants (
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_hidden boolean not null default false,
  primary key (room_id, user_id)
);

create index if not exists chat_participants_user_idx on public.chat_participants (user_id);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(body) > 0 and char_length(body) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

-- reviews, reports, user_blocks, user_matches
create table public.reviews (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now(),
  constraint reviews_no_self check (author_id <> target_id),
  constraint reviews_one_per_pair unique (author_id, target_id)
);

create index if not exists reviews_target_idx on public.reviews (target_id);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  target_review_id bigint references public.reviews (id) on delete set null,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed'))
);

create index if not exists reports_status_idx on public.reports (status);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_no_self check (blocker_id <> blocked_id),
  primary key (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

create table public.user_matches (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  matched_user_id uuid not null references public.profiles (id) on delete cascade,
  score double precision,
  constraint user_matches_no_self check (user_id <> matched_user_id),
  constraint user_matches_unique_pair unique (user_id, matched_user_id)
);

create index if not exists user_matches_user_score_idx
  on public.user_matches (user_id, score desc nulls last);

-- functions, triggers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, first_name, last_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger regions_set_updated_at
  before update on public.regions
  for each row execute procedure public.set_updated_at();

create trigger cities_set_updated_at
  before update on public.cities
  for each row execute procedure public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute procedure public.set_updated_at();

create or replace function public.username_is_taken(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(trim(candidate))
  );
$$;

revoke all on function public.username_is_taken(text) from public;
grant execute on function public.username_is_taken(text) to service_role;

-- RLS reviews.insert
create or replace function public.review_allowed_by_chat(
  p_author uuid,
  p_target uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_participants a
    inner join public.chat_participants b
      on a.room_id = b.room_id
    inner join public.chat_rooms cr on cr.id = a.room_id
    where a.user_id = p_author
      and b.user_id = p_target
      and cr.is_accepted = true
  );
$$;

revoke all on function public.review_allowed_by_chat(uuid, uuid) from public;

create or replace function public.admin_console_list_users(
  p_search text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  username text,
  avatar_path text,
  is_blocked boolean,
  is_admin boolean,
  email text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw text;
  v_lim int;
  v_off int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.is_admin = true
  ) then
    raise exception 'forbidden';
  end if;

  v_raw := trim(coalesce(p_search, ''));
  v_lim := coalesce(nullif(p_limit, 0), 10);
  if v_lim < 1 or v_lim > 100 then
    v_lim := 10;
  end if;
  v_off := greatest(coalesce(p_offset, 0), 0);

  return query
  select
    p.id,
    p.username,
    p.avatar_path,
    p.is_blocked,
    p.is_admin,
    u.email::text,
    p.updated_at
  from public.profiles p
  inner join auth.users u on u.id = p.id
  where v_raw = ''
     or position(lower(v_raw) in lower(p.username)) > 0
     or position(lower(v_raw) in lower(u.email)) > 0
  order by p.updated_at desc
  limit v_lim
  offset v_off;
end;
$$;

revoke all on function public.admin_console_list_users(text, integer, integer) from public;
grant execute on function public.admin_console_list_users(text, integer, integer) to authenticated;

-- chat_rooms.is_accepted: true, якщо у room_id більше 2 distinct sender_id у chat_messages.
create or replace function public.check_chat_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_count int;
begin
  select count(distinct sender_id) into v_sender_count
  from public.chat_messages
  where room_id = new.room_id;

  if v_sender_count >= 2 then
    update public.chat_rooms
    set is_accepted = true
    where id = new.room_id and is_accepted = false;
  end if;

  return new;
end;
$$;

create trigger on_chat_message_insert
  after insert on public.chat_messages
  for each row execute procedure public.check_chat_accepted();

-- RLS
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.tags enable row level security;
alter table public.profile_tags enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_matches enable row level security;

-- RLS regions, cities
drop policy if exists "regions_select_authenticated" on public.regions;
create policy "regions_select_authenticated"
  on public.regions for select
  to authenticated
  using (true);

drop policy if exists "regions_write_admin" on public.regions;
create policy "regions_write_admin"
  on public.regions for all
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  )
  with check (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "cities_select_authenticated" on public.cities;
create policy "cities_select_authenticated"
  on public.cities for select
  to authenticated
  using (true);

drop policy if exists "cities_write_admin" on public.cities;
create policy "cities_write_admin"
  on public.cities for all
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  )
  with check (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

-- RLS profiles
drop policy if exists "profiles_select_discovery" on public.profiles;
create policy "profiles_select_discovery"
  on public.profiles for select
  to authenticated
  using (not is_blocked or id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (
  username,
  first_name,
  last_name,
  avatar_path,
  bio,
  gender,
  city_id,
  embedding
) on public.profiles to authenticated;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- RLS tags, profile_tags
drop policy if exists "tags_select_authenticated" on public.tags;
create policy "tags_select_authenticated"
  on public.tags for select
  to authenticated
  using (true);

drop policy if exists "profile_tags_select_public_profiles" on public.profile_tags;
create policy "profile_tags_select_public_profiles"
  on public.profile_tags for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p where p.id = profile_id and not p.is_blocked
    )
  );

drop policy if exists "profile_tags_mutate_own_not_blocked" on public.profile_tags;
create policy "profile_tags_mutate_own_not_blocked"
  on public.profile_tags for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.id = auth.uid() and not p.is_blocked
    )
  );

drop policy if exists "profile_tags_delete_own_not_blocked" on public.profile_tags;
create policy "profile_tags_delete_own_not_blocked"
  on public.profile_tags for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.id = auth.uid() and not p.is_blocked
    )
  );

-- RLS listings
drop policy if exists "listings_select_discovery" on public.listings;
create policy "listings_select_discovery"
  on public.listings for select
  to authenticated
  using (
    is_active = true
    or creator_id = auth.uid()
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "listings_insert_own_not_blocked" on public.listings;
create policy "listings_insert_own_not_blocked"
  on public.listings for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "listings_update_own_not_blocked" on public.listings;
create policy "listings_update_own_not_blocked"
  on public.listings for update
  to authenticated
  using (creator_id = auth.uid())
  with check (
    creator_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings for delete
  to authenticated
  using (creator_id = auth.uid());

-- RLS listing_images
drop policy if exists "listing_images_select_visible" on public.listing_images;
create policy "listing_images_select_visible"
  on public.listing_images for select
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (
          l.is_active = true
          or l.creator_id = auth.uid()
          or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
        )
    )
  );

drop policy if exists "listing_images_mutate_creator_not_blocked" on public.listing_images;
create policy "listing_images_mutate_creator_not_blocked"
  on public.listing_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.creator_id = auth.uid()
    )
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "listing_images_update_creator_not_blocked" on public.listing_images;
create policy "listing_images_update_creator_not_blocked"
  on public.listing_images for update
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.creator_id = auth.uid()
    )
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "listing_images_delete_creator" on public.listing_images;
create policy "listing_images_delete_creator"
  on public.listing_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.creator_id = auth.uid()
    )
  );

-- RLS chat_rooms, chat_participants, chat_messages
drop policy if exists "chat_rooms_select_participant_or_admin" on public.chat_rooms;
create policy "chat_rooms_select_participant_or_admin"
  on public.chat_rooms for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.room_id = id and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "chat_rooms_insert_authenticated" on public.chat_rooms;
create policy "chat_rooms_insert_authenticated"
  on public.chat_rooms for insert
  to authenticated
  with check (
    not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "chat_participants_select_participant_or_admin" on public.chat_participants;
create policy "chat_participants_select_participant_or_admin"
  on public.chat_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp2
      where cp2.room_id = room_id and cp2.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "chat_participants_insert_self_not_blocked" on public.chat_participants;
create policy "chat_participants_insert_self_not_blocked"
  on public.chat_participants for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "chat_participants_update_self" on public.chat_participants;
create policy "chat_participants_update_self"
  on public.chat_participants for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_participants cp2
      where cp2.room_id = room_id and cp2.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_participants cp2
      where cp2.room_id = room_id and cp2.user_id = auth.uid()
    )
  );

drop policy if exists "chat_messages_select_participant_or_admin" on public.chat_messages;
create policy "chat_messages_select_participant_or_admin"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.room_id = chat_messages.room_id and cp.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "chat_messages_insert_participant_not_blocked" on public.chat_messages;
create policy "chat_messages_insert_participant_not_blocked"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
    and exists (
      select 1 from public.chat_participants cp
      where cp.room_id = room_id and cp.user_id = auth.uid()
    )
  );

-- RLS reviews
drop policy if exists "reviews_select_related" on public.reviews;
create policy "reviews_select_related"
  on public.reviews for select
  to authenticated
  using (
    author_id = auth.uid()
    or target_id = auth.uid()
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "reviews_insert_when_chat_accepted" on public.reviews;
create policy "reviews_insert_when_chat_accepted"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
    and public.review_allowed_by_chat(author_id, target_id)
  );

-- RLS reports
drop policy if exists "reports_insert_own_not_blocked" on public.reports;
create policy "reports_insert_own_not_blocked"
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin"
  on public.reports for select
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update
  to authenticated
  using (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  )
  with check (
    exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.is_admin)
  );

-- RLS user_blocks
drop policy if exists "user_blocks_select_involved" on public.user_blocks;
create policy "user_blocks_select_involved"
  on public.user_blocks for select
  to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "user_blocks_insert_blocker" on public.user_blocks;
create policy "user_blocks_insert_blocker"
  on public.user_blocks for insert
  to authenticated
  with check (
    blocker_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "user_blocks_delete_blocker" on public.user_blocks;
create policy "user_blocks_delete_blocker"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- RLS user_matches
drop policy if exists "user_matches_select_own" on public.user_matches;
create policy "user_matches_select_own"
  on public.user_matches for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_matches_insert_own" on public.user_matches;
create policy "user_matches_insert_own"
  on public.user_matches for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

drop policy if exists "user_matches_update_own" on public.user_matches;
create policy "user_matches_update_own"
  on public.user_matches for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_matches_delete_own" on public.user_matches;
create policy "user_matches_delete_own"
  on public.user_matches for delete
  to authenticated
  using (user_id = auth.uid());

-- storage.buckets, storage.objects
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update
set public = true;

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "listing_images_public_read" on storage.objects;
drop policy if exists "listing_images_insert_creator" on storage.objects;
drop policy if exists "listing_images_update_creator" on storage.objects;
drop policy if exists "listing_images_delete_creator" on storage.objects;

create policy "profile_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-images');

create policy "profile_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

create policy "profile_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

create policy "profile_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "listing_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'listing-images');

create policy "listing_images_insert_creator"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

create policy "listing_images_update_creator"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked
    )
  );

create policy "listing_images_delete_creator"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- seed tags
insert into public.tags (slug, label_uk) values
  ('quiet', 'Спокій у домі'),
  ('no_smoking', 'Без куріння'),
  ('pets_ok', 'Можна з тваринами'),
  ('no_pets', 'Без тварин'),
  ('clean', 'Акуратність / прибирання'),
  ('early_bird', 'Ранній підйом'),
  ('night_owl', 'Пізні години'),
  ('guests_ok', 'Гості за домовленістю'),
  ('study_focus', 'Фокус на навчанні / роботі')
on conflict (slug) do nothing;

-- seed regions, cities (UA)
do $$
declare
  r_id uuid;
begin
  insert into public.regions (name) values ('Вінницька область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Вінниця'), (r_id, 'Жмеринка'), (r_id, 'Могилів-Подільський'), (r_id, 'Хмільник');

  insert into public.regions (name) values ('Волинська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Луцьк'), (r_id, 'Ковель'), (r_id, 'Володимир'), (r_id, 'Нововолинськ');

  insert into public.regions (name) values ('Дніпропетровська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Дніпро'), (r_id, 'Кривий Ріг'), (r_id, 'Кам''янське'), (r_id, 'Нікополь');

  insert into public.regions (name) values ('Донецька область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Краматорськ'), (r_id, 'Слов''янськ'), (r_id, 'Покровськ'), (r_id, 'Бахмут');

  insert into public.regions (name) values ('Житомирська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Житомир'), (r_id, 'Бердичів'), (r_id, 'Коростень'), (r_id, 'Звягель');

  insert into public.regions (name) values ('Закарпатська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Ужгород'), (r_id, 'Мукачево'), (r_id, 'Хуст'), (r_id, 'Берегове');

  insert into public.regions (name) values ('Запорізька область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Запоріжжя'), (r_id, 'Мелітополь'), (r_id, 'Бердянськ'), (r_id, 'Енергодар');

  insert into public.regions (name) values ('Івано-Франківська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Івано-Франківськ'), (r_id, 'Калуш'), (r_id, 'Коломия'), (r_id, 'Яремче');

  insert into public.regions (name) values ('Київська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Біла Церква'), (r_id, 'Бровари'), (r_id, 'Бориспіль'), (r_id, 'Ірпінь'), (r_id, 'Буча'), (r_id, 'Вишневе');

  insert into public.regions (name) values ('Кіровоградська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Кропивницький'), (r_id, 'Олександрія'), (r_id, 'Світловодськ'), (r_id, 'Знам''янка');

  insert into public.regions (name) values ('Луганська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Сєвєродонецьк'), (r_id, 'Лисичанськ'), (r_id, 'Старобільськ'), (r_id, 'Рубіжне');

  insert into public.regions (name) values ('Львівська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Львів'), (r_id, 'Дрогобич'), (r_id, 'Стрий'), (r_id, 'Червоноград'), (r_id, 'Трускавець');

  insert into public.regions (name) values ('Миколаївська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Миколаїв'), (r_id, 'Первомайськ'), (r_id, 'Вознесенськ'), (r_id, 'Южноукраїнськ');

  insert into public.regions (name) values ('Одеська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Одеса'), (r_id, 'Чорноморськ'), (r_id, 'Ізмаїл'), (r_id, 'Подільськ'), (r_id, 'Білгород-Дністровський');

  insert into public.regions (name) values ('Полтавська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Полтава'), (r_id, 'Кременчук'), (r_id, 'Миргород'), (r_id, 'Лубни');

  insert into public.regions (name) values ('Рівненська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Рівне'), (r_id, 'Дубно'), (r_id, 'Вараш'), (r_id, 'Сарни');

  insert into public.regions (name) values ('Сумська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Суми'), (r_id, 'Конотоп'), (r_id, 'Шостка'), (r_id, 'Охтирка');

  insert into public.regions (name) values ('Тернопільська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Тернопіль'), (r_id, 'Чортків'), (r_id, 'Кременець'), (r_id, 'Бережани');

  insert into public.regions (name) values ('Харківська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Харків'), (r_id, 'Лозова'), (r_id, 'Ізюм'), (r_id, 'Чугуїв');

  insert into public.regions (name) values ('Херсонська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Херсон'), (r_id, 'Нова Каховка'), (r_id, 'Каховка'), (r_id, 'Генічеськ');

  insert into public.regions (name) values ('Хмельницька область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Хмельницький'), (r_id, 'Кам''янець-Подільський'), (r_id, 'Шепетівка'), (r_id, 'Славута');

  insert into public.regions (name) values ('Черкаська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Черкаси'), (r_id, 'Умань'), (r_id, 'Сміла'), (r_id, 'Золотоноша');

  insert into public.regions (name) values ('Чернівецька область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Чернівці'), (r_id, 'Хотин'), (r_id, 'Новодністровськ'), (r_id, 'Сторожинець');

  insert into public.regions (name) values ('Чернігівська область') returning id into r_id;
  insert into public.cities (region_id, name) values 
    (r_id, 'Чернігів'), (r_id, 'Ніжин'), (r_id, 'Прилуки'), (r_id, 'Новгород-Сіверський');

  insert into public.regions (name) values ('м. Київ') returning id into r_id;
  insert into public.cities (region_id, name) values (r_id, 'Київ');

end $$;