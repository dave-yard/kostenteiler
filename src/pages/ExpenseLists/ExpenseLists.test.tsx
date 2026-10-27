import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import type { ExpenseList, Group } from "@/types/group"
import { ExpenseLists } from "./ExpenseLists"

vi.mock("@/components/contexts/ExpenseListContext", () => ({
  useExpenseLists: vi.fn(),
}))

const group: Group = {
  id: "group-1",
  name: "WG Beispiel",
  sortNr: 0,
  memberCount: 2,
  currentUserIsAdmin: true,
  archivedAt: null,
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
  name: "Urlaub",
  status: "isPaid",
  completedAt: "2026-10-25T10:00:00.000Z",
  paidAt: "2026-10-26T10:00:00.000Z",
}

const getExpenseLists = vi.fn()
const createExpenseList = vi.fn()
const completeExpenseList = vi.fn()
const markExpenseListPaid = vi.fn()
const canCloseExpenseLists = vi.fn()

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  getExpenseLists.mockReset()
  createExpenseList.mockReset()
  completeExpenseList.mockReset()
  markExpenseListPaid.mockReset()
  canCloseExpenseLists.mockReset()
})

function ExpenseListsHarness({ group: selectedGroup }: { group: Group }) {
  const [includeCompleted, setIncludeCompleted] = useState(false)

  return (
    <ExpenseLists
      group={selectedGroup}
      includeCompleted={includeCompleted}
      onBack={vi.fn()}
      onIncludeCompletedChange={setIncludeCompleted}
      onOpenList={vi.fn()}
    />
  )
}

function renderExpenseLists(selectedGroup = group) {
  canCloseExpenseLists.mockResolvedValue(selectedGroup.currentUserIsAdmin)
  vi.mocked(useExpenseLists).mockReturnValue({
    getExpenseLists,
    createExpenseList,
    completeExpenseList,
    markExpenseListPaid,
    canCloseExpenseLists,
  } as never)

  return render(<ExpenseListsHarness group={selectedGroup} />)
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

    expect(await screen.findByRole("heading", { name: "Urlaub" })).toBeTruthy()
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

  it("allows admins to create an expense list and shows it after reloading", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValueOnce([]).mockResolvedValueOnce([openList])
    createExpenseList.mockResolvedValue("list-open")
    renderExpenseLists()

    await user.click(
      screen.getByRole("button", { name: "Neue Ausgabenliste hinzufügen" })
    )
    await user.type(
      screen.getByRole("textbox", { name: "Name der neuen Ausgabenliste" }),
      "  Wocheneinkauf  "
    )
    await user.click(screen.getByRole("button", { name: "Erstellen" }))

    expect(createExpenseList).toHaveBeenCalledWith("group-1", "Wocheneinkauf")
    expect(
      await screen.findByRole("heading", { name: "Wocheneinkauf" })
    ).toBeTruthy()
    const successToast = await screen.findByRole("status")
    expect(successToast.textContent).toContain(
      "Die Ausgabenliste wurde erstellt."
    )
    expect(successToast.className).toContain("fixed")
  })

  it("completes an open list after confirmation and reloads", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    getExpenseLists.mockResolvedValueOnce([openList]).mockResolvedValueOnce([])
    completeExpenseList.mockResolvedValue(undefined)
    renderExpenseLists()

    await user.click(await screen.findByRole("button", { name: "Abschließen" }))

    expect(completeExpenseList).toHaveBeenCalledWith("list-open")
    expect((await screen.findByRole("status")).textContent).toContain(
      "Die Ausgabenliste wurde abgeschlossen."
    )
    expect(getExpenseLists).toHaveBeenCalledTimes(2)
  })

  it("does nothing when the confirmation is declined", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(false)
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists()

    await user.click(await screen.findByRole("button", { name: "Abschließen" }))

    expect(completeExpenseList).not.toHaveBeenCalled()
  })

  it("marks a completed list as paid and offers no action for paid lists", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const completedList: ExpenseList = {
      ...openList,
      id: "list-completed",
      name: "Erledigt",
      status: "completed",
      completedAt: "2026-10-26T11:00:00.000Z",
    }
    getExpenseLists.mockResolvedValue([completedList, paidList])
    markExpenseListPaid.mockResolvedValue(undefined)
    renderExpenseLists()

    const buttons = await screen.findAllByRole("button", {
      name: "Als bezahlt markieren",
    })
    expect(buttons).toHaveLength(1)
    await user.click(buttons[0])

    expect(markExpenseListPaid).toHaveBeenCalledWith("list-completed")
  })

  it("shows status errors as an error toast", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    getExpenseLists.mockResolvedValue([openList])
    completeExpenseList.mockRejectedValue({
      message: "You are not allowed to complete this expense list.",
    })
    renderExpenseLists()

    await user.click(await screen.findByRole("button", { name: "Abschließen" }))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "You are not allowed to complete this expense list."
    )
  })

  it("hides status actions without the close permission", async () => {
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists({ ...group, currentUserIsAdmin: false })

    await screen.findByRole("heading", { name: "Wocheneinkauf" })
    expect(screen.queryByRole("button", { name: "Abschließen" })).toBeNull()
  })

  it("does not offer list creation to non-admin members", async () => {
    const memberGroup = { ...group, currentUserIsAdmin: false }
    getExpenseLists.mockResolvedValue([])
    renderExpenseLists(memberGroup)

    expect(await screen.findByText("Keine offenen Listen")).toBeTruthy()
    expect(
      screen.queryByRole("textbox", {
        name: "Name der neuen Ausgabenliste",
      })
    ).toBeNull()
  })

  it("keeps archived lists readable and hides list creation", async () => {
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists({
      ...group,
      archivedAt: "2026-10-26T12:00:00.000Z",
    })

    expect(
      await screen.findByText(/archiviert und kann nur noch gelesen/i)
    ).toBeTruthy()
    expect(
      await screen.findByRole("heading", { name: "Wocheneinkauf" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", {
        name: "Neue Ausgabenliste hinzufügen",
      })
    ).toBeNull()
  })

  it("shows database errors when list creation fails", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValue([])
    createExpenseList.mockRejectedValue({
      message: "Nur Gruppen-Admins dürfen Listen erstellen.",
    })
    renderExpenseLists()

    await user.click(
      screen.getByRole("button", { name: "Neue Ausgabenliste hinzufügen" })
    )
    await user.type(
      screen.getByRole("textbox", { name: "Name der neuen Ausgabenliste" }),
      "Urlaub"
    )
    await user.click(screen.getByRole("button", { name: "Erstellen" }))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Nur Gruppen-Admins dürfen Listen erstellen."
    )
  })

  it("shows the filter, open-list title, and add button in one row", () => {
    getExpenseLists.mockResolvedValue([])
    renderExpenseLists()

    expect(
      screen.getByRole("checkbox", { name: "Erledigte anzeigen" })
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Offene Listen" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Neue Ausgabenliste hinzufügen" })
    ).toBeTruthy()
  })

  it("opens list creation in a dialog without inserting a form into the list", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists()

    await screen.findByRole("heading", { name: "Wocheneinkauf" })
    await user.click(
      screen.getByRole("button", { name: "Neue Ausgabenliste hinzufügen" })
    )

    expect(
      screen.getByRole("dialog", { name: "Neue Ausgabenliste" })
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Wocheneinkauf" })).toBeTruthy()
  })
})
