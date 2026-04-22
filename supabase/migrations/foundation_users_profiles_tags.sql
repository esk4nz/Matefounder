-- =============================================================================
-- Matefounder — міграція 1 з 2: ФУНДАМЕНТ
-- =============================================================================
-- Усе, що стосується користувачів, профілів, тегів і тригерів. Без цього шару
-- решта схеми (оголошення, чат, …) не матиме на що спиратися.
--
-- Сумісність: Supabase використовує PostgreSQL. Тут — звичайний SQL (DDL),
-- Row Level Security, функції/trigger-и PL/pgSQL, розширення pgvector (`vector`)
-- у тій формі, яку підтримує Supabase.
--
-- Мова продукту: інтерфейс сайту — українською. Поле tags.slug — лише технічний
-- стабільний ключ для коду (фільтри, API, міграції); користувачу показуємо
-- tags.label_uk. Це не «англомовна версія сайту», а зручність для розробки.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Довідник тегів (модерація: увімкнення/вимкнення через is_active)
-- ---------------------------------------------------------------------------
create table public.tags (
  id smallserial primary key,
  slug text not null unique,
  label_uk text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Профіль (1:1 з auth.users). Рядок створює тригер після реєстрації.
-- ---------------------------------------------------------------------------
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
  )
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Реєстрація (server): перевірка зайнятості логіну через RPC `username_is_taken` (case-insensitive).
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

-- Семантичний пошук: розмір вектора має відповідати обраній embedding-моделі.
create index if not exists profiles_embedding_hnsw_idx
  on public.profiles
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create table public.profile_tags (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id smallint not null references public.tags (id) on delete cascade,
  primary key (profile_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Тригер: після signup створюємо profiles з user_metadata (Supabase Auth)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Оновлення updated_at для профілів (таблиця listings — у міграції 2)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS: теги, профілі, зв’язок профіль–тег
-- ---------------------------------------------------------------------------
alter table public.tags enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_tags enable row level security;

-- is_admin / is_blocked з клієнта не змінюються (лише повні права в SQL / service role)
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

-- ---------------------------------------------------------------------------
-- Початкові теги (підпис українською для UI; slug — для коду)
-- ---------------------------------------------------------------------------
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
