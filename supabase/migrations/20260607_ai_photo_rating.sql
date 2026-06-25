-- AI rating settings on games
alter table public.games
  add column if not exists ai_photo_rating boolean not null default false,
  add column if not exists ai_photo_instructions text;

-- Flag whether a photo was rated by AI or manually
alter table public.photo_submissions
  add column if not exists ai_rated boolean not null default false;

alter table public.scavenger_submissions
  add column if not exists ai_rated boolean not null default false;
