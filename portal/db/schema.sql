-- azentio.ai portal schema.
-- Access model: the app connects as the owner, then every user request runs inside a
-- transaction that does `SET LOCAL ROLE portal_app` and sets app.user_id / app.org_id.
-- portal_app is not the table owner, so every row-level security policy below applies.
-- State changes go through SECURITY DEFINER functions that check permissions and write audit events.

drop schema if exists public cascade;
create schema public;
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'portal_app') then
    create role portal_app nologin;
  end if;
end $$;
grant portal_app to current_user;
grant usage on schema public to portal_app;

-- ---------------------------------------------------------------- identity
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table organisations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('azentio','client')),
  industry text,
  region text
);

create table memberships (
  user_id uuid not null references users(id),
  org_id uuid not null references organisations(id),
  role text not null check (role in ('employee','client_member','client_admin')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- Platform grants are separate rows. Employee status never implies any of them.
create table grants (
  user_id uuid not null references users(id),
  grant_name text not null check (grant_name in ('moderator','publisher','portal_admin','product_owner')),
  granted_by uuid references users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, grant_name)
);

-- Client invitations can only carry client roles (no path to platform roles).
create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  email text not null check (email = lower(email)),
  role text not null check (role in ('client_member','client_admin')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- Auth tables: only the system path (owner) touches these. portal_app has no grants on them.
create table login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id),
  active_org_id uuid references organisations(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catalogue and content
create table offerings (
  id text primary key,
  name text not null,
  category text not null,
  eyebrow text not null,
  summary text not null,
  capabilities text[] not null default '{}',
  steps text[] not null default '{}',
  audience text not null check (audience in ('public','employee'))  -- no default: missing metadata fails
);

create table entitlements (
  org_id uuid not null references organisations(id),
  offering_id text not null references offerings(id),
  primary key (org_id, offering_id)
);

create table media (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null,
  mime text not null,
  audience text not null check (audience in ('public','employee','clients','org','entitled')),
  org_id uuid references organisations(id),
  offering_id text references offerings(id),
  created_at timestamptz not null default now()
);

create table content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('insight','banner','broadcast','experiment','knowledge','briefing','release_note')),
  title text not null,
  body text not null,
  audience text not null check (audience in ('public','employee','clients','org','entitled')),
  org_id uuid references organisations(id),
  offering_id text references offerings(id),
  media_id uuid references media(id),
  owner_name text,
  review_date date,
  starts_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  check (audience <> 'org' or org_id is not null),
  check (audience <> 'entitled' or offering_id is not null)
);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('demo','hackathon')),
  name text not null check (length(name) between 2 and 120),
  email text not null check (length(email) between 5 and 200),
  company text check (length(company) <= 160),
  message text check (length(message) <= 2000),
  created_at timestamptz not null default now()
);

create table playground_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  org_id uuid references organisations(id),
  offering_id text not null references offerings(id),
  scenario text not null,
  output jsonb not null,
  feedback text,
  rating text check (rating in ('useful','needs_evidence','wrong')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- collective learning
create table contributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  author_id uuid not null references users(id),
  parent_id uuid references contributions(id),
  version int not null default 1,
  visibility text not null default 'private' check (visibility in ('private','org','proposed_shared')),
  state text not null default 'draft' check (state in ('draft','submitted','returned','published','rejected','withdrawn','superseded')),
  type text not null check (type in ('market_observation','emerging_trend','product_gap','operational_challenge','successful_practice','improvement_suggestion')),
  title text not null check (length(title) between 5 and 140),
  body text not null check (length(body) between 20 and 4000),
  offering_id text references offerings(id),
  industry text not null,
  region text not null,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  evidence_type text not null check (evidence_type in ('anecdotal','internal_data','customer_feedback','regulatory','third_party')),
  confidence text not null check (confidence in ('low','medium','high')),
  sensitive_flags text[] not null default '{}',
  return_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only consent ledger. Current value = latest row per (contribution, kind).
create table consents (
  id bigserial primary key,
  contribution_id uuid not null references contributions(id),
  kind text not null check (kind in ('store','publish','attribution','training')),
  granted boolean not null,
  user_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  limitations text not null,
  created_by uuid references users(id),
  updated_at timestamptz not null default now()
);

-- The reviewed shared representation. It never carries tenant, author, source text or notes.
create table shared_items (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references contributions(id),  -- hidden from portal_app by column grants
  title text not null,
  body text not null,
  type text not null,
  offering_id text references offerings(id),
  industry text not null,
  region_band text not null,
  period_label text not null,
  evidence_type text not null,
  confidence text not null,
  attribution_label text,
  theme_id uuid references themes(id),
  status text not null default 'published' check (status in ('published','unpublished','withdrawn','superseded')),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('english', title || ' ' || body || ' ' || industry || ' ' || region_band)) stored
);
create index on shared_items using gin(search);

