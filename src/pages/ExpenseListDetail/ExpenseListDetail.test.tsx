import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { ExpenseListDetail } from "@/pages/ExpenseListDetail/ExpenseListDetail"
import type { ExpenseItem, ExpenseList, Group } from "@/types/group"

vi.mock("@/components/contexts/ExpenseListContext", () => ({
  useExpenseLists: vi.fn(),
}))

const group: Group = {
  id: "g1",
  name: "WG Berlin",
  sortNr: 0,
  memberCount: 2,
  currentUserIsAdmin: true,
  archivedAt: null,
}

const list: ExpenseList = {
  id: "l1",
  groupId: "g1",
  name: "Urlaub",
  status: "completed",
  createdAt: "2026-01-02T10:00:00Z",
  completedAt: "2026-01-05T10:00:00Z",
  paidAt: null,
}

const items: ExpenseItem[] = [
  {
    id: "i1",
    listId: "l1",
    name: "Socken",
    amountCents: 500,
    paidByMemberId: "m1",
    createdAt: "2026-01-03T10:00:00Z",
  },
  {
    id: "i2",
    listId: "l1",
    name: "Pizza",
    amountCents: 1250,
    paidByMemberId: "m2",
    createdAt: "2026-01-03T11:00:00Z",
  },
]

const getExpenseItems = vi.fn()
const getItemAccess = vi.fn()
const createExpenseItem = vi.fn()

function renderDetail(onBack = vi.fn(), currentList: ExpenseList = list) {
  vi.mocked(useExpenseLists).mockReturnValue({
    getExpenseItems,
    getItemAccess,
    createExpenseItem,
  } as never)

  return render(
    <ExpenseListDetail group={group} list={currentList} onBack={onBack} />
  )
}

afterEach(() => {
  cleanup()
  getExpenseItems.mockReset()
  getItemAccess.mockReset()
  createExpenseItem.mockReset()
})

function mockAccess() {
  getItemAccess.mockResolvedValue({
    members: [
      { id: "m1", displayName: "Anna" },
      { id: "m2", displayName: "Ben" },
    ],
    currentMemberId: "m1",
    canCreate: true,
    canEdit: true,
    canDelete: true,
  })
}

describe("ExpenseListDetail", () => {
  it("zeigt Liste, Status und leeren Zustand", async () => {
    getExpenseItems.mockResolvedValue([])
    mockAccess()
    renderDetail()

    expect(screen.getByRole("heading", { name: "Urlaub" })).toBeTruthy()
    expect(screen.getByText("WG Berlin")).toBeTruthy()
    expect(screen.getByText("Erledigt")).toBeTruthy()
    expect(await screen.findByText("Noch keine Positionen")).toBeTruthy()
    expect(getExpenseItems).toHaveBeenCalledWith("l1")
  })

  it("zeigt Positionen mit Zahler und Summe", async () => {
    getExpenseItems.mockResolvedValue(items)
    mockAccess()
    renderDetail()

    expect(await screen.findByText("Socken")).toBeTruthy()
    expect(screen.getByText("Bezahlt von Anna")).toBeTruthy()
    expect(screen.getByText("Bezahlt von Ben")).toBeTruthy()
    expect(screen.getByText(/5,00\s€/)).toBeTruthy()
    expect(screen.getByText(/12,50\s€/)).toBeTruthy()
    expect(screen.getByText(/17,50\s€/)).toBeTruthy()
  })

  it("zeigt einen Ladefehler und lädt erneut", async () => {
    const user = userEvent.setup()
    getExpenseItems
      .mockRejectedValueOnce({ message: "The expense list does not exist." })
      .mockResolvedValueOnce(items)
    mockAccess()
    renderDetail()

    expect(
      await screen.findByText("Die Ausgabenliste gibt es nicht mehr.")
    ).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }))

    expect(await screen.findByText("Socken")).toBeTruthy()
  })

  it("geht per Zurück-Button zurück", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    getExpenseItems.mockResolvedValue([])
    mockAccess()
    renderDetail(onBack)

    await user.click(
      screen.getByRole("button", { name: /Zu den Ausgabenlisten/ })
    )

    expect(onBack).toHaveBeenCalled()
    await screen.findByText("Noch keine Positionen")
  })

  it("zeigt den Plus-Button nur bei offener Liste", async () => {
    getExpenseItems.mockResolvedValue([])
    mockAccess()
    renderDetail()
    await screen.findByText("Noch keine Positionen")
    expect(
      screen.queryByRole("button", { name: "Position hinzufügen" })
    ).toBeNull()

    cleanup()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })
    expect(
      await screen.findByRole("button", { name: "Position hinzufügen" })
    ).toBeTruthy()
  })

  it("legt eine Position mit Betrag in Cent an", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue([])
    createExpenseItem.mockResolvedValue("i3")
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    await user.click(
      await screen.findByRole("button", { name: "Position hinzufügen" })
    )
    await user.type(screen.getByLabelText("Bezeichnung"), "  Brot ")
    await user.type(screen.getByLabelText("Betrag in Euro"), "1.234,50")
    await user.selectOptions(screen.getByLabelText("Bezahlt von"), "m2")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    expect(createExpenseItem).toHaveBeenCalledWith("l1", {
      name: "Brot",
      amountCents: 123450,
      paidByMemberId: "m2",
    })
    expect(
      await screen.findByText("Die Position wurde hinzugefügt.")
    ).toBeTruthy()
    expect(getExpenseItems).toHaveBeenCalledTimes(2)
  })

  it("meldet einen ungültigen Betrag, ohne zu speichern", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue([])
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    await user.click(
      await screen.findByRole("button", { name: "Position hinzufügen" })
    )
    await user.type(screen.getByLabelText("Bezeichnung"), "Brot")
    await user.type(screen.getByLabelText("Betrag in Euro"), "abc")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(createExpenseItem).not.toHaveBeenCalled()
  })
})
