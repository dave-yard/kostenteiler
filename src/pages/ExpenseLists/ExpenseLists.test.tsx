import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { ExpenseList, Group } from "@/types/group"
import { ExpenseLists } from "./ExpenseLists"

vi.mock("@/components/contexts/GroupOverviewContext", () => ({
  useGroupOverview: vi.fn(),
}))

const group: Group = {
  id: "group-1",
  name: "WG Beispiel",
  sortNr: 0,
  memberCount: 2,
  currentUserIsAdmin: true,
}

const openList: ExpenseList = {
  id: "list-open",
  groupId: "group-1",
  name: "Wocheneinkauf",
  status: "open",
  createdAt: "2026-10-26T10:00:00.000Z",
  completedAt: null,
  paidAt: null,
}

const paidList: ExpenseList = {
  ...openList,
  id: "list-paid",
  name: "Bezahlt",
  status: "isPaid",
  completedAt: "2026-10-25T10:00:00.000Z",
  paidAt: "2026-10-26T10:00:00.000Z",
}

const getExpenseLists = vi.fn()

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderExpenseLists() {
  vi.mocked(useGroupOverview).mockReturnValue({
    getExpenseLists,
  } as never)

  return render(<ExpenseLists group={group} onBack={vi.fn()} />)
}

describe("ExpenseLists", () => {
  it("loads and shows open lists by default", async () => {
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists()

    expect(
      await screen.findByRole("heading", { name: "Wocheneinkauf" })
    ).toBeTruthy()
    expect(getExpenseLists).toHaveBeenCalledWith("group-1", false)
    expect(screen.queryByText("Urlaub")).toBeNull()
  })

  it("loads non-open lists when the filter is enabled", async () => {
    const user = userEvent.setup()
    getExpenseLists
      .mockResolvedValueOnce([openList])
      .mockResolvedValueOnce([openList, paidList])
    renderExpenseLists()

    await user.click(
      screen.getByRole("checkbox", { name: "Erledigte anzeigen" })
    )

    expect(await screen.findByRole("heading", { name: "Bezahlt" })).toBeTruthy()
    expect(screen.getByText("Bezahlt", { selector: "span" })).toBeTruthy()
    expect(getExpenseLists).toHaveBeenLastCalledWith("group-1", true)
  })

  it("shows a retry action when loading fails", async () => {
    const user = userEvent.setup()
    getExpenseLists
      .mockRejectedValueOnce(new Error("Verbindung fehlgeschlagen"))
      .mockResolvedValueOnce([openList])
    renderExpenseLists()

    expect(await screen.findByText("Verbindung fehlgeschlagen")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }))

    await waitFor(() => {
      expect(getExpenseLists).toHaveBeenCalledTimes(2)
    })
    expect(
      await screen.findByRole("heading", { name: "Wocheneinkauf" })
    ).toBeTruthy()
  })
})