create table reviews (
  id bigserial primary key,
  contribution_id uuid not null references contributions(id),
  reviewer_id uuid not null references users(id),
  decision text not null check (decision in ('returned','rejected','published','unpublished','republished','removed')),
  reason text,                -- shown to the author
  created_at timestamptz not null default now()
);
create table review_notes (  -- internal, moderators only
  id bigserial primary key,
  contribution_id uuid not null references contributions(id),
  reviewer_id uuid not null references users(id),
  note text not null,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  shared_item_id uuid not null references shared_items(id),
  reporter_id uuid not null references users(id),
  reason text not null check (reason in ('misleading','confidential','inappropriate','duplicate')),
  details text check (length(details) <= 1000),
  status text not null default 'open' check (status in ('open','upheld','dismissed')),
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 5 and 140),
  problem text not null,
  offering_id text references offerings(id),
  proposed_outcome text not null,
  owner_team text not null,
  priority text not null check (priority in ('low','medium','high')),      -- internal only
  status text not null default 'Proposed' check (status in ('Proposed','Under review','Planned','In progress','Released','Not proceeding')),
  public_note text not null default '',
  theme_id uuid references themes(id),
  created_by uuid references users(id),
  updated_at timestamptz not null default now()
);
create table idea_evidence (
  idea_id uuid not null references ideas(id),
  shared_item_id uuid not null references shared_items(id),
  primary key (idea_id, shared_item_id)
);
create table idea_status_history (
  id bigserial primary key,
  idea_id uuid not null references ideas(id),
  from_status text,
  to_status text not null,
  note text,
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);

create table notifications (
  id bigserial primary key,
  user_id uuid not null references users(id),
  message text not null,
  link text,
  channel text not null default 'in_app',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_events (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table settings (key text primary key, value text not null);
insert into settings values ('min_cohort_orgs', '3');

create table fl_runs (  -- federated learning programme results (written by the coordinator script)
  id uuid primary key default gen_random_uuid(),
  summary jsonb not null,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','rolled_back')),
  decided_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- request context helpers
create function app_uid() returns uuid language sql stable as
$$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create function is_member(o uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from memberships where user_id = app_uid() and org_id = o and status = 'active') $$;

create function member_role(o uuid) returns text language sql stable security definer set search_path = public as
$$ select role from memberships where user_id = app_uid() and org_id = o and status = 'active' $$;

-- Active workspace comes from the server-side session, and is re-validated against membership here.
create function app_org() returns uuid language sql stable security definer set search_path = public as
$$ select o from (select nullif(current_setting('app.org_id', true), '')::uuid o) x where is_member(o) $$;

create function is_employee() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from memberships m join organisations g on g.id = m.org_id
                 where m.user_id = app_uid() and m.status = 'active' and g.kind = 'azentio' and m.role = 'employee') $$;

create function is_client() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from memberships m join organisations g on g.id = m.org_id
                 where m.user_id = app_uid() and m.status = 'active' and g.kind = 'client') $$;

create function has_grant(g text) returns boolean language sql stable security definer set search_path = public as
$$ select is_employee() and exists(select 1 from grants where user_id = app_uid() and grant_name = g) $$;

create function min_cohort() returns int language sql stable security definer set search_path = public as
$$ select value::int from settings where key = 'min_cohort_orgs' $$;

-- Audience rule shared by content and media. Public is explicit; nothing falls back to it.
create function audience_ok(aud text, org uuid, offering text) returns boolean language sql stable security definer set search_path = public as
$$ select case aud
     when 'public' then true
     when 'employee' then is_employee()
     when 'clients' then is_client() or is_employee()
     when 'org' then is_member(org) or is_employee() and has_grant('portal_admin')
     when 'entitled' then is_employee() or exists(select 1 from entitlements e where e.org_id = app_org() and e.offering_id = offering)
     else false end $$;

create function audit(act text, ent text, eid text, det jsonb default '{}') returns void language sql security definer set search_path = public as
$$ insert into audit_events(actor_id, action, entity, entity_id, detail) values (app_uid(), act, ent, eid, det) $$;

create function notify(u uuid, msg text, lnk text) returns void language sql security definer set search_path = public as
$$ insert into notifications(user_id, message, link) values (u, msg, lnk) $$;

create function consent_value(cid uuid, k text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select granted from consents where contribution_id = cid and kind = k order by id desc limit 1), false)
     -- answers only for the author or a moderator; anyone else learns nothing about the item
     and exists(select 1 from contributions x where x.id = cid and (x.author_id = app_uid() or has_grant('moderator'))) $$;

