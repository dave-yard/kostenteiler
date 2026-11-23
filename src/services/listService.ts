import { getSupabaseClient } from "@/lib/supabase"
import type {
  CreateExpenseListParams,
  ExpenseList,
  ExpenseListType,
  RecurringInterval,
} from "@/types/group"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value !== "string") {
    throw new Error(
      `In der Listenantwort fehlt ein gültiger Wert für "${key}".`
    )
  }

  return value
}

function readNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (value !== null && typeof value !== "string") {
    throw new Error(`Der Wert "${key}" in der Listenantwort ist ungültig.`)
  }

  return value
}

export async function getExpenseLists(
  groupId: string,
  includeCompleted: boolean
): Promise<ExpenseList[]> {
  let query = getSupabaseClient()
    .from("expense_lists")
    .select("id, group_id, name, status, created_at, completed_at, paid_at")
    .eq("group_id", groupId)

  if (!includeCompleted) {
    query = query.eq("status", "open")
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  })

  if (error) {
    throw error
  }

  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Listen in einem unerwarteten Format geliefert."
    )
  }

  return data.map((row) => {
    const record = row as Record<string, unknown>
    const status = readString(record, "status")
    if (status !== "open" && status !== "completed" && status !== "isPaid") {
      throw new Error("Supabase hat einen unbekannten Listenstatus geliefert.")
    }

    const listType =
      record.list_type === "recurring" || record.list_type === "one_off"
        ? (record.list_type as ExpenseListType)
        : "one_off"
    const interval =
      record.interval === "monthly" ||
      record.interval === "quarterly" ||
      record.interval === "yearly"
        ? (record.interval as RecurringInterval)
        : null
    const dayOfMonth =
      typeof record.day_of_month === "number" ? record.day_of_month : null
    const autoClose = record.auto_close === true
    const createdByUserId =
      typeof record.created_by_user_id === "string"
        ? record.created_by_user_id
        : null
    const completedByUserId =
      typeof record.completed_by_user_id === "string"
        ? record.completed_by_user_id
        : null
    const paidByUserId =
      typeof record.paid_by_user_id === "string"
        ? record.paid_by_user_id
        : null

    return {
      id: readString(record, "id"),
      groupId: readString(record, "group_id"),
      name: readString(record, "name"),
      status,
      createdAt: readString(record, "created_at"),
      createdByUserId,
      completedAt: readNullableString(record, "completed_at"),
      completedByUserId,
      paidAt: readNullableString(record, "paid_at"),
      paidByUserId,
      listType,
      interval,
      dayOfMonth,
      autoClose,
    }
  })
}

export async function completeExpenseList(listId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("complete_expense_list", {
    p_list_id: listId,
  })

  if (error) {
    throw error
  }
}

export async function markExpenseListPaid(listId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("mark_expense_list_paid", {
    p_list_id: listId,
  })

  if (error) {
    throw error
  }
}

export async function createExpenseList(
  groupId: string,
  params: string | CreateExpenseListParams,
  options?: Partial<CreateExpenseListParams>
): Promise<string> {
  const name = typeof params === "string" ? params.trim() : params.name.trim()
  const listType =
    typeof params === "object"
      ? params.listType ?? "one_off"
      : options?.listType ?? "one_off"
  const interval =
    typeof params === "object"
      ? params.interval ?? null
      : options?.interval ?? null
  const dayOfMonth =
    typeof params === "object"
      ? params.dayOfMonth ?? null
      : options?.dayOfMonth ?? null
  const autoClose =
    typeof params === "object"
      ? params.autoClose ?? false
      : options?.autoClose ?? false

  const rpcPayload: Record<string, unknown> = {
    p_group_id: groupId,
    p_name: name,
  }
  if (listType !== "one_off") {
    rpcPayload.p_list_type = listType
  }
  if (interval) {
    rpcPayload.p_interval = interval
  }
  if (dayOfMonth !== null && dayOfMonth !== undefined) {
    rpcPayload.p_day_of_month = dayOfMonth
  }
  if (autoClose) {
    rpcPayload.p_auto_close = autoClose
  }

  const { data, error } = await getSupabaseClient().rpc(
    "create_expense_list",
    rpcPayload
  )

  if (error) {
    throw error
  }
  if (typeof data !== "string") {
    throw new Error("Die Ausgabenliste wurde erstellt, aber ihre ID fehlt.")
  }

  return data
}

export interface UpdateExpenseListTypeParams {
  listType: ExpenseListType
  interval?: RecurringInterval | null
  dayOfMonth?: number | null
  autoClose?: boolean
}

export async function updateExpenseListType(
  listId: string,
  params: UpdateExpenseListTypeParams
): Promise<void> {
  const updateData = {
    list_type: params.listType,
    interval:
      params.listType === "recurring" ? params.interval ?? "monthly" : null,
    day_of_month:
      params.listType === "recurring" ? params.dayOfMonth ?? 1 : null,
    auto_close:
      params.listType === "recurring" ? params.autoClose ?? false : false,
  }

  const { error } = await getSupabaseClient()
    .from("expense_lists")
    .update(updateData)
    .eq("id", listId)

  if (error) {
    throw error
  }
}

