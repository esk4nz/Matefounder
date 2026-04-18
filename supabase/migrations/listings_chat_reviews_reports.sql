-- =============================================================================
-- Matefounder — міграція 2 з 2: ОГОЛОШЕННЯ, ЧАТ, ВІДГУКИ, СКАРГИ, МЕТЧІ
-- =============================================================================
-- Спочатку застосуй: 20260418120001_foundation_users_profiles_tags.sql
--
-- PostgreSQL / Supabase — той самий діалект SQL, RLS і тригери, що й у міграції 1.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Оголошення про житло (ролі owner / both у profiles)
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  city text not null,
  title text not null,
  description text not null,
  rent_monthly integer not null check (rent_monthly >= 0),
  available_from date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_city_active_idx
  on public.listings (city)
  where is_active = true;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Чат
-- ---------------------------------------------------------------------------
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.chat_participants (
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.chat_messages (
  id bigserial primary key,
  room_id uuid not null references public.chat_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(body) > 0 and char_length(body) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Відгуки та скарги
-- ---------------------------------------------------------------------------
create table public.reviews (
  id bigserial primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now(),
  constraint reviews_no_self check (author_id <> target_user_id),
  constraint reviews_one_per_pair unique (author_id, target_user_id)
);

create table public.reports (
  id bigserial primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint reports_no_self check (reporter_id <> target_user_id)
);

create index if not exists reports_status_idx on public.reports (status);

-- ---------------------------------------------------------------------------
-- Збережені / пораховані метчі (гібридне ранжування з бекенду)
-- ---------------------------------------------------------------------------
create table public.user_matches (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  matched_user_id uuid not null references public.profiles (id) on delete cascade,
  score double precision,
  semantic_score double precision,
  filter_score double precision,
  created_at timestamptz not null default now(),
  constraint user_matches_no_self check (user_id <> matched_user_id),
  constraint user_matches_unique_pair unique (user_id, matched_user_id)
);

create index if not exists user_matches_user_score_idx
  on public.user_matches (user_id, score desc nulls last);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.user_matches enable row level security;

drop policy if exists "listings_select_active" on public.listings;
create policy "listings_select_active"
  on public.listings for select
  to authenticated
  using (is_active = true or owner_id = auth.uid());

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own"
  on public.listings for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "chat_rooms_select_participant" on public.chat_rooms;
create policy "chat_rooms_select_participant"
  on public.chat_rooms for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.room_id = id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "chat_rooms_insert_authenticated" on public.chat_rooms;
create policy "chat_rooms_insert_authenticated"
  on public.chat_rooms for insert
  to authenticated
  with check (true);

drop policy if exists "chat_participants_select_self" on public.chat_participants;
create policy "chat_participants_select_self"
  on public.chat_participants for select
  to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.chat_participants cp2
    where cp2.room_id = room_id and cp2.user_id = auth.uid()
  ));

drop policy if exists "chat_participants_insert_self" on public.chat_participants;
create policy "chat_participants_insert_self"
  on public.chat_participants for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chat_messages_select_participant" on public.chat_messages;
create policy "chat_messages_select_participant"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_participants cp
      where cp.room_id = chat_messages.room_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "chat_messages_insert_participant" on public.chat_messages;
create policy "chat_messages_insert_participant"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_participants cp
      where cp.room_id = room_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "reviews_select_related" on public.reviews;
create policy "reviews_select_related"
  on public.reviews for select
  to authenticated
  using (author_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists "reviews_insert_author" on public.reviews;
create policy "reviews_insert_author"
  on public.reviews for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "user_matches_select_own" on public.user_matches;
create policy "user_matches_select_own"
  on public.user_matches for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_matches_insert_own" on public.user_matches;
create policy "user_matches_insert_own"
  on public.user_matches for insert
  to authenticated
  with check (user_id = auth.uid());

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