-- ---------------------------------------------------------------- row-level security
alter table users enable row level security;
alter table organisations enable row level security;
alter table memberships enable row level security;
alter table grants enable row level security;
alter table invitations enable row level security;
alter table offerings enable row level security;
alter table entitlements enable row level security;
alter table media enable row level security;
alter table content_items enable row level security;
alter table enquiries enable row level security;
alter table playground_runs enable row level security;
alter table contributions enable row level security;
alter table consents enable row level security;
alter table themes enable row level security;
alter table shared_items enable row level security;
alter table reviews enable row level security;
alter table review_notes enable row level security;
alter table reports enable row level security;
alter table ideas enable row level security;
alter table idea_evidence enable row level security;
alter table idea_status_history enable row level security;
alter table notifications enable row level security;
alter table audit_events enable row level security;
alter table settings enable row level security;
alter table fl_runs enable row level security;
-- Policies target portal_app. The owner (used only by the auth/system path, seed and the
-- SECURITY DEFINER functions) is not subject to them; user requests never run as the owner.

-- users: yourself, people who share an org with you, or everyone for portal admins
create policy users_read on users for select to portal_app using (
  id = app_uid() or has_grant('portal_admin')
  or exists(select 1 from memberships a join memberships b on a.org_id = b.org_id
            where a.user_id = app_uid() and a.status = 'active' and b.user_id = users.id and member_role(a.org_id) in ('client_admin','employee')));
grant select on users to portal_app;

create policy orgs_read on organisations for select to portal_app using (is_member(id) or has_grant('portal_admin'));
grant select on organisations to portal_app;

create policy memberships_read on memberships for select to portal_app using (
  user_id = app_uid() or member_role(org_id) = 'client_admin' or has_grant('portal_admin'));
grant select on memberships to portal_app;

create policy grants_read on grants for select to portal_app using (user_id = app_uid() or has_grant('portal_admin'));
grant select on grants to portal_app;

create policy invitations_read on invitations for select to portal_app using (
  member_role(org_id) = 'client_admin' or has_grant('portal_admin'));
grant select on invitations to portal_app;

create policy offerings_read on offerings for select to portal_app using (audience = 'public' or (audience = 'employee' and is_employee()));
grant select on offerings to portal_app;

create policy entitlements_read on entitlements for select to portal_app using (is_member(org_id) or is_employee());
grant select on entitlements to portal_app;

create policy media_read on media for select to portal_app using (audience_ok(audience, org_id, offering_id));
create policy media_write on media for insert to portal_app with check (has_grant('publisher'));
grant select, insert on media to portal_app;

create policy content_read on content_items for select to portal_app using (audience_ok(audience, org_id, offering_id));
create policy content_insert on content_items for insert to portal_app with check (has_grant('publisher') and created_by = app_uid());
create policy content_update on content_items for update to portal_app using (has_grant('publisher')) with check (has_grant('publisher'));
create policy content_delete on content_items for delete to portal_app using (has_grant('publisher'));
grant select, insert, update, delete on content_items to portal_app;

create policy enquiries_insert on enquiries for insert to portal_app with check (true);
create policy enquiries_read on enquiries for select to portal_app using (has_grant('portal_admin') or has_grant('publisher'));
grant select, insert on enquiries to portal_app;

create policy runs_own on playground_runs for select to portal_app using (user_id = app_uid());
create policy runs_insert on playground_runs for insert to portal_app with check (
  user_id = app_uid() and (
    (org_id is null and is_employee())
    or (org_id = app_org() and exists(select 1 from entitlements e where e.org_id = app_org() and e.offering_id = playground_runs.offering_id))));
create policy runs_feedback on playground_runs for update to portal_app using (user_id = app_uid()) with check (user_id = app_uid());
grant select, insert on playground_runs to portal_app;
grant update (feedback, rating) on playground_runs to portal_app;

-- contributions: private items are author-only. 'org' is an explicit author choice, visible to the org at once.
-- A proposal to share stays author-only until submitted, then org members and moderators can see it.
-- Moderators see only items proposed for sharing that have left draft. Nobody else sees sources.
create policy contrib_read on contributions for select to portal_app using (
  author_id = app_uid()
  or (is_member(org_id) and (visibility = 'org' or (visibility = 'proposed_shared' and state <> 'draft')))
  or (has_grant('moderator') and visibility = 'proposed_shared' and state <> 'draft'));
create policy contrib_insert on contributions for insert to portal_app with check (
  author_id = app_uid() and org_id = app_org() and state = 'draft' and version = 1 and parent_id is null);
create policy contrib_update on contributions for update to portal_app
  using (author_id = app_uid() and state in ('draft','returned'))
  with check (author_id = app_uid() and state in ('draft','returned'));
