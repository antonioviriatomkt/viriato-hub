-- ===== Viriato Hub — initial schema =====
create extension if not exists pgcrypto;

-- ---------- tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'pending' check (role in ('admin','member','pending')),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members(user_id);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  objective text,
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_team_idx on public.meetings(team_id, scheduled_at desc);

create table public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_notes_meeting_idx on public.meeting_notes(meeting_id, created_at);

create table public.meeting_log (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index meeting_log_meeting_idx on public.meeting_log(meeting_id, created_at);

-- ---------- helper functions (security definer, avoid RLS recursion) ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','member'));
$$;

create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.team_id = p_team and tm.user_id = auth.uid() and p.role in ('admin','member')
  );
$$;

create or replace function public.can_access_meeting(p_meeting uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting and (public.is_admin() or public.is_team_member(m.team_id))
  );
$$;

-- ---------- triggers ----------
-- profile on signup: first user = admin, others = pending
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email, '@', 1)),
    case when v_count = 0 then 'admin' else 'pending' end
  );
  return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- only admins change roles; admins cannot demote themselves
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or new.email <> old.email then
    raise exception 'id/email são imutáveis';
  end if;
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Só administradores podem alterar funções';
    end if;
    if old.id = auth.uid() and old.role = 'admin' then
      raise exception 'Não podes remover a tua própria função de administrador';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_update before update on public.profiles
for each row execute function public.guard_profile_update();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger meetings_touch before update on public.meetings
for each row execute function public.touch_updated_at();
create trigger meeting_notes_touch before update on public.meeting_notes
for each row execute function public.touch_updated_at();

-- automatic, append-only log
create or replace function public.log_meeting_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meeting_log (meeting_id, actor_id, event, details)
    values (new.id, auth.uid(), 'meeting_created',
            jsonb_build_object('title', new.title, 'scheduled_at', new.scheduled_at));
  elsif tg_op = 'UPDATE' then
    if new.objective is distinct from old.objective then
      insert into public.meeting_log (meeting_id, actor_id, event, details)
      values (new.id, auth.uid(), 'objective_updated',
              jsonb_build_object('from', old.objective, 'to', new.objective));
    end if;
    if new.status is distinct from old.status then
      insert into public.meeting_log (meeting_id, actor_id, event, details)
      values (new.id, auth.uid(), 'status_changed',
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.title is distinct from old.title or new.scheduled_at is distinct from old.scheduled_at then
      insert into public.meeting_log (meeting_id, actor_id, event, details)
      values (new.id, auth.uid(), 'meeting_updated',
              jsonb_build_object('title', new.title, 'scheduled_at', new.scheduled_at));
    end if;
  end if;
  return null;
end;
$$;
create trigger meetings_log after insert or update on public.meetings
for each row execute function public.log_meeting_changes();

create or replace function public.log_note_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.meeting_log (meeting_id, actor_id, event, details)
    values (new.meeting_id, auth.uid(), 'note_added',
            jsonb_build_object('note_id', new.id, 'preview', left(new.body, 140)));
  elsif tg_op = 'UPDATE' then
    if new.body is distinct from old.body then
      insert into public.meeting_log (meeting_id, actor_id, event, details)
      values (new.meeting_id, auth.uid(), 'note_updated',
              jsonb_build_object('note_id', new.id, 'preview', left(new.body, 140)));
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.meeting_log (meeting_id, actor_id, event, details)
    values (old.meeting_id, auth.uid(), 'note_deleted',
            jsonb_build_object('note_id', old.id, 'preview', left(old.body, 140)));
  end if;
  return null;
end;
$$;
create trigger meeting_notes_log after insert or update or delete on public.meeting_notes
for each row execute function public.log_note_changes();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.meeting_log enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active());
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- teams
create policy "teams_select" on public.teams for select to authenticated
  using (public.is_admin() or public.is_team_member(id));
create policy "teams_insert" on public.teams for insert to authenticated
  with check (public.is_admin());
create policy "teams_update" on public.teams for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "teams_delete" on public.teams for delete to authenticated
  using (public.is_admin());

-- team_members
create policy "team_members_select" on public.team_members for select to authenticated
  using (public.is_admin() or public.is_team_member(team_id));
create policy "team_members_insert" on public.team_members for insert to authenticated
  with check (public.is_admin());
create policy "team_members_update" on public.team_members for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "team_members_delete" on public.team_members for delete to authenticated
  using (public.is_admin());

-- meetings
create policy "meetings_select" on public.meetings for select to authenticated
  using (public.is_admin() or public.is_team_member(team_id));
create policy "meetings_insert" on public.meetings for insert to authenticated
  with check (created_by = auth.uid() and (public.is_admin() or public.is_team_member(team_id)));
create policy "meetings_update" on public.meetings for update to authenticated
  using (public.is_admin() or public.is_team_member(team_id))
  with check (public.is_admin() or public.is_team_member(team_id));
create policy "meetings_delete" on public.meetings for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- meeting_notes
create policy "meeting_notes_select" on public.meeting_notes for select to authenticated
  using (public.can_access_meeting(meeting_id));
create policy "meeting_notes_insert" on public.meeting_notes for insert to authenticated
  with check (author_id = auth.uid() and public.can_access_meeting(meeting_id));
create policy "meeting_notes_update" on public.meeting_notes for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "meeting_notes_delete" on public.meeting_notes for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- meeting_log (append-only; automatic entries come from triggers, manual entries allowed)
create policy "meeting_log_select" on public.meeting_log for select to authenticated
  using (public.can_access_meeting(meeting_id));
create policy "meeting_log_insert" on public.meeting_log for insert to authenticated
  with check (actor_id = auth.uid() and event = 'manual' and public.can_access_meeting(meeting_id));

-- ---------- realtime ----------
alter publication supabase_realtime add table public.meetings, public.meeting_notes, public.meeting_log;

-- ---------- seed ----------
insert into public.teams (name, slug, description)
values ('Equipa de Vendas', 'vendas', 'Espaço da equipa comercial')
on conflict (slug) do nothing;
