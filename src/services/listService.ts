import { getSupabaseClient } from "@/lib/supabase"
import type { ExpenseList } from "@/types/group"

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
    const status = readString(row, "status")
    if (status !== "open" && status !== "completed" && status !== "isPaid") {
      throw new Error("Supabase hat einen unbekannten Listenstatus geliefert.")
    }

    return {
      id: readString(row, "id"),
      groupId: readString(row, "group_id"),
      name: readString(row, "name"),
      status,
      createdAt: readString(row, "created_at"),
      completedAt: readNullableString(row, "completed_at"),
      paidAt: readNullableString(row, "paid_at"),
    }
  })
}
