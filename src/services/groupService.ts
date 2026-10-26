import { getSupabaseClient } from "@/lib/supabase"
import type {
  Group,
  GroupInvitation,
  GroupMember,
  GroupMemberPermissions,
  PersonalContact,
} from "@/types/group"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Daten in einem unerwarteten Format geliefert."
    )
  }

  return data
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value !== "string") {
    throw new Error(
      `In der Gruppenantwort fehlt ein gültiger Wert für "${key}".`
    )
  }

  return value
}

function readBoolean(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value !== "boolean") {
    throw new Error(`In der Gruppenmitglied-Antwort fehlt "${key}".`)
  }

  return value
}

function readNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (value !== null && typeof value !== "string") {
    throw new Error(`In der Gruppenmitglied-Antwort ist "${key}" ungültig.`)
  }

  return value
}

export async function getMyGroups(): Promise<Group[]> {
  const { data, error } = await getSupabaseClient().rpc("get_my_groups")
  if (error) {
    throw error
  }

  return readRows(data).map((row) => {
    const memberCount = row.member_count
    const role = row.current_user_is_admin
    const sortNr = row.sort_nr
    if (
      typeof memberCount !== "number" ||
      typeof role !== "boolean" ||
      typeof sortNr !== "number"
    ) {
      throw new Error("Supabase hat ungültige Gruppendaten geliefert.")
    }

    return {
      id: readString(row, "group_id"),
      name: readString(row, "group_name"),
      sortNr,
      memberCount,
      currentUserIsAdmin: role,
    }
  })
}

export async function saveMyGroupOrder(groupIds: string[]) {
  const { error } = await getSupabaseClient().rpc("set_my_group_order", {
    p_group_ids: groupIds,
  })
  if (error) {
    throw error
  }
}

export async function getMyContacts(): Promise<PersonalContact[]> {
  const { data, error } = await getSupabaseClient()
    .from("personal_contacts")
    .select("id, display_name, email")
    .order("display_name")

  if (error) {
    throw error
  }

  return readRows(data).map((row) => ({
    id: readString(row, "id"),
    displayName: readString(row, "display_name"),
    email: readString(row, "email"),
  }))
}

export async function createPersonalContact(
  displayName: string,
  email: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("personal_contacts")
    .insert({ display_name: displayName, email: email.toLowerCase() })

  if (error) {
    throw error
  }
}

export async function removePersonalContact(contactId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("personal_contacts")
    .delete()
    .eq("id", contactId)

  if (error) {
    throw error
  }
}

export async function createGroupInvitation(
  groupId: string,
  contactId: string
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    "create_group_invitation",
    {
      p_group_id: groupId,
      p_contact_id: contactId,
    }
  )

  if (error) {
    throw error
  }
  if (typeof data !== "string") {
    throw new Error("Der Einladungslink konnte nicht erstellt werden.")
  }

  return data
}

export async function getGroupInvitation(
  token: string
): Promise<GroupInvitation> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_group_invitation",
    { p_token: token }
  )

  if (error) {
    throw error
  }

  const row = readRows(data)[0]
  if (!row) {
    throw new Error("Die Einladung konnte nicht geladen werden.")
  }

  return {
    groupId: readString(row, "group_id"),
    groupName: readString(row, "group_name"),
    displayName: readString(row, "display_name"),
  }
}

export async function acceptGroupInvitation(token: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    "accept_group_invitation",
    { p_token: token }
  )

  if (error) {
    throw error
  }
  if (typeof data !== "string") {
    throw new Error(
      "Die Einladung wurde angenommen, aber die Gruppen-ID fehlt."
    )
  }

  return data
}

export async function createGroup(name: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("create_group", {
    p_name: name,
  })
  if (error) {
    throw error
  }
  if (typeof data !== "string") {
    throw new Error(
      "Die Gruppe wurde angelegt, aber ihre ID fehlt in der Antwort."
    )
  }

  return data
}

export async function renameGroup(groupId: string, name: string) {
  const { error } = await getSupabaseClient()
    .from("groups")
    .update({ name })
    .eq("id", groupId)
    .select("id")
    .single()

  if (error) {
    throw error
  }
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await getSupabaseClient().rpc("get_group_members", {
    p_group_id: groupId,
  })
  if (error) {
    throw error
  }

  return readRows(data).map((row) => {
    const role = readString(row, "member_role")
    if (role !== "admin" && role !== "member") {
      throw new Error("Supabase hat eine unbekannte Gruppenrolle geliefert.")
    }

    return {
      id: readString(row, "member_id"),
      userId: readNullableString(row, "member_user_id"),
      displayName: readString(row, "display_name"),
      email: readNullableString(row, "member_email"),
      role,
      canCreateItems: readBoolean(row, "can_create_items"),
      canEditItems: readBoolean(row, "can_edit_items"),
      canDeleteItems: readBoolean(row, "can_delete_items"),
      canEditSplits: readBoolean(row, "can_edit_splits"),
      canCloseLists: readBoolean(row, "can_close_lists"),
      membershipStatus: readMembershipStatus(row, "membership_status"),
    }
  })
}

function readMembershipStatus(
  row: Record<string, unknown>,
  key: string
): GroupMember["membershipStatus"] {
  const value = readString(row, key)
  if (value !== "active" && value !== "pending" && value !== "legacy") {
    throw new Error("Supabase hat einen unbekannten Mitgliedsstatus geliefert.")
  }

  return value
}

export async function setGroupMemberAdmin(memberId: string, isAdmin: boolean) {
  const { error } = await getSupabaseClient().rpc("set_group_member_admin", {
    p_member_id: memberId,
    p_is_admin: isAdmin,
  })
  if (error) {
    throw error
  }
}

export async function updateGroupMemberPermissions(
  memberId: string,
  permissions: GroupMemberPermissions
) {
  const { error } = await getSupabaseClient().rpc(
    "update_group_member_permissions",
    {
      p_member_id: memberId,
      p_can_create_items: permissions.canCreateItems,
      p_can_edit_items: permissions.canEditItems,
      p_can_delete_items: permissions.canDeleteItems,
      p_can_edit_splits: permissions.canEditSplits,
      p_can_close_lists: permissions.canCloseLists,
    }
  )
  if (error) {
    throw error
  }
}

export async function removeGroupMember(memberId: string) {
  const { error } = await getSupabaseClient().rpc("remove_group_member", {
    p_member_id: memberId,
  })
  if (error) {
    throw error
  }
}
