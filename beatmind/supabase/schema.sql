-- =====================================================================
-- BeatMind — schéma Supabase
-- À exécuter une fois dans Supabase > SQL Editor (idempotent).
-- Tables : users, projects, project_versions, community_beats, likes,
--          comments, credits, voice_profiles (+ journal credit_events)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USERS : profil public lié à auth.users
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  username     text unique,
  display_name text,
  avatar_url   text,
  bio          text default '',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CREDITS : solde de générations
-- ---------------------------------------------------------------------
create table if not exists public.credits (
  user_id    uuid primary key references public.users(id) on delete cascade,
  balance    integer not null default 100 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_events (
  id         bigserial primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  delta      integer not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROJECTS + PROJECT_VERSIONS : bibliothèque et historique
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null default 'Sans titre',
  bpm         integer,
  key         text,
  styles      text[] not null default '{}',
  data        jsonb not null default '{}'::jsonb,   -- état complet (beat, pistes, voix, paroles, timeline)
  cover_color text,
  audio_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id, updated_at desc);

create table if not exists public.project_versions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  version    integer not null,
  label      text,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create index if not exists project_versions_project_idx on public.project_versions(project_id, version desc);

-- ---------------------------------------------------------------------
-- VOICE_PROFILES : voix clonées (ElevenLabs)
-- ---------------------------------------------------------------------
create table if not exists public.voice_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  eleven_voice_id text,
  sample_url      text,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- COMMUNITY_BEATS : prods publiques, licence CC0 automatique
-- ---------------------------------------------------------------------
create table if not exists public.community_beats (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  title       text not null,
  description text default '',
  audio_url   text not null,
  bpm         integer,
  key         text,
  styles      text[] not null default '{}',
  moods       text[] not null default '{}',
  instruments text[] not null default '{}',
  params      jsonb,
  license     text not null default 'CC0-1.0' check (license = 'CC0-1.0'),
  plays       integer not null default 0,
  downloads   integer not null default 0,
  likes_count integer not null default 0,
  saves_count integer not null default 0,
  comments_count integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists community_beats_created_idx on public.community_beats(created_at desc);
create index if not exists community_beats_styles_idx on public.community_beats using gin(styles);
create index if not exists community_beats_instruments_idx on public.community_beats using gin(instruments);
create index if not exists community_beats_moods_idx on public.community_beats using gin(moods);

-- ---------------------------------------------------------------------
-- LIKES : "like" et "save" (sauvegarde) sur un beat
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  user_id    uuid not null references public.users(id) on delete cascade,
  beat_id    uuid not null references public.community_beats(id) on delete cascade,
  kind       text not null default 'like' check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (user_id, beat_id, kind)
);

-- ---------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  beat_id    uuid not null references public.community_beats(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_beat_idx on public.comments(beat_id, created_at);

-- =====================================================================
-- Fonctions & triggers
-- =====================================================================

-- Création automatique du profil + 100 crédits à l'inscription (email ou Google)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name, avatar_url, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')) || '_' || substr(new.id::text, 1, 4)
  ) on conflict (id) do nothing;
  insert into public.credits (user_id, balance) values (new.id, 100) on conflict (user_id) do nothing;
  insert into public.credit_events (user_id, delta, reason) values (new.id, 100, 'signup');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Débit atomique : renvoie le nouveau solde, ou -1 si insuffisant