grant select, insert on contributions to portal_app;
-- authors may edit content fields only; state, org, author and version change only through functions
grant update (title, body, type, offering_id, industry, region, period_start, period_end, evidence_type, confidence, visibility, sensitive_flags, updated_at) on contributions to portal_app;

create policy consents_read on consents for select to portal_app using (
  exists(select 1 from contributions c where c.id = contribution_id and (c.author_id = app_uid() or has_grant('moderator'))));
grant select on consents to portal_app;

-- shared copy: any verified participant (client member or employee) sees published items;
-- moderators also see unpublished ones. Column grants hide the source link.
create policy shared_read on shared_items for select to portal_app using (
  (status = 'published' and (is_client() or is_employee())) or has_grant('moderator'));
grant select (id, title, body, type, offering_id, industry, region_band, period_label, evidence_type, confidence,
              attribution_label, theme_id, status, published_at, updated_at, search) on shared_items to portal_app;

create policy themes_read on themes for select to portal_app using (is_client() or is_employee());
create policy themes_write on themes for insert to portal_app with check (has_grant('moderator') or has_grant('product_owner'));
grant select, insert on themes to portal_app;

create policy reviews_read on reviews for select to portal_app using (
  has_grant('moderator') or exists(select 1 from contributions c where c.id = contribution_id and c.author_id = app_uid()));
grant select on reviews to portal_app;
create policy review_notes_read on review_notes for select to portal_app using (has_grant('moderator'));
grant select on review_notes to portal_app;

create policy reports_read on reports for select to portal_app using (reporter_id = app_uid() or has_grant('moderator'));
grant select on reports to portal_app;

-- ideas: full rows (priority, internal fields) only for employees; clients use ideas_public
create policy ideas_read on ideas for select to portal_app using (is_employee());
grant select on ideas to portal_app;
create policy idea_ev_read on idea_evidence for select to portal_app using (is_employee());
grant select on idea_evidence to portal_app;
create policy idea_hist_read on idea_status_history for select to portal_app using (is_employee());
grant select on idea_status_history to portal_app;

create policy notif_own on notifications for select to portal_app using (user_id = app_uid());
create policy notif_mark on notifications for update to portal_app using (user_id = app_uid()) with check (user_id = app_uid());
grant select on notifications to portal_app;
grant update (read_at) on notifications to portal_app;

create policy audit_read on audit_events for select to portal_app using (has_grant('portal_admin'));
grant select on audit_events to portal_app;   -- no insert/update/delete grant: append only via audit()

create policy settings_read on settings for select to portal_app using (true);
grant select on settings to portal_app;

create policy fl_read on fl_runs for select to portal_app using (is_employee());
grant select on fl_runs to portal_app;

