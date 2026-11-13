-- Backlog: editing everything logged for a subject at one moment at once.
--
-- Values logged together are separate entries with the same subject and time
-- (FR-51). Editing opens all of them: values change, empty fields add values,
-- cleared fields delete them, and a new time and comment apply to all. This
-- saves such an edit in one transaction.
--
-- Security invoker: the entries' row rules (can_write_entry) and triggers
-- decide what's allowed, exactly as for single writes. Row rules turn a
-- refused update or delete into "no rows", so those are raised as
-- not_allowed here rather than passing silently.

create function public.save_entry_moment(
  target_subject_id uuid,
  measured_at_before timestamptz,
  new_measured_at timestamptz,
  new_comment text,
  -- attribute id → new value, or null to delete. Attributes left out (an
  -- archived metric, say) keep their entry as it is.
  new_values jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item record;
  target_attribute_id uuid;
  existing uuid;
  changed uuid;
  comment_text text := nullif(btrim(new_comment), '');
begin
  if jsonb_typeof(new_values) is distinct from 'object' then
    raise exception using errcode = 'P0001', message = 'invalid_input';
  end if;

  for item in select key, value from jsonb_each(new_values) loop
    target_attribute_id := item.key::uuid;

    select e.id into existing
    from public.entries e
    where e.subject_id = target_subject_id
      and e.attribute_id = target_attribute_id
      and e.measured_at = measured_at_before;

    if jsonb_typeof(item.value) = 'null' then
      if existing is not null then
        delete from public.entries where id = existing returning id into changed;
        if changed is null then
          raise exception using errcode = 'P0001', message = 'not_allowed';
        end if;
      end if;
    elsif jsonb_typeof(item.value) = 'number' then
      if existing is not null then
        update public.entries
        set value = (item.value #>> '{}')::numeric,
            measured_at = new_measured_at,
            comment = comment_text
        where id = existing
        returning id into changed;
        if changed is null then
          raise exception using errcode = 'P0001', message = 'not_allowed';
        end if;
      else
        insert into public.entries (subject_id, attribute_id, value, measured_at, comment)
        values (target_subject_id, target_attribute_id,
                (item.value #>> '{}')::numeric, new_measured_at, comment_text);
      end if;
    else
      raise exception using errcode = 'P0001', message = 'invalid_input';
    end if;
    changed := null;
  end loop;
end;
$$;

revoke execute on function public.save_entry_moment(uuid, timestamptz, timestamptz, text, jsonb)
  from public, anon;
grant execute on function public.save_entry_moment(uuid, timestamptz, timestamptz, text, jsonb)
  to authenticated;
