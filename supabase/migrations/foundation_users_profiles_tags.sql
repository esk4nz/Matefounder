create extension if not exists "pgcrypto";
create extension if not exists vector;

create table public.tags (
  id smallserial primary key,
  slug text not null unique,
  label_uk text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  first_name text not null,
  last_name text not null,
  role text not null default 'seeker'
    check (role in ('seeker', 'owner', 'both')),
  region text,
  city text,
  budget_min integer check (budget_min is null or budget_min >= 0),
  budget_max integer check (budget_max is null or budget_max >= 0),
  gender text,
  bio text,
  avatar_path text,
  embedding vector(768),
  is_blocked boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 3 and 20),
  constraint profiles_budget_order check (
    budget_min is null
    or budget_max is null
    or budget_min <= budget_max
  ),
  constraint profiles_no_admin_while_blocked check (not (is_admin and is_blocked))
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

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

create index if not exists profiles_city_idx
  on public.profiles (city)
  where city is not null and not is_blocked;

create index if not exists profiles_embedding_hnsw_idx
  on public.profiles
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create table public.profile_tags (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id smallint not null references public.tags (id) on delete cascade,
  primary key (profile_id, tag_id)
);

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
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.tags enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_tags enable row level security;

revoke update on public.profiles from authenticated;
grant update (
  username,
  first_name,
  last_name,
  role,
  region,
  city,
  budget_min,
  budget_max,
  gender,
  bio,
  avatar_path,
  embedding
) on public.profiles to authenticated;

drop policy if exists "tags_select_authenticated" on public.tags;
create policy "tags_select_authenticated"
  on public.tags for select
  to authenticated
  using (is_active = true);

drop policy if exists "profiles_select_discovery" on public.profiles;
create policy "profiles_select_discovery"
  on public.profiles for select
  to authenticated
  using (not is_blocked or id = auth.uid());

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

drop policy if exists "profile_tags_insert_own" on public.profile_tags;
create policy "profile_tags_insert_own"
  on public.profile_tags for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.id = auth.uid())
  );

drop policy if exists "profile_tags_delete_own" on public.profile_tags;
create policy "profile_tags_delete_own"
  on public.profile_tags for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "profile_images_public_read" on storage.objects;
create policy "profile_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-images');

drop policy if exists "profile_images_insert_own" on storage.objects;
create policy "profile_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_images_update_own" on storage.objects;
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
  );

drop policy if exists "profile_images_delete_own" on storage.objects;
create policy "profile_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

drop function if exists public.admin_console_list_users(text, integer);
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
  order by p.created_at desc
  limit v_lim
  offset v_off;
end;
$$;

revoke all on function public.admin_console_list_users(text, integer, integer) from public;
grant execute on function public.admin_console_list_users(text, integer, integer) to authenticated;
