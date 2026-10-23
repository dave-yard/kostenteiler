create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  can_create_items boolean not null default false,
  can_edit_items boolean not null default false,
  can_delete_items boolean not null default false,
  can_edit_splits boolean not null default false,
  can_close_lists boolean not null default false,
  created_at timestamptz not null default now(),
  constraint group_members_admin_must_be_registered
    check (role <> 'admin' or user_id is not null)
);

create unique index group_members_unique_registered_user
  on public.group_members (group_id, user_id)
  where user_id is not null;

create index group_members_group_id_idx on public.group_members (group_id);

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
  );
$$;

create or replace function public.get_my_groups()
returns table (
  group_id uuid,
  group_name text,
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
    count(all_members.id)::bigint,
    my_membership.role = 'admin'
  from public.groups g
  join public.group_members my_membership
    on my_membership.group_id = g.id
   and my_membership.user_id = (select auth.uid())
  join public.group_members all_members
    on all_members.group_id = g.id
  group by g.id, g.name, g.created_at, my_membership.role
  order by g.created_at desc;
$$;

create or replace function public.get_group_members(p_group_id uuid)
returns table (
  member_id uuid,
  member_user_id uuid,
  display_name text,
  member_email text,
  member_role text,
  can_create_items boolean,
  can_edit_items boolean,
  can_delete_items boolean,
  can_edit_splits boolean,
  can_close_lists boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group.';
  end if;

  return query
  select
    gm.id,
    gm.user_id,
    gm.display_name,
    gm.email,
    gm.role,
    gm.can_create_items,
    gm.can_edit_items,
    gm.can_delete_items,
    gm.can_edit_splits,
    gm.can_close_lists
  from public.group_members gm
  where gm.group_id = p_group_id
  order by (gm.role = 'admin') desc, gm.display_name;
end;
$$;

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group_id uuid;
  new_display_name text;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Group name must contain between 1 and 80 characters.';
  end if;

  current_email := auth.jwt() ->> 'email';
  new_display_name := coalesce(
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    nullif(split_part(current_email, '@', 1), ''),
    'Du'
  );

  insert into public.groups (name, created_by)
  values (btrim(p_name), auth.uid())
  returning id into new_group_id;

  insert into public.group_members (
    group_id,
    user_id,
    display_name,
    email,
    role
  )
  values (
    new_group_id,
    auth.uid(),
    new_display_name,
    current_email,
    'admin'
  );

  return new_group_id;
end;
$$;

create or replace function public.create_virtual_group_member(
  p_group_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_member_id uuid;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Only group admins can add members.';
  end if;

  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 80 then
    raise exception 'Member name must contain between 1 and 80 characters.';
  end if;

  insert into public.group_members (group_id, display_name)
  values (p_group_id, btrim(p_display_name))
  returning id into new_member_id;

  return new_member_id;
end;
$$;

create or replace function public.set_group_member_admin(
  p_member_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_member public.group_members%rowtype;
  admin_count bigint;
begin
  select gm.* into target_member
  from public.group_members gm
  where gm.id = p_member_id;

  if target_member.id is null
    or not public.is_group_admin(target_member.group_id) then
    raise exception 'Only group admins can change member roles.';
  end if;

  if p_is_admin and target_member.user_id is null then
    raise exception 'Virtual members cannot be group admins.';
  end if;

  if not p_is_admin and target_member.role = 'admin' then
    select count(*) into admin_count
    from public.group_members gm
    where gm.group_id = target_member.group_id
      and gm.role = 'admin';

    if admin_count <= 1 then
      raise exception 'A group must have at least one admin.';
    end if;
  end if;

  update public.group_members
  set role = case when p_is_admin then 'admin' else 'member' end
  where id = p_member_id;
end;
$$;

create or replace function public.update_group_member_permissions(
  p_member_id uuid,
  p_can_create_items boolean,
  p_can_edit_items boolean,
  p_can_delete_items boolean,
  p_can_edit_splits boolean,
  p_can_close_lists boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
begin
  select gm.group_id into target_group_id
  from public.group_members gm
  where gm.id = p_member_id;

  if target_group_id is null
    or not public.is_group_admin(target_group_id) then
    raise exception 'Only group admins can change member permissions.';
  end if;

  update public.group_members
  set
    can_create_items = p_can_create_items,
    can_edit_items = p_can_edit_items,
    can_delete_items = p_can_delete_items,
    can_edit_splits = p_can_edit_splits,
    can_close_lists = p_can_close_lists
  where id = p_member_id
    and role = 'member';
end;
$$;

create or replace function public.remove_group_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_member public.group_members%rowtype;
  admin_count bigint;
begin
  select gm.* into target_member
  from public.group_members gm
  where gm.id = p_member_id;

  if target_member.id is null
    or not public.is_group_admin(target_member.group_id) then
    raise exception 'Only group admins can remove members.';
  end if;

  if target_member.role = 'admin' then
    select count(*) into admin_count
    from public.group_members gm
    where gm.group_id = target_member.group_id
      and gm.role = 'admin';

    if admin_count <= 1 then
      raise exception 'The last group admin cannot be removed.';
    end if;
  end if;

  delete from public.group_members where id = p_member_id;
end;
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "Group members can read their groups"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "Group admins can update their groups"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "Group members can read group membership"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_admin(uuid) from public, anon;
revoke all on function public.get_my_groups() from public, anon;
revoke all on function public.get_group_members(uuid) from public, anon;
revoke all on function public.create_group(text) from public, anon;
revoke all on function public.create_virtual_group_member(uuid, text) from public, anon;
revoke all on function public.set_group_member_admin(uuid, boolean) from public, anon;
revoke all on function public.update_group_member_permissions(uuid, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.remove_group_member(uuid) from public, anon;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.get_my_groups() to authenticated;
grant execute on function public.get_group_members(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.create_virtual_group_member(uuid, text) to authenticated;
grant execute on function public.set_group_member_admin(uuid, boolean) to authenticated;
grant execute on function public.update_group_member_permissions(uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.remove_group_member(uuid) to authenticated;

revoke all on public.groups from anon, authenticated;
revoke all on public.group_members from anon, authenticated;
grant select, update (name) on public.groups to authenticated;
grant select on public.group_members to authenticated;
