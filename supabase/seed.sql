-- Seed one creator + one automation for the single-creator vertical slice.
-- Replace ig_user_id / access_token with real values once OAuth is wired.

insert into creators (id, ig_user_id, ig_username, access_token, token_expires_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '17841400000000000',           -- placeholder IG professional account id
  'demo_creator',
  null,                          -- filled by OAuth
  null
)
on conflict (ig_user_id) do nothing;

insert into automations (
  creator_id, media_id, keywords, match_type,
  dm_template, link_payload,
  public_reply_enabled, public_reply_text,
  follow_gate_enabled, nudge_template, nudge_max, active
)
values (
  '00000000-0000-0000-0000-000000000001',
  null,                                          -- applies to all posts
  array['link','guide'],
  'contains',
  'Hey! 👋 Tap below and I''ll send over the guide.',
  'Here you go 🎁 https://example.com/the-guide',
  true,
  'Just sent you a DM! 💌 Make sure you''re following so it goes through 👀',
  true,
  'Almost there! Follow me first, then reply "done" and I''ll unlock the link 🔓',
  2,
  true
)
on conflict do nothing;
