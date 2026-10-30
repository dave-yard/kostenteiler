import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import {
  ExpenseListDetail,
  todayIsoDate,
  germanToIsoDateTime,
} from "@/pages/ExpenseListDetail/ExpenseListDetail"
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
    isReceipt: false,
    parentItemId: null,
    itemDate: "2026-01-03",
    createdAt: "2026-01-03T10:00:00Z",
  },
  {
    id: "i2",
    listId: "l1",
    name: "Pizza",
    amountCents: 1250,
    paidByMemberId: "m2",
    isReceipt: false,
    parentItemId: null,
    itemDate: "2026-01-03",
    createdAt: "2026-01-03T11:00:00Z",
  },
]

const getExpenseItems = vi.fn()
const getExpenseItemSplitRule = vi.fn()
const getExpenseListSplitRules = vi.fn()
const getItemAccess = vi.fn()
const completeExpenseList = vi.fn()
const createExpenseItem = vi.fn()
const updateExpenseItem = vi.fn()
const deleteExpenseItem = vi.fn()

function renderDetail(
  onBack = vi.fn(),
  currentList: ExpenseList = list,
  onListChange = vi.fn()
) {
  vi.mocked(useExpenseLists).mockReturnValue({
    getExpenseItems,
    getExpenseItemSplitRule,
    getExpenseListSplitRules,
    getItemAccess,
    completeExpenseList,
    createExpenseItem,
    updateExpenseItem,
    deleteExpenseItem,
  } as never)

  return render(
    <ExpenseListDetail
      group={group}
      list={currentList}
      onBack={onBack}
      onListChange={onListChange}
    />
  )
}

beforeEach(() => {
  getExpenseListSplitRules.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  getExpenseItems.mockReset()
  getExpenseItemSplitRule.mockReset()
  getExpenseListSplitRules.mockReset()
  getItemAccess.mockReset()
  completeExpenseList.mockReset()
  createExpenseItem.mockReset()
  updateExpenseItem.mockReset()
  deleteExpenseItem.mockReset()
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
    canEditSplits: true,
    canDelete: true,
    canCloseLists: true,
    groupDefaultSplitRule: { mode: "equal" },
  })
}

