import { getSupabaseClient } from "@/lib/supabase"
import {
  parseExpenseSplitRule,
  type ExpenseSplitRule,
} from "@/lib/expenseSplit"
import type { ExpenseItem } from "@/types/group"

export interface ExpenseItemInput {
  name: string
  amountCents: number
  paidByMemberId: string
  splitRule?: ExpenseSplitRule | null
  isReceipt?: boolean
  parentItemId?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value !== "string") {
    throw new Error(
      `In der Positionsantwort fehlt ein gültiger Wert für "${key}".`
    )
  }

  return value
}

function readInteger(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Der Wert "${key}" in der Positionsantwort ist ungültig.`)
  }

  return value
}

export async function getExpenseItems(listId: string): Promise<ExpenseItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("expense_items")
    .select(
      "id, list_id, name, amount_cents, paid_by_member_id, is_receipt, parent_item_id, created_at"
    )
    .eq("list_id", listId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Positionen in einem unerwarteten Format geliefert."
    )
  }

  return data.map((row) => ({
    id: readString(row, "id"),
    listId: readString(row, "list_id"),
    name: readString(row, "name"),
    amountCents: readInteger(row, "amount_cents"),
    paidByMemberId: readString(row, "paid_by_member_id"),
    isReceipt: row.is_receipt === true,
    parentItemId:
      typeof row.parent_item_id === "string" ? row.parent_item_id : null,
    createdAt: readString(row, "created_at"),
  }))
}

export async function createExpenseItem(
  listId: string,
  input: ExpenseItemInput
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    "create_expense_item_hierarchical",
    {
      p_list_id: listId,
      p_name: input.name,
      p_amount_cents: input.amountCents,
      p_paid_by_member_id: input.paidByMemberId,
      p_split_rule: input.splitRule ?? null,
      p_is_receipt: input.isReceipt ?? false,
      p_parent_item_id: input.parentItemId ?? null,
    }
  )

  if (error) {
    throw error
  }
  if (typeof data !== "string") {
    throw new Error("Die Position wurde erstellt, aber ihre ID fehlt.")
  }

  return data
}

export async function updateExpenseItem(
  itemId: string,
  input: ExpenseItemInput
): Promise<void> {
  const { error } = await getSupabaseClient().rpc(
    "update_expense_item_hierarchical",
    {
      p_item_id: itemId,
      p_name: input.name,
      p_amount_cents: input.amountCents,
      p_paid_by_member_id: input.paidByMemberId,
      p_split_rule: input.splitRule ?? null,
      p_is_receipt: input.isReceipt ?? false,
    }
  )

  if (error) {
    throw error
  }
}

export async function getExpenseItemSplitRule(
  itemId: string
): Promise<ExpenseSplitRule> {
  const { data, error } = await getSupabaseClient().rpc("get_item_split_rule", {
    p_item_id: itemId,
  })

  if (error) {
    throw error
  }

  return parseExpenseSplitRule(data)
}

export async function getExpenseListMemberNames(
  listId: string
): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_list_member_names",
    { p_list_id: listId }
  )

  if (error) {
    throw error
  }
  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Mitgliedsnamen in einem unerwarteten Format geliefert."
    )
  }

  return Object.fromEntries(
    data.map((row) => [
      readString(row, "member_id"),
      readString(row, "display_name"),
    ])
  )
}

export async function getExpenseListSplitRules(
  listId: string
): Promise<Record<string, ExpenseSplitRule>> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_list_split_rules",
    {
      p_list_id: listId,
    }
  )

  if (error) {
    throw error
  }
  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Aufteilungen in einem unerwarteten Format geliefert."
    )
  }

  return Object.fromEntries(
    data.map((row) => [
      readString(row, "item_id"),
      parseExpenseSplitRule(row.split_rule),
    ])
  )
}

export async function deleteExpenseItem(itemId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("delete_expense_item", {
    p_item_id: itemId,
  })

  if (error) {
    throw error
  }
}
