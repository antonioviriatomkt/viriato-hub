-- When a meeting is deleted, its notes cascade-delete; don't try to log into a meeting that no longer exists.
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
    if exists (select 1 from public.meetings where id = old.meeting_id) then
      insert into public.meeting_log (meeting_id, actor_id, event, details)
      values (old.meeting_id, auth.uid(), 'note_deleted',
              jsonb_build_object('note_id', old.id, 'preview', left(old.body, 140)));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.log_note_changes() from public, anon, authenticated;
