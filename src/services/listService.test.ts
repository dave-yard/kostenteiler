import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSupabaseClient } from "@/lib/supabase"
import {
  completeExpenseList,
  createExpenseList,
  getExpenseListPayments,
  getExpenseLists,
  markExpenseListPaymentPaid,
  updateExpenseListType,
} from "./listService"

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}))

const query = {
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
  order: vi.fn(),
  then: vi.fn(),
}
const rpc = vi.fn()

const rows: Record<string, unknown>[] = [
  {
    id: "list-1",
    group_id: "group-1",
    name: "Wocheneinkauf",
    status: "open",
    created_at: "2026-10-26T10:00:00.000Z",
    completed_at: null,
    paid_at: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  query.select.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.neq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.then.mockImplementation(
    (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve)
  )
  vi.mocked(getSupabaseClient).mockReturnValue({
    from: vi.fn().mockReturnValue(query),
    rpc,
  } as never)
  rpc.mockResolvedValue({ data: "list-id", error: null })
})

describe("listService", () => {
  it("creates an expense list through the authorized database function", async () => {
    const id = await createExpenseList("group-1", "Wocheneinkauf")

    expect(rpc).toHaveBeenCalledWith("create_expense_list", {
      p_group_id: "group-1",
      p_name: "Wocheneinkauf",
    })
    expect(id).toBe("list-id")
  })

  it("creates a recurring expense list with schedule parameters", async () => {
    const id = await createExpenseList("group-1", {
      name: "Miete",
      listType: "recurring",
      interval: "monthly",
      dayOfMonth: 1,
      autoClose: true,
    })

    expect(rpc).toHaveBeenCalledWith("create_expense_list", {
      p_group_id: "group-1",
      p_name: "Miete",
      p_list_type: "recurring",
      p_interval: "monthly",
      p_day_of_month: 1,
      p_auto_close: true,
    })
    expect(id).toBe("list-id")
  })

  it("surfaces errors returned by the expense list creation function", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("Creation denied"),
    })

    await expect(createExpenseList("group-1", "Wocheneinkauf")).rejects.toThrow(
      "Creation denied"
    )
  })

  it("completes lists with persisted payment proposals", async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await completeExpenseList("list-1", [
      {
        fromMemberId: "member-1",
        toMemberId: "member-2",
        amountCents: 500,
      },
    ])

    expect(rpc).toHaveBeenCalledWith("complete_expense_list", {
      p_list_id: "list-1",
      p_payments: [
        {
          from_member_id: "member-1",
          to_member_id: "member-2",
          amount_cents: 500,
        },
      ],
    })
  })

  it("surfaces errors from the status functions", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Denied") })

    await expect(completeExpenseList("list-1", [])).rejects.toThrow("Denied")
  })

  it("loads persisted payment proposals and returns their all-paid state", async () => {
    query.then.mockImplementationOnce(
      (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({
          data: [
            {
              id: "payment-1",
              list_id: "list-1",
              from_member_id: "member-1",
              to_member_id: "member-2",
              amount_cents: 500,
              status: "pending",
              paid_at: null,
              paid_by_user_id: null,
            },
          ],
          error: null,
        }).then(resolve)
    )
    rpc.mockResolvedValueOnce({ data: true, error: null })

    await expect(getExpenseListPayments("list-1")).resolves.toEqual([
      {
        id: "payment-1",
        listId: "list-1",
        fromMemberId: "member-1",
        toMemberId: "member-2",
        amountCents: 500,
        status: "pending",
        paidAt: null,
        paidByUserId: null,
      },
    ])
    await expect(markExpenseListPaymentPaid("payment-1")).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith("mark_expense_list_payment_paid", {
      p_payment_id: "payment-1",
    })
  })

  it("loads only open lists by default and maps database fields", async () => {
    const lists = await getExpenseLists("group-1", false)

    expect(query.eq).toHaveBeenNthCalledWith(1, "group_id", "group-1")
    expect(query.neq).toHaveBeenCalledWith("status", "isPaid")
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    })
    expect(lists).toEqual([
      {
        id: "list-1",
        groupId: "group-1",
        name: "Wocheneinkauf",
        status: "open",
        createdAt: "2026-10-26T10:00:00.000Z",
        completedAt: null,
        paidAt: null,
        createdByUserId: null,
        completedByUserId: null,
        paidByUserId: null,
        listType: "one_off",
        interval: null,
        dayOfMonth: null,
        autoClose: false,
      },
    ])
  })

  it("includes paid lists when requested", async () => {
    await getExpenseLists("group-1", true)

    expect(query.eq).toHaveBeenCalledTimes(1)
    expect(query.eq).toHaveBeenCalledWith("group_id", "group-1")
  })

  it("maps the paid state from the status field without a separate boolean", async () => {
    query.then.mockImplementationOnce(
      (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({
          data: [
            {
              ...rows[0],
              status: "isPaid",
              completed_at: "2026-10-26T11:00:00.000Z",
              paid_at: "2026-10-26T12:00:00.000Z",
            },
          ],
          error: null,
        }).then(resolve)
    )

    const [list] = await getExpenseLists("group-1", true)

    expect(list.status).toBe("isPaid")
    expect(list).not.toHaveProperty("isPaid")
  })

  it("surfaces database errors", async () => {
    query.then.mockImplementationOnce(
      (resolve: (value: { data: null; error: Error }) => unknown) =>
        Promise.resolve({
          data: null,
          error: new Error("Database unavailable"),
        }).then(resolve)
    )

    await expect(getExpenseLists("group-1", false)).rejects.toThrow(
      "Database unavailable"
    )
  })

  it("updates list type through supabase update", async () => {
    query.then.mockImplementationOnce(
      (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
    )

    await updateExpenseListType("list-1", {
      listType: "recurring",
      interval: "monthly",
      dayOfMonth: 15,
      autoClose: true,
    })

    expect(query.update).toHaveBeenCalledWith({
      list_type: "recurring",
      interval: "monthly",
      day_of_month: 15,
      auto_close: true,
    })
    expect(query.eq).toHaveBeenCalledWith("id", "list-1")
  })

  it("surfaces errors when updating list type fails", async () => {
    query.then.mockImplementationOnce(
      (resolve: (value: { data: null; error: Error }) => unknown) =>
        Promise.resolve({
          data: null,
          error: new Error("Update failed"),
        }).then(resolve)
    )

    await expect(
      updateExpenseListType("list-1", {
        listType: "one_off",
      })
    ).rejects.toThrow("Update failed")
  })
})