describe("ExpenseListDetail", () => {
  it("zeigt die Abrechnung ein- und ausgeklappt und schließt die Liste ab", async () => {
    const user = userEvent.setup()
    const onListChange = vi.fn()
    getExpenseItems.mockResolvedValue(items)
    completeExpenseList.mockResolvedValue(undefined)
    vi.spyOn(window, "confirm").mockReturnValue(true)
    mockAccess()
    renderDetail(
      vi.fn(),
      { ...list, status: "open", completedAt: null },
      onListChange
    )

    const toggle = await screen.findByRole("button", {
      name: /Ben bekommt am meisten zurück: 3,75\s€/,
    })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "Abschluss" })).toBeNull()

    await user.click(toggle)
    expect(
      screen.getByRole("list", { name: "Erstattungen" }).textContent
    ).toMatch(/Ben bekommt 3,75\s€ von Anna zurück/)

    await user.click(screen.getByRole("button", { name: "Abschluss" }))

    expect(completeExpenseList).toHaveBeenCalledWith("l1")
    expect(onListChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "l1", status: "completed" })
    )
  })

  it("zeigt den Abschluss-Button ohne Berechtigung nicht", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue(items)
    getItemAccess.mockResolvedValue({
      members: [
        { id: "m1", displayName: "Anna" },
        { id: "m2", displayName: "Ben" },
      ],
      currentMemberId: "m1",
      canCreate: false,
      canEdit: false,
      canEditSplits: false,
      canDelete: false,
      canCloseLists: false,
      groupDefaultSplitRule: { mode: "equal" },
    })
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    await user.click(
      await screen.findByRole("button", { name: /bekommt am meisten/ })
    )

    expect(screen.queryByRole("button", { name: "Abschluss" })).toBeNull()
  })

  it("meldet ausgeglichene Salden", async () => {
    getExpenseItems.mockResolvedValue([items[0]])
    getExpenseListSplitRules.mockResolvedValue({
      i1: { mode: "complete", memberId: "m1" },
    })
    mockAccess()
    renderDetail()

    expect(
      await screen.findByRole("button", { name: "Alles ausgeglichen" })
    ).toBeTruthy()
  })

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

  it("markiert den passenden Text bei der Suche", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue(items)
    mockAccess()
    renderDetail()

    await user.click(
      await screen.findByRole("button", {
        name: "Ansichts- und Sortieroptionen",
      })
    )
    await user.type(
      screen.getByRole("textbox", { name: "Positionen durchsuchen" }),
      "sock"
    )

    expect(screen.getByText("Sock", { selector: "mark" }).textContent).toBe(
      "Sock"
    )
    expect(screen.queryByText("Pizza")).toBeNull()
  })

  it("sortiert Hauptpositionen nach Belegdatum und Erfassungszeit", async () => {
    const user = userEvent.setup()
    const testItems: ExpenseItem[] = [
      {
        id: "older-date-newer-created",
        listId: "l1",
        name: "Älterer Beleg später erfasst",
        amountCents: 500,
        paidByMemberId: "m1",
        isReceipt: false,
        parentItemId: null,
        itemDate: "2026-01-01",
        createdAt: "2026-01-05T12:00:00Z",
      },
      {
        id: "newer-date-older-created",
        listId: "l1",
        name: "Neuerer Beleg früher erfasst",
        amountCents: 800,
        paidByMemberId: "m2",
        isReceipt: false,
        parentItemId: null,
        itemDate: "2026-01-04",
        createdAt: "2026-01-05T08:00:00Z",
      },
    ]
    getExpenseItems.mockResolvedValue(testItems)
    mockAccess()
    renderDetail()

    // Standard: Belegdatum -> "Neuerer Beleg" (04.01.) vor "Älterer Beleg" (01.01.)
    const firstBeforeToggle = await screen.findByText(
      "Neuerer Beleg früher erfasst"
    )
    const secondBeforeToggle = screen.getByText("Älterer Beleg später erfasst")
    expect(
      firstBeforeToggle.compareDocumentPosition(secondBeforeToggle) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    // Umschalten auf Erfassungszeit
    await user.click(
      screen.getByRole("button", { name: "Ansichts- und Sortieroptionen" })
    )
    await user.click(screen.getByRole("button", { name: /Belegdatum/ }))

    // Jetzt Erfassungszeit: 12:00 vor 08:00 -> "Älterer Beleg später erfasst" kommt zuerst
    expect(
      screen
        .getByText("Älterer Beleg später erfasst")
        .compareDocumentPosition(
          screen.getByText("Neuerer Beleg früher erfasst")
        ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("sortiert Unterpositionen gemäß der Zuweisung vor Rest", async () => {
    const user = userEvent.setup()
    const receipt: ExpenseItem = {
      id: "bon1",
      listId: "l1",
      name: "Supermarkt",
      amountCents: 3000,
      paidByMemberId: "m1",
      isReceipt: true,
      parentItemId: null,
      itemDate: "2026-01-03T00:00:00.000Z",
      createdAt: "2026-01-03T10:00:00Z",
    }
    const childShared: ExpenseItem = {
      id: "c1",
      listId: "l1",
      name: "Geteiltes Brot",
      amountCents: 500,
      paidByMemberId: "m1",
      isReceipt: false,
      parentItemId: "bon1",
      itemDate: "2026-01-03T00:00:00.000Z",
      createdAt: "2026-01-03T10:00:00Z",
    }
    const childAssigned: ExpenseItem = {
      id: "c2",
      listId: "l1",
      name: "Annas Schokolade",
      amountCents: 300,
      paidByMemberId: "m1",
      isReceipt: false,
      parentItemId: "bon1",
      itemDate: "2026-01-03T03:00:00.000Z",
      createdAt: "2026-01-03T00:00:00Z",
    }
    getExpenseItems.mockResolvedValue([receipt, childShared, childAssigned])
    getExpenseListSplitRules.mockResolvedValue({
      c1: { mode: "equal" },
      c2: { mode: "complete", memberId: "m1" },
    })
    mockAccess()
    renderDetail()

    await user.click(
      await screen.findByRole("button", {
        name: /Unterpositionen von Supermarkt anzeigen/,
      })
    )

    // c2 ist komplett zugewiesen ("Komplett") und muss VOR c1 ("Geteilt") stehen
    const assignedItem = screen.getByText("Annas Schokolade")
    const sharedItem = screen.getByText("Geteiltes Brot")
    expect(
      assignedItem.compareDocumentPosition(sharedItem) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
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
    expect(
      (await screen.findByRole("status")).textContent?.includes(
        "Gruppenverteilung"
      )
    ).toBeTruthy()
    expect(
      screen
        .getByRole("status")
        .textContent?.includes(
          "Gruppenstandard: Gleichmäßig auf alle Gruppenmitglieder"
        )
    ).toBeTruthy()
    expect(
      screen
        .getByLabelText("Bezeichnung")
        .compareDocumentPosition(screen.getByLabelText("Betrag in €")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    await user.type(screen.getByLabelText("Bezeichnung"), "  Brot ")
    await user.type(screen.getByLabelText("Betrag in €"), "1.234,50")

    await user.selectOptions(screen.getByLabelText("Bezahlt von"), "m2")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    const todayString = new Date().toISOString().slice(0, 10) // Liefert z. B. "2026-10-30"

    expect(createExpenseItem).toHaveBeenCalledWith("l1", {
      name: "Brot",
      amountCents: 123450,
      paidByMemberId: "m2",
      splitRule: null,
      isReceipt: false,
      parentItemId: null,
      itemDate: `${todayString}T00:00:00.000Z`, //germanToIsoDateTime(todayIsoDate()),
    })
    expect(
      await screen.findByText("Die Position wurde hinzugefügt.")
    ).toBeTruthy()
    expect(getExpenseItems).toHaveBeenCalledTimes(2)
  })

  it("speichert eine benutzerdefinierte Prozentverteilung", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue([])
    createExpenseItem.mockResolvedValue("i3")
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    await user.click(
      await screen.findByRole("button", { name: "Position hinzufügen" })
    )
    await user.type(screen.getByLabelText("Bezeichnung"), "Brot")
    await user.type(screen.getByLabelText("Betrag in €"), "10,00")
    const splitMode = screen.getByLabelText("Aufteilungsmodus")
    await user.selectOptions(splitMode, "percentage")
    expect(
      screen
        .getByRole("status")
        .textContent?.includes("Individuelle Verteilung")
    ).toBeTruthy()
    await user.selectOptions(splitMode, "equal")
    expect(
      screen.getByRole("status").textContent?.includes("Gruppenverteilung")
    ).toBeTruthy()
    await user.selectOptions(splitMode, "percentage")
    await user.clear(screen.getByLabelText("Anna"))
    await user.type(screen.getByLabelText("Anna"), "100")
    await user.clear(screen.getByLabelText("Ben"))
    await user.type(screen.getByLabelText("Ben"), "0")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    expect(createExpenseItem).toHaveBeenCalledWith("l1", {
      name: "Brot",
      amountCents: 1000,
      paidByMemberId: "m1",
      isReceipt: false,
      parentItemId: null,
      itemDate: expect.any(String),
      splitRule: {
        mode: "percentage",
        shares: [
          { memberId: "m1", basisPoints: 10000 },
          { memberId: "m2", basisPoints: 0 },
        ],
      },
    })
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
    await user.type(screen.getByLabelText("Betrag in €"), "abc")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(createExpenseItem).not.toHaveBeenCalled()
  })

  it("bearbeitet eine Position mit bestehenden Werten", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue(items)
    getExpenseItemSplitRule.mockResolvedValue({ mode: "equal" })
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    await user.click(
      await screen.findByRole("button", { name: "Position bearbeiten: Socken" })
    )
    expect(
      (screen.getByLabelText("Bezeichnung") as HTMLInputElement).value
    ).toBe("Socken")
    expect(
      (screen.getByLabelText("Betrag in €") as HTMLInputElement).value
    ).toBe("5,00")
    expect(
      (screen.getByLabelText("Bezahlt von") as HTMLSelectElement).value
    ).toBe("m1")

    await user.clear(screen.getByLabelText("Bezeichnung"))
    await user.type(screen.getByLabelText("Bezeichnung"), "Brot")
    await user.clear(screen.getByLabelText("Betrag in €"))
    await user.type(screen.getByLabelText("Betrag in €"), "12.5")
    await user.click(screen.getByRole("button", { name: "Speichern" }))

    expect(updateExpenseItem).toHaveBeenCalledWith("i1", {
      name: "Brot",
      amountCents: 1250,
      paidByMemberId: "m1",
      splitRule: { mode: "equal" },
      isReceipt: false,
      itemDate: "2026-01-03T00:00:00.000Z",
    })
    expect(
      await screen.findByText("Die Position wurde aktualisiert.")
    ).toBeTruthy()
    expect(getExpenseItems).toHaveBeenCalledTimes(2)
  })

  it("legt einen Bon an und klappt seine Unterpositionen auf", async () => {
    const user = userEvent.setup()
    const receipt = {
      ...items[0],
      id: "bon",
      name: "REWE",
      amountCents: 5000,
      isReceipt: true,
    }
    const child = {
      ...items[1],
      id: "kind",
      name: "Milch",
      amountCents: 250,
      parentItemId: "bon",
    }
    getExpenseItems.mockResolvedValue([receipt, child])
    createExpenseItem.mockResolvedValue("i9")
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    expect(await screen.findByText("REWE")).toBeTruthy()
    expect(screen.queryByText("Milch")).toBeNull()
    await user.click(
      screen.getByRole("button", { name: /Unterpositionen von REWE anzeigen/ })
    )
    expect(screen.getByText("Milch")).toBeTruthy()

    await user.click(
      screen.getByRole("button", { name: "Unterposition hinzufügen" })
    )
    expect(screen.queryByLabelText("Art der Position")).toBeNull()
    await user.type(screen.getByLabelText("Bezeichnung"), "Brot")
    await user.type(screen.getByLabelText("Betrag in €"), "2")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    expect(createExpenseItem).toHaveBeenCalledWith(
      "l1",
      expect.objectContaining({
        name: "Brot",
        amountCents: 200,
        isReceipt: false,
        parentItemId: "bon",
      })
    )
  })

  it("wählt beim Anlegen zwischen Einzelposition und Bon", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue([])
    createExpenseItem.mockResolvedValue("i3")
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    await user.click(
      await screen.findByRole("button", { name: "Position hinzufügen" })
    )
    await user.selectOptions(
      screen.getByLabelText("Art der Position"),
      "receipt"
    )
    await user.type(screen.getByLabelText("Bezeichnung"), "REWE")
    await user.type(screen.getByLabelText("Betrag in €"), "50")
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }))

    expect(createExpenseItem).toHaveBeenCalledWith(
      "l1",
      expect.objectContaining({ isReceipt: true, parentItemId: null })
    )
  })

  it("löscht eine Position erst nach Bestätigung", async () => {
    const user = userEvent.setup()
    getExpenseItems.mockResolvedValue(items)
    deleteExpenseItem.mockResolvedValue(undefined)
    mockAccess()
    renderDetail(vi.fn(), { ...list, status: "open", completedAt: null })

    expect(
      screen.queryByRole("button", { name: /Position löschen/ })
    ).toBeNull()
    await user.click(
      await screen.findByRole("button", { name: "Löschen aktivieren" })
    )
    await user.click(
      await screen.findByRole("button", { name: "Position löschen: Socken" })
    )
    expect(screen.getByRole("alertdialog")).toBeTruthy()
    expect(deleteExpenseItem).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Löschen" }))

    expect(deleteExpenseItem).toHaveBeenCalledWith("i1")
    expect(await screen.findByText("Die Position wurde gelöscht.")).toBeTruthy()
    expect(getExpenseItems).toHaveBeenCalledTimes(2)
  })
})
