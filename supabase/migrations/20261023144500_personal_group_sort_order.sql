alter table public.group_members
  add column sort_nr integer not null default 0;

with ranked_memberships as (
  select
    gm.id,
    (row_number() over (
      partition by gm.user_id
      order by g.created_at desc, g.id
    ) - 1)::integer as sort_nr
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.user_id is not null
)
update public.group_members gm
set sort_nr = ranked_memberships.sort_nr
from ranked_memberships
where gm.id = ranked_memberships.id;

create function public.assign_next_group_sort_nr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    select coalesce(max(gm.sort_nr) + 1, 0)
    into new.sort_nr
    from public.group_members gm
    where gm.user_id = new.user_id;
  end if;

  return new;
end;
$$;

create trigger group_members_assign_next_sort_nr
before insert or update of user_id on public.group_members
for each row
execute function public.assign_next_group_sort_nr();

drop function public.get_my_groups();

create function public.get_my_groups()
returns table (
  group_id uuid,
  group_name text,
  sort_nr integer,
  member_count bigint,
  current_user_is_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    my_membership.sort_nr,
    count(all_members.id)::bigint,
    my_membership.role = 'admin'
  from public.groups g
  join public.group_members my_membership
    on my_membership.group_id = g.id
   and my_membership.user_id = (select auth.uid())
  join public.group_members all_members
    on all_members.group_id = g.id
  group by
    g.id,
    g.name,
    g.created_at,
    my_membership.role,
    my_membership.sort_nr
  order by my_membership.sort_nr, g.created_at desc, g.id;
$$;

create or replace function public.set_my_group_order(p_group_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  membership_count bigint;
  requested_count bigint;
  distinct_requested_count bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_group_ids is null then
    raise exception 'A group order is required.';
  end if;

  select count(*)
  into membership_count
  from public.group_members gm
  where gm.user_id = current_user_id;

  select count(*), count(distinct requested.group_id)
  into requested_count, distinct_requested_count
  from unnest(p_group_ids) as requested(group_id);

  if requested_count <> membership_count
     or distinct_requested_count <> requested_count
     or exists (
       select 1
       from unnest(p_group_ids) as requested(group_id)
       where not exists (
         select 1
         from public.group_members gm
         where gm.user_id = current_user_id
           and gm.group_id = requested.group_id
       )
     ) then
    raise exception 'The group order must contain each of your groups exactly once.';
  end if;

  update public.group_members gm
  set sort_nr = requested.ordinality::integer - 1
  from unnest(p_group_ids) with ordinality as requested(group_id, ordinality)
  where gm.user_id = current_user_id
    and gm.group_id = requested.group_id;
end;
$$;

revoke all on function public.get_my_groups() from public, anon;
revoke all on function public.set_my_group_order(uuid[]) from public, anon;
revoke all on function public.assign_next_group_sort_nr() from public, anon, authenticated;

grant execute on function public.get_my_groups() to authenticated;
grant execute on function public.set_my_group_order(uuid[]) to authenticated;
