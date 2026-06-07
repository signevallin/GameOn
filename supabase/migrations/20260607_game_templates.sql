-- supabase/migrations/20260607_game_templates.sql

-- Game templates table
create table if not exists public.game_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  icon         text not null default '🎮',
  description  text,
  mission_ids  text[] not null default '{}',
  is_builtin   boolean not null default false,
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Index for fast per-user lookups
create index if not exists game_templates_user_id_idx
  on public.game_templates (user_id);

-- RLS
alter table public.game_templates enable row level security;

-- All authenticated users can read all templates
create policy "read all templates"
  on public.game_templates for select
  using (auth.uid() is not null);

-- Admins can insert their own non-builtin templates
create policy "insert own templates"
  on public.game_templates for insert
  with check (auth.uid() = user_id and is_builtin = false);

-- Admins can update their own non-builtin templates
create policy "update own templates"
  on public.game_templates for update
  using (auth.uid() = user_id and is_builtin = false);

-- Admins can delete their own non-builtin templates
create policy "delete own templates"
  on public.game_templates for delete
  using (auth.uid() = user_id and is_builtin = false);

-- Seed: built-in templates (service role bypasses RLS for these)
insert into public.game_templates (name, icon, description, mission_ids, is_builtin, user_id) values
(
  'After Work',
  '🍻',
  'Relaxed social mix with quiz, photo, and music rounds',
  array['trivia_fun','wouldyou','photo_bubble','photo_movie_scene','music_quiz','finish_lyrics','music_emoji','mix_drinks','celebrity_quiz','movie_emoji','logo_quiz','pictionary','duel_trivia','closest_wins'],
  true,
  null
),
(
  'IT Onboarding',
  '💻',
  'Tech-focused with coding challenges, trivia, and logic puzzles',
  array['code_quiz','binary','bug_hunt','terminal','app_icons','spot_error','typerace','wordguess','anagram','true_false','timeline','trivia_fun'],
  true,
  null
),
(
  'Team Kickoff',
  '🎉',
  'High-energy team-builder with photo challenges, duels, and scavenger hunt',
  array['human_statue','photo_mirror_selfie','photo_ad_shot','photo_colour_match','photo_weird_sign','reaction','memory','wouldyou','scavenger_hunt','duel_trivia','geo_guess','emoji_rebus','flag_quiz'],
  true,
  null
);