create or replace function public.spend_credits(p_user uuid, p_amount integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare new_balance integer;
begin
  update public.credits set balance = balance - p_amount, updated_at = now()
   where user_id = p_user and balance >= p_amount
   returning balance into new_balance;
  if new_balance is null then return -1; end if;
  insert into public.credit_events (user_id, delta, reason) values (p_user, -p_amount, p_reason);
  return new_balance;
end $$;

create or replace function public.add_credits(p_user uuid, p_amount integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare new_balance integer;
begin
  insert into public.credits (user_id, balance) values (p_user, p_amount)
  on conflict (user_id) do update set balance = public.credits.balance + p_amount, updated_at = now()
  returning balance into new_balance;
  insert into public.credit_events (user_id, delta, reason) values (p_user, p_amount, p_reason);
  return new_balance;
end $$;

-- Ces fonctions ne sont appelables que par le serveur (service_role)
revoke execute on function public.spend_credits(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.add_credits(uuid, integer, text) from public, anon, authenticated;

-- Compteurs dénormalisés (likes / saves / commentaires)
create or replace function public.bump_like_counters()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'like' then update public.community_beats set likes_count = likes_count + 1 where id = new.beat_id;
    else update public.community_beats set saves_count = saves_count + 1 where id = new.beat_id; end if;
  else
    if old.kind = 'like' then update public.community_beats set likes_count = greatest(likes_count - 1, 0) where id = old.beat_id;
    else update public.community_beats set saves_count = greatest(saves_count - 1, 0) where id = old.beat_id; end if;
  end if;
  return null;
end $$;
drop trigger if exists likes_counters on public.likes;
create trigger likes_counters after insert or delete on public.likes
  for each row execute function public.bump_like_counters();

create or replace function public.bump_comment_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.community_beats set comments_count = comments_count + 1 where id = new.beat_id;
  else update public.community_beats set comments_count = greatest(comments_count - 1, 0) where id = old.beat_id; end if;
  return null;
end $$;
drop trigger if exists comments_counter on public.comments;
create trigger comments_counter after insert or delete on public.comments
  for each row execute function public.bump_comment_counter();

-- Téléchargements / écoutes : appelables par tout le monde (même anonyme)
create or replace function public.increment_beat_stat(p_beat uuid, p_stat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_stat = 'downloads' then update public.community_beats set downloads = downloads + 1 where id = p_beat;
  elsif p_stat = 'plays' then update public.community_beats set plays = plays + 1 where id = p_beat; end if;
end $$;
grant execute on function public.increment_beat_stat(uuid, text) to anon, authenticated;

-- Licence CC0 imposée quoi qu'envoie le client
create or replace function public.force_cc_license()
returns trigger language plpgsql as $$
begin
  new.license := 'CC0-1.0';
  if tg_op = 'INSERT' then
    new.plays := 0; new.downloads := 0; new.likes_count := 0; new.saves_count := 0; new.comments_count := 0;
  end if;
  return new;
end $$;
drop trigger if exists community_beats_license on public.community_beats;
create trigger community_beats_license before insert or update on public.community_beats
  for each row execute function public.force_cc_license();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- Statistiques publiques d'un producteur
create or replace view public.producer_stats with (security_invoker = true) as
select u.id as user_id, u.username, u.display_name, u.avatar_url, u.bio, u.created_at,
       count(b.id)::int as beats_count,
       coalesce(sum(b.downloads), 0)::int as total_downloads,
       coalesce(sum(b.likes_count), 0)::int as total_likes,
       coalesce(sum(b.plays), 0)::int as total_plays
  from public.users u
  left join public.community_beats b on b.user_id = u.id
 group by u.id;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.users            enable row level security;
alter table public.credits          enable row level security;
alter table public.credit_events    enable row level security;
alter table public.projects         enable row level security;
alter table public.project_versions enable row level security;
alter table public.voice_profiles   enable row level security;
alter table public.community_beats  enable row level security;
alter table public.likes            enable row level security;
alter table public.comments         enable row level security;

-- users : lecture publique (profils producteurs), modification par soi-même
drop policy if exists users_read on public.users;
create policy users_read on public.users for select using (true);
drop policy if exists users_update on public.users;
create policy users_update on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

-- credits : lecture de son propre solde uniquement (écriture via fonctions serveur)
drop policy if exists credits_read on public.credits;
create policy credits_read on public.credits for select using (auth.uid() = user_id);
drop policy if exists credit_events_read on public.credit_events;
create policy credit_events_read on public.credit_events for select using (auth.uid() = user_id);

-- projects / versions / voix : privés
drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists versions_owner on public.project_versions;
create policy versions_owner on public.project_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists voices_owner on public.voice_profiles;
create policy voices_owner on public.voice_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- community : lecture publique, écriture par l'auteur
drop policy if exists beats_read on public.community_beats;
create policy beats_read on public.community_beats for select using (true);
drop policy if exists beats_insert on public.community_beats;
create policy beats_insert on public.community_beats for insert with check (auth.uid() = user_id);
drop policy if exists beats_update on public.community_beats;
create policy beats_update on public.community_beats for update using (auth.uid() = user_id);
-- Les compteurs (plays, downloads, likes…) ne sont modifiables que par les fonctions ci-dessus
revoke update on public.community_beats from anon, authenticated;
grant update (title, description, bpm, key, styles, moods, instruments) on public.community_beats to authenticated;
drop policy if exists beats_delete on public.community_beats;
create policy beats_delete on public.community_beats for delete using (auth.uid() = user_id);

drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select using (true);
drop policy if exists likes_write on public.likes;
create policy likes_write on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete using (auth.uid() = user_id);

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (true);
drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete using (auth.uid() = user_id);

-- =====================================================================
-- Storage
--   "audio"          public : beats publiés, voix générées
--   "voice-samples"  privé  : enregistrements de 15 s servant au clonage
-- Chemins : {user_id}/{dossier}/{fichier}
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true), ('voice-samples', 'voice-samples', false)
on conflict (id) do nothing;

drop policy if exists samples_owner_read on storage.objects;
create policy samples_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'voice-samples' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists audio_read on storage.objects;
create policy audio_read on storage.objects for select using (bucket_id = 'audio');
drop policy if exists audio_insert on storage.objects;
create policy audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists audio_delete on storage.objects;
create policy audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
