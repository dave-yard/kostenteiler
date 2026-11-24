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
const canCloseExpenseLists = vi.fn()
const updateExpenseListType = vi.fn()
const processRecurringLists = vi.fn().mockResolvedValue({
  generatedListsCount: 0,
  autoClosedListsCount: 0,
  generatedListIds: [],
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  getExpenseLists.mockReset()
  createExpenseList.mockReset()
  completeExpenseList.mockReset()
  canCloseExpenseLists.mockReset()
  updateExpenseListType.mockReset()
  processRecurringLists.mockReset()
})

function ExpenseListsHarness({ group: selectedGroup }: { group: Group }) {
  const [includePaid, setIncludePaid] = useState(false)

  return (
    <ExpenseLists
      group={selectedGroup}
      includePaid={includePaid}
      onBack={vi.fn()}
      onIncludePaidChange={setIncludePaid}
      onOpenList={vi.fn()}
    />
  )
}

function renderExpenseLists(selectedGroup = group) {
  canCloseExpenseLists.mockResolvedValue(selectedGroup.currentUserIsAdmin)
  vi.mocked(useExpenseLists).mockReturnValue({
    getExpenseLists,
    createExpenseList,
    updateExpenseListType,
    processRecurringLists,
    completeExpenseList,
    canCloseExpenseLists,
  } as never)

  return render(<ExpenseListsHarness group={selectedGroup} />)
}

