import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSupabaseClient } from "@/lib/supabase"
import { getExpenseLists } from "./listService"

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}))

const query = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  then: vi.fn(),
}

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
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.then.mockImplementation(
    (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve)
  )
  vi.mocked(getSupabaseClient).mockReturnValue({
    from: vi.fn().mockReturnValue(query),
  } as never)
})

describe("listService", () => {
  it("loads only open lists by default and maps database fields", async () => {
    const lists = await getExpenseLists("group-1", false)

    expect(query.eq).toHaveBeenNthCalledWith(1, "group_id", "group-1")
    expect(query.eq).toHaveBeenNthCalledWith(2, "status", "open")
    expect(lists).toEqual([
      {
        id: "list-1",
        groupId: "group-1",
        name: "Wocheneinkauf",
        status: "open",
        createdAt: "2026-10-26T10:00:00.000Z",
        completedAt: null,
        paidAt: null,
      },
    ])
  })

  it("includes completed lists when requested", async () => {
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
})
