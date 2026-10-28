import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSupabaseClient } from "@/lib/supabase"
import {
  createExpenseItem,
  deleteExpenseItem,
  getExpenseItems,
  getExpenseItemSplitRule,
  getExpenseListSplitRules,
  updateExpenseItem,
} from "./itemService"

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}))

const query = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  then: vi.fn(),
}
const from = vi.fn()
const rpc = vi.fn()

const input = {
  name: "Socken",
  amountCents: 500,
  paidByMemberId: "member-1",
}

function mockRows(rows: Record<string, unknown>[]) {
  query.then.mockImplementation(
    (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve)
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  from.mockReturnValue(query)
  vi.mocked(getSupabaseClient).mockReturnValue({ from, rpc } as never)
  rpc.mockResolvedValue({ data: "item-id", error: null })
})

describe("itemService", () => {
  it("reads items of a list and maps them to camelCase", async () => {
    mockRows([
      {
        id: "item-1",
        list_id: "list-1",
        name: "Socken",
        amount_cents: 500,
        paid_by_member_id: "member-1",
        created_at: "2026-10-26T10:00:00.000Z",
      },
    ])

    const items = await getExpenseItems("list-1")

    expect(from).toHaveBeenCalledWith("expense_items")
    expect(query.eq).toHaveBeenCalledWith("list_id", "list-1")
    expect(items).toEqual([
      {
        id: "item-1",
        listId: "list-1",
        name: "Socken",
        amountCents: 500,
        paidByMemberId: "member-1",
        isReceipt: false,
        parentItemId: null,
        createdAt: "2026-10-26T10:00:00.000Z",
      },
    ])
  })

  it("rejects an amount that is not a whole number of cents", async () => {
    mockRows([
      {
        id: "item-1",
        list_id: "list-1",
        name: "Socken",
        amount_cents: 5.5,
        paid_by_member_id: "member-1",
        created_at: "2026-10-26T10:00:00.000Z",
      },
    ])

    await expect(getExpenseItems("list-1")).rejects.toThrow("amount_cents")
  })

  it("creates an item through the authorized database function", async () => {
    const id = await createExpenseItem("list-1", input)

    expect(rpc).toHaveBeenCalledWith("create_expense_item_hierarchical", {
      p_list_id: "list-1",
      p_name: "Socken",
      p_amount_cents: 500,
      p_paid_by_member_id: "member-1",
      p_split_rule: null,
      p_is_receipt: false,
      p_parent_item_id: null,
    })
    expect(id).toBe("item-id")
  })

  it("fails when the created item has no id", async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(createExpenseItem("list-1", input)).rejects.toThrow("ID fehlt")
  })

  it("updates an item through the authorized database function", async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await updateExpenseItem("item-1", input)

    expect(rpc).toHaveBeenCalledWith("update_expense_item_hierarchical", {
      p_item_id: "item-1",
      p_name: "Socken",
      p_amount_cents: 500,
      p_paid_by_member_id: "member-1",
      p_split_rule: null,
      p_is_receipt: false,
    })
  })

  it("loads an item split rule through the authorized database function", async () => {
    rpc.mockResolvedValue({ data: { mode: "equal" }, error: null })

    await expect(getExpenseItemSplitRule("item-1")).resolves.toEqual({
      mode: "equal",
    })
    expect(rpc).toHaveBeenCalledWith("get_item_split_rule", {
      p_item_id: "item-1",
    })
  })

  it("loads all split rules of a list in one call", async () => {
    rpc.mockResolvedValue({
      data: [
        { item_id: "item-1", split_rule: { mode: "equal" } },
        {
          item_id: "item-2",
          split_rule: { mode: "complete", memberId: "member-1" },
        },
      ],
      error: null,
    })

    await expect(getExpenseListSplitRules("list-1")).resolves.toEqual({
      "item-1": { mode: "equal" },
      "item-2": { mode: "complete", memberId: "member-1" },
    })
    expect(rpc).toHaveBeenCalledWith("get_list_split_rules", {
      p_list_id: "list-1",
    })
  })

  it("deletes an item through the authorized database function", async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await deleteExpenseItem("item-1")

    expect(rpc).toHaveBeenCalledWith("delete_expense_item", {
      p_item_id: "item-1",
    })
  })

  it("passes database errors on to the caller", async () => {
    const error = new Error("You are not allowed to perform this action.")
    rpc.mockResolvedValue({ data: null, error })

    await expect(deleteExpenseItem("item-1")).rejects.toBe(error)
  })
})