describe("ExpenseLists", () => {
  it("loads open and completed lists but hides paid lists by default", async () => {
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists()

    expect(
      await screen.findByRole("heading", { name: "Wocheneinkauf" })
    ).toBeTruthy()
    expect(getExpenseLists).toHaveBeenCalledWith("group-1", false)
    expect(screen.queryByText("Urlaub")).toBeNull()
  })

  it("loads paid lists when the filter is enabled", async () => {
    const user = userEvent.setup()
    getExpenseLists
      .mockResolvedValueOnce([openList])
      .mockResolvedValueOnce([openList, paidList])
    renderExpenseLists()

    await user.click(
      screen.getByRole("checkbox", { name: "Bezahlte anzeigen" })
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

  it("reloads open lists when group member data changes", async () => {
    let groupDataRevision = 0
    const updatedList = { ...openList, name: "Wocheneinkauf aktualisiert" }
    getExpenseLists
      .mockResolvedValueOnce([openList])
      .mockResolvedValueOnce([updatedList])
    canCloseExpenseLists.mockResolvedValue(true)
    vi.mocked(useExpenseLists).mockImplementation(
      () =>
        ({
          groupDataRevision,
          getExpenseLists,
          processRecurringLists,
          completeExpenseList,
          canCloseExpenseLists,
        }) as never
    )
    const view = render(<ExpenseListsHarness group={group} />)

    expect(
      await screen.findByRole("heading", { name: "Wocheneinkauf" })
    ).toBeTruthy()

    groupDataRevision += 1
    view.rerender(<ExpenseListsHarness group={group} />)

    expect(
      await screen.findByRole("heading", {
        name: "Wocheneinkauf aktualisiert",
      })
    ).toBeTruthy()
    expect(getExpenseLists).toHaveBeenCalledTimes(2)
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

  it("allows admins to create a recurring expense list with schedule", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    createExpenseList.mockResolvedValue("list-recurring")
    renderExpenseLists()

    await user.click(
      screen.getByRole("button", { name: "Neue Ausgabenliste hinzufügen" })
    )
    await user.type(
      screen.getByRole("textbox", { name: "Name der neuen Ausgabenliste" }),
      "Miete"
    )

    // Switch to recurring list
    await user.click(screen.getByRole("combobox", { name: "Listentyp" }))
    await user.click(
      await screen.findByRole("option", { name: /Wiederkehrende Liste/ })
    )

    // Set day of month
    const dayInput = screen.getByLabelText("Stichtag (Kalendertag 1–31)")
    await user.clear(dayInput)
    await user.type(dayInput, "5")

    // Check auto-close
    await user.click(
      screen.getByLabelText("Am Periodenende automatisch abrechnen")
    )

    await user.click(screen.getByRole("button", { name: "Erstellen" }))

    expect(createExpenseList).toHaveBeenCalledWith("group-1", {
      name: "Miete",
      listType: "recurring",
      interval: "monthly",
      dayOfMonth: 5,
      autoClose: true,
    })
  })

  it("completes an open list after confirmation and reloads", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValueOnce([openList]).mockResolvedValueOnce([])
    completeExpenseList.mockResolvedValue(undefined)
    renderExpenseLists()

    await user.click(await screen.findByRole("button", { name: "Abschließen" }))
    await user.click(screen.getByRole("button", { name: "Bestätigen" }))

    expect(completeExpenseList).toHaveBeenCalledWith("list-open")
    expect((await screen.findByRole("status")).textContent).toContain(
      "Die Ausgabenliste wurde abgeschlossen."
    )
    expect(getExpenseLists).toHaveBeenCalledTimes(2)
  })

  it("does nothing when the confirmation is declined", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists()

    await user.click(await screen.findByRole("button", { name: "Abschließen" }))
    await user.click(screen.getByRole("button", { name: "Abbrechen" }))

    expect(completeExpenseList).not.toHaveBeenCalled()
  })

  it("offers no direct paid action for completed or paid lists", async () => {
    const completedList: ExpenseList = {
      ...openList,
      id: "list-completed",
      name: "Erledigt",
      status: "completed",
      completedAt: "2026-10-26T11:00:00.000Z",
    }
    getExpenseLists.mockResolvedValue([completedList, paidList])
    renderExpenseLists()

    await screen.findByRole("heading", { name: "Erledigt" })
    expect(
      screen.queryByRole("button", { name: "Als bezahlt markieren" })
    ).toBeNull()
  })

  it("shows status errors as an error toast", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValue([openList])
    completeExpenseList.mockRejectedValue({
      message: "You are not allowed to complete this expense list.",
    })
    renderExpenseLists()

    await user.click(await screen.findByRole("button", { name: "Abschließen" }))
    await user.click(screen.getByRole("button", { name: "Bestätigen" }))

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

    expect(
      await screen.findByText("Keine offenen oder abgeschlossenen Listen")
    ).toBeTruthy()
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
      screen.getByRole("checkbox", { name: "Bezahlte anzeigen" })
    ).toBeTruthy()
    expect(
      screen.getByRole("heading", {
        name: "Offene und abgeschlossene Listen",
      })
    ).toBeTruthy()
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
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("heading", { name: "Wocheneinkauf" })).toBeTruthy()
  })

  it("allows admins to convert list type to recurring and saves configuration", async () => {
    const user = userEvent.setup()
    getExpenseLists.mockResolvedValueOnce([openList]).mockResolvedValueOnce([])
    updateExpenseListType.mockResolvedValue(undefined)
    renderExpenseLists()

    await user.click(
      await screen.findByRole("button", {
        name: "Listentyp umwandeln: Wocheneinkauf",
      })
    )

    // Dialog opens with target type preset to recurring
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(screen.getByText(/Listentyp umwandeln/)).toBeTruthy()

    // Submit conversion
    await user.click(screen.getByRole("button", { name: "Typ umwandeln" }))

    expect(updateExpenseListType).toHaveBeenCalledWith("list-open", {
      listType: "recurring",
      interval: "monthly",
      dayOfMonth: expect.any(Number),
      autoClose: false,
    })
    expect(
      await screen.findByText("Der Listentyp wurde erfolgreich geändert.")
    ).toBeTruthy()
  })

  it("does not allow non-admins to convert list type", async () => {
    getExpenseLists.mockResolvedValue([openList])
    renderExpenseLists({ ...group, currentUserIsAdmin: false })

    await screen.findByRole("heading", { name: "Wocheneinkauf" })
    expect(
      screen.queryByRole("button", {
        name: "Listentyp umwandeln: Wocheneinkauf",
      })
    ).toBeNull()
  })
})
