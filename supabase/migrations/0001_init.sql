-- OpenChat schema: comment-to-DM automation with a follower gate.
-- The backend uses the Supabase service-role key, which bypasses RLS. RLS is
-- enabled (deny-by-default) so that future dashboard/client access is locked
-- down until explicit policies are added.

create extension if not exists pgcrypto;

-- Creators: connected Instagram professional accounts.
create table if not exists creators (
  id               uuid primary key default gen_random_uuid(),
  ig_user_id       text not null unique,
  ig_username      text not null,
  access_token     text,
  token_expires_at timestamptz,
  created_at       timestamptz not null default now()
);

-- Automations: comment-to-DM rules.
create table if not exists automations (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references creators(id) on delete cascade,
  media_id             text,                              -- null = applies to all posts
  keywords             text[] not null default '{}',
  match_type           text not null default 'contains'  check (match_type in ('exact','contains')),
  dm_template          text not null,
  link_payload         text not null,
  public_reply_enabled boolean not null default false,
  public_reply_text    text,
  follow_gate_enabled  boolean not null default true,
  nudge_template       text not null,
  nudge_max            integer not null default 2,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);
create index if not exists automations_creator_idx on automations (creator_id, active);

-- Contacts: people who interacted with a creator's posts.
create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  igsid      text not null,
  username   text,
  follows    boolean,                                     -- null until known (post-consent)
  first_seen timestamptz not null default now(),
  unique (creator_id, igsid)
);

-- Flow state: the per-(contact, automation) conversation state machine.
create table if not exists flow_state (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references creators(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  comment_id    text not null,
  state         text not null
    check (state in ('AWAITING_ENGAGEMENT','AWAITING_FOLLOW','DELIVERED','STOPPED')),
  nudge_count   integer not null default 0,
  expires_at    timestamptz not null,                     -- 7-day private-reply window
  updated_at    timestamptz not null default now()
);
create index if not exists flow_state_contact_idx on flow_state (creator_id, contact_id, state);

-- Inbound events: raw webhook dedupe (Meta retries deliveries).
create table if not exists inbound_events (
  event_id    text primary key,
  received_at timestamptz not null default now()
);

-- Outbound actions: audit log of every DM/comment sent (also feeds rate limiting).
create table if not exists outbound_actions (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  kind       text not null,
  payload    text not null,
  target_id  text not null,
  created_at timestamptz not null default now()
);
create index if not exists outbound_actions_creator_idx on outbound_actions (creator_id, created_at);

-- Deny-by-default RLS (service role bypasses these). Add dashboard policies later.
alter table creators        enable row level security;
alter table automations     enable row level security;
alter table contacts        enable row level security;
alter table flow_state      enable row level security;
alter table inbound_events  enable row level security;
alter table outbound_actions enable row level security;