-- Client-safe projection of ideas: plain status, owner team, public note. No priority, no evidence ids.
create function ideas_public() returns table (id uuid, title text, offering_id text, owner_team text, status text, public_note text, theme_id uuid, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, title, offering_id, owner_team, status, public_note, theme_id, updated_at
  from ideas where (is_client() or is_employee()) and status <> 'Proposed' order by updated_at desc $$;

-- ---------------------------------------------------------------- aggregation with suppression
-- Counts distinct organisations, never posts. Below the threshold the count is withheld.
create function theme_stats() returns table (theme_id uuid, items int, orgs int, suppressed boolean)
language sql stable security definer set search_path = public as $$
  select s.theme_id, count(*)::int,
         case when count(distinct c.org_id) >= min_cohort() then count(distinct c.org_id)::int end,
         count(distinct c.org_id) < min_cohort()
  from shared_items s join contributions c on c.id = s.contribution_id
  where s.status = 'published' and s.theme_id is not null and (is_client() or is_employee())
  group by s.theme_id $$;

-- Facet counts for one dimension at a time (stacked filters would allow differencing).
create function facet_counts(dim text) returns table (value text, items int, orgs int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_client() or is_employee()) then return; end if;
  if dim not in ('offering_id','industry','region_band','type') then raise exception 'unsupported facet'; end if;
  return query execute format(
    'select s.%1$I::text, count(*)::int, case when count(distinct c.org_id) >= min_cohort() then count(distinct c.org_id)::int end
       from shared_items s join contributions c on c.id = s.contribution_id
      where s.status = ''published'' group by 1 having count(distinct c.org_id) >= min_cohort() order by 2 desc', dim);
end $$;

-- ---------------------------------------------------------------- lifecycle functions
create function contribution_submit(cid uuid) returns void language plpgsql security definer set search_path = public as $$
declare c contributions;
begin
  select * into c from contributions where id = cid for update;
  if c.id is null or c.author_id is distinct from app_uid() then raise exception 'not allowed'; end if;
  if c.state not in ('draft','returned') then raise exception 'illegal transition % -> submitted', c.state; end if;
  if c.visibility <> 'proposed_shared' then raise exception 'only contributions proposed for community sharing go to review'; end if;
  if not consent_value(cid, 'store') or not consent_value(cid, 'publish') then
    raise exception 'publishing consent is required before proposing to share'; end if;
  update contributions set state = 'submitted', updated_at = now() where id = cid;
  perform audit('contribution.submitted', 'contribution', cid::text, jsonb_build_object('from', c.state));
  perform notify(g.user_id, 'New contribution waiting for review: ' || c.title, '/portal/moderation/' || cid)
    from grants g where g.grant_name = 'moderator';
end $$;

create function contribution_return(cid uuid, why text) returns void language plpgsql security definer set search_path = public as $$
declare c contributions;
begin
  if not has_grant('moderator') then raise exception 'not allowed'; end if;
  select * into c from contributions where id = cid for update;
  if c.author_id is not distinct from app_uid() then raise exception 'you cannot review your own contribution'; end if;
  if c.state <> 'submitted' or c.visibility <> 'proposed_shared' then raise exception 'illegal transition % -> returned', c.state; end if;
  if coalesce(length(trim(why)), 0) < 5 then raise exception 'a reason is required'; end if;
  update contributions set state = 'returned', return_reason = why, updated_at = now() where id = cid;
  insert into reviews(contribution_id, reviewer_id, decision, reason) values (cid, app_uid(), 'returned', why);
  perform audit('contribution.returned', 'contribution', cid::text, '{}');
  perform notify(c.author_id, 'Clarification requested on "' || c.title || '": ' || why, '/portal/contributions/' || cid);
end $$;

create function contribution_reject(cid uuid, why text, note text) returns void language plpgsql security definer set search_path = public as $$
declare c contributions;
begin
  if not has_grant('moderator') then raise exception 'not allowed'; end if;
  select * into c from contributions where id = cid for update;
  if c.author_id is not distinct from app_uid() then raise exception 'you cannot review your own contribution'; end if;
  if c.state <> 'submitted' or c.visibility <> 'proposed_shared' then raise exception 'illegal transition % -> rejected', c.state; end if;
  update contributions set state = 'rejected', updated_at = now() where id = cid;
  insert into reviews(contribution_id, reviewer_id, decision, reason) values (cid, app_uid(), 'rejected', why);
  if coalesce(note, '') <> '' then insert into review_notes(contribution_id, reviewer_id, note) values (cid, app_uid(), note); end if;
  perform audit('contribution.rejected', 'contribution', cid::text, '{}');
  perform notify(c.author_id, 'Not published: "' || c.title || '". Reason: ' || why, '/portal/contributions/' || cid);
end $$;

-- Publishing copies only the reviewed fields the moderator approved into a new shared row.
create function contribution_publish(cid uuid, p jsonb, note text) returns uuid language plpgsql security definer set search_path = public as $$
declare c contributions; sid uuid; attr text;
begin
  if not has_grant('moderator') then raise exception 'not allowed'; end if;
  select * into c from contributions where id = cid for update;
  if c.author_id is not distinct from app_uid() then raise exception 'you cannot review your own contribution'; end if;
  if c.state <> 'submitted' or c.visibility <> 'proposed_shared' then raise exception 'illegal transition % -> published', c.state; end if;
  if not consent_value(cid, 'publish') then raise exception 'author has not consented to publication'; end if;
  attr := nullif(p->>'attribution_label', '');
  if attr is not null and not consent_value(cid, 'attribution') then raise exception 'attribution requires author consent'; end if;
  insert into shared_items(contribution_id, title, body, type, offering_id, industry, region_band, period_label, evidence_type, confidence, attribution_label, theme_id)
  values (cid, p->>'title', p->>'body', c.type, c.offering_id, p->>'industry', p->>'region_band', p->>'period_label', c.evidence_type, c.confidence, attr,
          nullif(p->>'theme_id', '')::uuid)
  returning id into sid;
  -- a newer version replaces the older shared copy only now, after its own review
  if c.parent_id is not null then
    update shared_items set status = 'superseded', updated_at = now() where contribution_id = c.parent_id and status in ('published','unpublished');
    -- only a live parent becomes superseded; a withdrawn parent keeps its withdrawn state in the history
    update contributions set state = 'superseded', updated_at = now() where id = c.parent_id and state = 'published';
  end if;
  update contributions set state = 'published', updated_at = now() where id = cid;
  insert into reviews(contribution_id, reviewer_id, decision, reason) values (cid, app_uid(), 'published', 'Published after review and de-identification');
  if coalesce(note, '') <> '' then insert into review_notes(contribution_id, reviewer_id, note) values (cid, app_uid(), note); end if;
  perform audit('contribution.published', 'contribution', cid::text, jsonb_build_object('shared_item', sid));
  perform notify(c.author_id, 'Your contribution "' || c.title || '" was published as a de-identified shared version.', '/portal/contributions/' || cid);
  return sid;
end $$;

-- Withdrawal flips the shared copy out of every read path (feed, search, AIRA) in the same transaction.
create function contribution_withdraw(cid uuid) returns void language plpgsql security definer set search_path = public as $$
declare c contributions;
begin
  select * into c from contributions where id = cid for update;
  -- NULL-safe: a caller with no role in this org must be refused, not slip through a NULL condition
  if c.id is null or not (c.author_id is not distinct from app_uid() or coalesce(member_role(c.org_id), '') = 'client_admin') then raise exception 'not allowed'; end if;
  if c.state not in ('submitted','returned','published') then raise exception 'illegal transition % -> withdrawn', c.state; end if;
  update contributions set state = 'withdrawn', updated_at = now() where id = cid;
  update shared_items set status = 'withdrawn', updated_at = now() where contribution_id = cid and status in ('published','unpublished');
  insert into consents(contribution_id, kind, granted, user_id) values (cid, 'publish', false, app_uid());
  perform audit('contribution.withdrawn', 'contribution', cid::text, jsonb_build_object('from', c.state));
end $$;

create function contribution_new_version(cid uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare c contributions; nid uuid;
begin
  select * into c from contributions where id = cid;
  if c.id is null or c.author_id is distinct from app_uid() or c.state <> 'published' then raise exception 'only the author can revise a published contribution'; end if;
  if exists(select 1 from contributions where parent_id = cid and state in ('draft','submitted','returned')) then raise exception 'a revision is already in progress'; end if;
  insert into contributions(org_id, author_id, parent_id, version, visibility, type, title, body, offering_id, industry, region, period_start, period_end, evidence_type, confidence)
  values (c.org_id, c.author_id, cid, c.version + 1, 'proposed_shared', c.type, c.title, c.body, c.offering_id, c.industry, c.region, c.period_start, c.period_end, c.evidence_type, c.confidence)
  returning id into nid;
  insert into consents(contribution_id, kind, granted, user_id)
    select nid, k, consent_value(cid, k), app_uid() from unnest(array['store','publish','attribution','training']) k;
  perform audit('contribution.revision_started', 'contribution', nid::text, jsonb_build_object('parent', cid));
  return nid;
end $$;

create function consent_set(cid uuid, k text, g boolean) returns void language plpgsql security definer set search_path = public as $$
declare c contributions;
begin
  select * into c from contributions where id = cid;
  if c.id is null or c.author_id is distinct from app_uid() then raise exception 'not allowed'; end if;
  if k not in ('store','publish','attribution','training') then raise exception 'unknown consent'; end if;
  if consent_value(cid, k) = g and exists(select 1 from consents where contribution_id = cid and kind = k) then return; end if;
  insert into consents(contribution_id, kind, granted, user_id) values (cid, k, g, app_uid());
  perform audit('consent.' || case when g then 'granted' else 'revoked' end, 'contribution', cid::text, jsonb_build_object('kind', k));
  -- revoking publication consent on a live item is a withdrawal
  if k = 'publish' and not g and c.state in ('submitted','returned','published') then perform contribution_withdraw(cid); end if;
  if k = 'attribution' and not g then
    update shared_items set attribution_label = null, updated_at = now() where contribution_id = cid;
  end if;
end $$;

create function shared_source(sid uuid) returns uuid language sql stable security definer set search_path = public as
$$ select s.contribution_id from shared_items s join contributions c on c.id = s.contribution_id
   where s.id = sid and (has_grant('moderator') or c.author_id = app_uid()) $$;

create function shared_for_contribution(cid uuid) returns setof uuid language sql stable security definer set search_path = public as
$$ select s.id from shared_items s join contributions c on c.id = s.contribution_id
   where c.id = cid and (has_grant('moderator') or c.author_id = app_uid() or member_role(c.org_id) = 'client_admin') $$;

create function report_item(sid uuid, why text, det text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from shared_items where id = sid and status = 'published') or not (is_client() or is_employee()) then raise exception 'not allowed'; end if;
  insert into reports(shared_item_id, reporter_id, reason, details) values (sid, app_uid(), why, det);
  perform audit('report.created', 'shared_item', sid::text, jsonb_build_object('reason', why));
  perform notify(g.user_id, 'A shared contribution was reported (' || why || ')', '/portal/moderation') from grants g where g.grant_name = 'moderator';
end $$;

-- Moderator decisions on a shared copy: temporarily unpublish, republish, or remove.
create function shared_set_status(sid uuid, st text, why text) returns void language plpgsql security definer set search_path = public as $$
declare s shared_items; author uuid;
begin
  if not has_grant('moderator') then raise exception 'not allowed'; end if;
  if st not in ('published','unpublished','withdrawn') then raise exception 'bad status'; end if;
  select * into s from shared_items where id = sid for update;
  if s.status = 'superseded' or s.status = 'withdrawn' then raise exception 'item is %', s.status; end if;
  update shared_items set status = st, updated_at = now() where id = sid;
  insert into reviews(contribution_id, reviewer_id, decision, reason)
    values (s.contribution_id, app_uid(), case st when 'published' then 'republished' when 'unpublished' then 'unpublished' else 'removed' end, why);
  update reports set status = case when st = 'published' then 'dismissed' else 'upheld' end, decision_note = why, decided_at = now()
   where shared_item_id = sid and status = 'open' and st <> 'unpublished';
  select author_id into author from contributions where id = s.contribution_id;
  perform audit('shared_item.' || st, 'shared_item', sid::text, jsonb_build_object('reason', why));
  perform notify(author, 'Moderation update on your shared contribution: ' || st || '. ' || coalesce(why, ''), '/portal/contributions/' || s.contribution_id);
end $$;

create function theme_assign(sid uuid, tid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (has_grant('moderator') or has_grant('product_owner')) then raise exception 'not allowed'; end if;
  update shared_items set theme_id = tid, updated_at = now() where id = sid and status = 'published';
  update themes set updated_at = now() where id = tid;
  perform audit('theme.assigned', 'shared_item', sid::text, jsonb_build_object('theme', tid));
end $$;

-- ---------------------------------------------------------------- improvement ideas
create function idea_create(t text, prob text, off text, outcome text, team text, prio text, th uuid, evidence uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare iid uuid;
begin
  if not has_grant('product_owner') then raise exception 'not allowed'; end if;
  insert into ideas(title, problem, offering_id, proposed_outcome, owner_team, priority, theme_id, created_by)
  values (t, prob, off, outcome, team, prio, th, app_uid()) returning id into iid;
  -- only currently published shared items can be linked as evidence
  insert into idea_evidence select iid, s.id from shared_items s where s.id = any(evidence) and s.status = 'published';
  insert into idea_status_history(idea_id, from_status, to_status, note, actor_id) values (iid, null, 'Proposed', 'Created', app_uid());
  perform audit('idea.created', 'idea', iid::text, jsonb_build_object('evidence', evidence));
  return iid;
end $$;

create function idea_set_status(iid uuid, st text, pub text) returns void language plpgsql security definer set search_path = public as $$
declare i ideas;
begin
  if not has_grant('product_owner') then raise exception 'not allowed'; end if;
  select * into i from ideas where id = iid for update;
  update ideas set status = st, public_note = coalesce(pub, public_note), updated_at = now() where id = iid;
  insert into idea_status_history(idea_id, from_status, to_status, note, actor_id) values (iid, i.status, st, pub, app_uid());
  perform audit('idea.status', 'idea', iid::text, jsonb_build_object('from', i.status, 'to', st));
  -- close the loop with authors of the linked evidence, without naming anyone else
  perform notify(c.author_id, 'An improvement idea linked to your shared observation is now "' || st || '": ' || i.title, '/portal/ideas')
    from idea_evidence e join shared_items s on s.id = e.shared_item_id join contributions c on c.id = s.contribution_id
   where e.idea_id = iid and st <> 'Proposed';
end $$;

-- ---------------------------------------------------------------- client administration
create function invite_create(em text, r text, th text, exp timestamptz) returns uuid language plpgsql security definer set search_path = public as $$
declare iid uuid; o uuid := app_org();
begin
  if o is null or coalesce(member_role(o), '') <> 'client_admin' then raise exception 'only a client administrator of the active organisation can invite'; end if;
  if r not in ('client_member','client_admin') then raise exception 'role not allowed'; end if;
  if lower(em) like '%@azentio.com' then raise exception 'employees are provisioned by Azentio, not invited into client workspaces'; end if;
  insert into invitations(org_id, email, role, token_hash, expires_at, invited_by) values (o, lower(em), r, th, exp, app_uid()) returning id into iid;
  perform audit('invitation.created', 'invitation', iid::text, jsonb_build_object('org', o, 'role', r));
  return iid;
end $$;

create function invite_revoke(iid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from invitations where id = iid and member_role(org_id) = 'client_admin' and accepted_at is null) then raise exception 'not allowed'; end if;
  update invitations set revoked_at = now() where id = iid;
  perform audit('invitation.revoked', 'invitation', iid::text, '{}');
end $$;

create function invite_lookup(th text) returns table (org_name text, role text, email text, state text) language sql stable security definer set search_path = public as $$
  select o.name, i.role, i.email,
         case when i.accepted_at is not null then 'used' when i.revoked_at is not null then 'revoked' when i.expires_at < now() then 'expired' else 'valid' end
  from invitations i join organisations o on o.id = i.org_id where i.token_hash = th $$;

-- Accept only for the verified account the invitation names, once, before expiry.
create function invite_accept(th text) returns uuid language plpgsql security definer set search_path = public as $$
declare i invitations; em text;
begin
  select email into em from users where id = app_uid();
  select * into i from invitations where token_hash = th for update;
  if i.id is null or i.accepted_at is not null or i.revoked_at is not null or i.expires_at < now() then raise exception 'invitation is not valid'; end if;
  if em is null or i.email is distinct from em then raise exception 'this invitation was issued to a different email address'; end if;
  insert into memberships(user_id, org_id, role) values (app_uid(), i.org_id, i.role)
    on conflict (user_id, org_id) do update set role = excluded.role, status = 'active';
  update invitations set accepted_at = now() where id = i.id;
  perform audit('invitation.accepted', 'invitation', i.id::text, jsonb_build_object('org', i.org_id));
  return i.org_id;
end $$;

create function member_set(u uuid, r text, st text) returns void language plpgsql security definer set search_path = public as $$
declare o uuid := app_org();
begin
  if o is null or coalesce(member_role(o), '') <> 'client_admin' then raise exception 'not allowed'; end if;
  if r not in ('client_member','client_admin') or st not in ('active','revoked') then raise exception 'role not allowed'; end if;
  if u = app_uid() then raise exception 'you cannot change your own membership'; end if;
  update memberships set role = r, status = st where user_id = u and org_id = o and role in ('client_member','client_admin');
  if not found then raise exception 'member not found in your organisation'; end if;
  perform audit('membership.changed', 'membership', u::text, jsonb_build_object('org', o, 'role', r, 'status', st));
end $$;

-- ---------------------------------------------------------------- portal administration
create function grant_set(u uuid, g text, onoff boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_grant('portal_admin') then raise exception 'not allowed'; end if;
  if onoff then
    if not exists(select 1 from memberships m join organisations o on o.id = m.org_id where m.user_id = u and o.kind = 'azentio' and m.status = 'active') then
      raise exception 'platform grants are for verified employees only'; end if;
    insert into grants(user_id, grant_name, granted_by) values (u, g, app_uid()) on conflict do nothing;
  else
    if u = app_uid() and g = 'portal_admin' then raise exception 'you cannot remove your own admin grant'; end if;
    delete from grants where user_id = u and grant_name = g;
  end if;
  perform audit('grant.' || case when onoff then 'added' else 'removed' end, 'user', u::text, jsonb_build_object('grant', g));
end $$;

create function employee_provision(em text, nm text) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid; az uuid;
begin
  if not has_grant('portal_admin') then raise exception 'not allowed'; end if;
  if lower(em) not like '%@azentio.com' then raise exception 'employees must use an @azentio.com address'; end if;
  insert into users(email, display_name) values (lower(em), nm) on conflict (email) do update set display_name = users.display_name returning id into uid;
  select id into az from organisations where kind = 'azentio';
  insert into memberships(user_id, org_id, role) values (uid, az, 'employee') on conflict (user_id, org_id) do update set status = 'active', role = 'employee';
  perform audit('employee.provisioned', 'user', uid::text, '{}');
  return uid;
end $$;

create function setting_set(k text, v text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_grant('portal_admin') then raise exception 'not allowed'; end if;
  if k = 'min_cohort_orgs' and v::int < 3 then raise exception 'minimum cohort cannot go below 3 organisations'; end if;
  update settings set value = v where key = k;
  perform audit('setting.changed', 'setting', k, jsonb_build_object('value', v));
end $$;

create function fl_decide(rid uuid, st text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_grant('portal_admin') then raise exception 'deployment decisions need a portal administrator'; end if;
  if st not in ('approved','rejected','rolled_back') then raise exception 'bad status'; end if;
  update fl_runs set status = st, decided_by = app_uid() where id = rid;
  perform audit('fl.' || st, 'fl_run', rid::text, '{}');
end $$;

revoke all on all functions in schema public from public;
grant execute on all functions in schema public to portal_app;
-- notify() is an internal helper for the lifecycle functions; the app role must not message users directly.
revoke execute on function notify(uuid, text, text) from portal_app;
