-- Move RLS helper functions out of the exposed API schema; lock down trigger functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role, postgres;

alter function public.is_admin() set schema private;
alter function public.is_active() set schema private;
alter function public.is_team_member(uuid) set schema private;
alter function public.can_access_meeting(uuid) set schema private;

create or replace function private.can_access_meeting(p_meeting uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meetings m
    where m.id = p_meeting and (private.is_admin() or private.is_team_member(m.team_id))
  );
$$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or new.email <> old.email then
    raise exception 'id/email são imutáveis';
  end if;
  if new.role is distinct from old.role then
    if not private.is_admin() then
      raise exception 'Só administradores podem alterar funções';
    end if;
    if old.id = auth.uid() and old.role = 'admin' then
      raise exception 'Não podes remover a tua própria função de administrador';
    end if;
  end if;
  return new;
end;
$$;

alter function public.touch_updated_at() set search_path = public;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

revoke execute on function
  public.handle_new_user(),
  public.guard_profile_update(),
  public.log_meeting_changes(),
  public.log_note_changes(),
  public.touch_updated_at()
from public, anon, authenticated;
