import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  completeExpenseList,
  createExpenseList,
  getExpenseLists,
} from "@/services/listService"
import {
  createExpenseItem,
  getExpenseItems,
  getExpenseListSplitRules,
} from "@/services/itemService"
import type { ExpenseItem, ExpenseList } from "@/types/group"
import {
  copyItemsToNextPeriod,
  processRecurringExpenseLists,
} from "./recurringService"

vi.mock("@/services/listService", () => ({
  getExpenseLists: vi.fn(),
  createExpenseList: vi.fn(),
  completeExpenseList: vi.fn(),
}))

vi.mock("@/services/itemService", () => ({
  getExpenseItems: vi.fn(),
  getExpenseListSplitRules: vi.fn(),
  createExpenseItem: vi.fn(),
}))

const recurringList: ExpenseList = {
  id: "list-rec-1",
  groupId: "group-1",
  name: "Miete (Januar 2026)",
  status: "open",
  createdAt: "2026-01-01T10:00:00.000Z",
  completedAt: null,
  paidAt: null,
  listType: "recurring",
  interval: "monthly",
  dayOfMonth: 1,
  autoClose: true,
}

const mockItems: ExpenseItem[] = [
  {
    id: "item-parent-1",
    listId: "list-rec-1",
    name: "Kaltmiete & Nebenkosten",
    amountCents: 100000,
    paidByMemberId: "m1",
    isReceipt: true,
    parentItemId: null,
    item_date: "2026-01-01",
    createdAt: "2026-01-01T10:00:00.000Z",
  },
  {
    id: "item-child-1",
    listId: "list-rec-1",
    name: "Heizkosten",
    amountCents: 15000,
    paidByMemberId: "m2",
    isReceipt: false,
    parentItemId: "item-parent-1",
    item_date: "2026-01-01",
    createdAt: "2026-01-01T10:05:00.000Z",
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createExpenseList).mockResolvedValue("list-rec-2")
  vi.mocked(completeExpenseList).mockResolvedValue(undefined)
  vi.mocked(createExpenseItem).mockImplementation(
    async (_listId, input) => (input.isReceipt ? "new-parent-id" : "new-child-id")
  )
  vi.mocked(getExpenseItems).mockResolvedValue(mockItems)
  vi.mocked(getExpenseListSplitRules).mockResolvedValue({
    "item-parent-1": { mode: "equal" },
    "item-child-1": { mode: "percentage", shares: [{ memberId: "m2", basisPoints: 10000 }] },
  })
})

describe("recurringService", () => {
  describe("copyItemsToNextPeriod", () => {
    it("copies top-level items and subpositions with their split rules", async () => {
      await copyItemsToNextPeriod("list-rec-1", "list-rec-2")

      expect(getExpenseItems).toHaveBeenCalledWith("list-rec-1")
      expect(getExpenseListSplitRules).toHaveBeenCalledWith("list-rec-1")

      // Erst Parent angelegt
      expect(createExpenseItem).toHaveBeenNthCalledWith(1, "list-rec-2", {
        name: "Kaltmiete & Nebenkosten",
        amountCents: 100000,
        paidByMemberId: "m1",
        splitRule: { mode: "equal" },
        isReceipt: true,
        item_date: expect.any(String),
      })

      // Dann Child mit neuer Parent-ID angelegt
      expect(createExpenseItem).toHaveBeenNthCalledWith(2, "list-rec-2", {
        name: "Heizkosten",
        amountCents: 15000,
        paidByMemberId: "m2",
        splitRule: {
          mode: "percentage",
          shares: [{ memberId: "m2", basisPoints: 10000 }],
        },
        isReceipt: false,
        parentItemId: "new-parent-id",
        item_date: expect.any(String),
      })
    })
  })

  describe("processRecurringExpenseLists", () => {
    it("does not generate list if next period is not yet due", async () => {
      vi.mocked(getExpenseLists).mockResolvedValue([recurringList])

      // Referenzdatum: 15. Januar 2026 (nächste Periode ist am 1. Februar fällig)
      const refDate = new Date(2026, 0, 15)
      const result = await processRecurringExpenseLists("group-1", refDate)

      expect(result.generatedListsCount).toBe(0)
      expect(createExpenseList).not.toHaveBeenCalled()
    })

    it("generates next period and automatically closes previous list if autoClose is true", async () => {
      vi.mocked(getExpenseLists).mockResolvedValue([recurringList])

      // Referenzdatum: 2. Februar 2026 -> fällig!
      const refDate = new Date(2026, 1, 2)
      const result = await processRecurringExpenseLists("group-1", refDate)

      expect(result.generatedListsCount).toBe(1)
      expect(result.autoClosedListsCount).toBe(1)
      expect(createExpenseList).toHaveBeenCalledWith("group-1", {
        name: "Miete (Februar 2026)",
        listType: "recurring",
        interval: "monthly",
        dayOfMonth: 1,
        autoClose: true,
      })

      // Vorperiode automatisch abgeschlossen (FR-5.3)
      expect(completeExpenseList).toHaveBeenCalledWith("list-rec-1")

      // Positionen übernommen (FR-5.2)
      expect(createExpenseItem).toHaveBeenCalled()
    })

    it("does not auto-close previous period if autoClose is false", async () => {
      vi.mocked(getExpenseLists).mockResolvedValue([
        {
          ...recurringList,
          autoClose: false,
        },
      ])

      const refDate = new Date(2026, 1, 2)
      const result = await processRecurringExpenseLists("group-1", refDate)

      expect(result.generatedListsCount).toBe(1)
      expect(result.autoClosedListsCount).toBe(0)
      expect(completeExpenseList).not.toHaveBeenCalled()
    })

    it("does not recreate if next period already exists", async () => {
      const februaryList: ExpenseList = {
        ...recurringList,
        id: "list-rec-2",
        name: "Miete (Februar 2026)",
        createdAt: "2026-02-01T10:00:00.000Z",
      }
      vi.mocked(getExpenseLists).mockResolvedValue([februaryList, recurringList])

      const refDate = new Date(2026, 1, 2)
      const result = await processRecurringExpenseLists("group-1", refDate)

      expect(result.generatedListsCount).toBe(0)
      expect(createExpenseList).not.toHaveBeenCalled()
    })
  })
})
