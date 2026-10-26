alter table public.group_lists rename to expense_lists;

alter table public.expense_lists
  rename constraint group_lists_completion_timestamp_matches_status
  to expense_lists_completion_timestamp_matches_status;

alter table public.expense_lists
  rename constraint group_lists_paid_requires_completion
  to expense_lists_paid_requires_completion;

alter index public.group_lists_group_status_created_at_idx
  rename to expense_lists_group_status_created_at_idx;

alter policy "Group members can read their group lists"
  on public.expense_lists
  rename to "Group members can read their expense lists";

alter function public.create_group_list(uuid, text)
  rename to create_expense_list;

alter function public.complete_group_list(uuid)
  rename to complete_expense_list;

alter function public.mark_group_list_paid(uuid)
  rename to mark_expense_list_paid;

create or replace function public.create_expense_list(
  p_group_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_expense_list_id uuid;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Only group admins can create expense lists.';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Expense list name must contain between 1 and 80 characters.';
  end if;

  insert into public.expense_lists (group_id, name, created_by)
  values (p_group_id, btrim(p_name), auth.uid())
  returning id into new_expense_list_id;

  return new_expense_list_id;
end;
$$;

create or replace function public.complete_expense_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
  can_close_list boolean;
begin
  select el.group_id
  into target_group_id
  from public.expense_lists el
  where el.id = p_list_id;

  if target_group_id is null then
    raise exception 'The expense list does not exist.';
  end if;

  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and (gm.role = 'admin' or gm.can_close_lists)
  ) into can_close_list;

  if not can_close_list then
    raise exception 'You are not allowed to complete this expense list.';
  end if;

  update public.expense_lists
  set
    status = 'completed',
    completed_at = pg_catalog.now(),
    completed_by = auth.uid()
  where id = p_list_id
    and status = 'open';

  if not found then
    raise exception 'The expense list is already completed.';
  end if;
end;
$$;

create or replace function public.mark_expense_list_paid(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
  target_status text;
  target_is_paid boolean;
  can_close_list boolean;
begin
  select el.group_id, el.status, el.is_paid
  into target_group_id, target_status, target_is_paid
  from public.expense_lists el
  where el.id = p_list_id;

  if target_group_id is null then
    raise exception 'The expense list does not exist.';
  end if;

  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and (gm.role = 'admin' or gm.can_close_lists)
  ) into can_close_list;

  if not can_close_list then
    raise exception 'You are not allowed to mark this expense list as paid.';
  end if;

  if target_status <> 'completed' then
    raise exception 'Only completed expense lists can be marked as paid.';
  end if;

  if target_is_paid then
    raise exception 'The expense list is already marked as paid.';
  end if;

  update public.expense_lists
  set
    is_paid = true,
    paid_at = pg_catalog.now(),
    paid_by = auth.uid()
  where id = p_list_id
    and is_paid = false;

  if not found then
    raise exception 'The expense list is already marked as paid.';
  end if;
end;
$$;

revoke all on function public.create_expense_list(uuid, text)
  from public, anon;
revoke all on function public.complete_expense_list(uuid)
  from public, anon;
revoke all on function public.mark_expense_list_paid(uuid)
  from public, anon;

grant execute on function public.create_expense_list(uuid, text)
  to authenticated;
grant execute on function public.complete_expense_list(uuid)
  to authenticated;
grant execute on function public.mark_expense_list_paid(uuid)
  to authenticated;
