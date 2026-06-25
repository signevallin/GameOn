create table if not exists event_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  guest_id text,
  score integer,
  created_at timestamptz not null default now()
);

create index if not exists event_leads_email_idx on event_leads (email);
