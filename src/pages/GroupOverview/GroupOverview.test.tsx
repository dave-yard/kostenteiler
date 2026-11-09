import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { useAuth } from "@/components/contexts/AuthContext"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { ExpenseListsPage } from "@/pages/ExpenseLists/ExpenseListsPage"
import { GroupOverview } from "./GroupOverview"

vi.mock("@/components/contexts/AuthContext", () => ({ useAuth: vi.fn() }))
vi.mock("@/components/contexts/ExpenseListContext", () => ({
  useExpenseLists: vi.fn(),
}))
vi.mock("@/components/contexts/GroupOverviewContext", () => ({
  useGroupOverview: vi.fn(),
}))

afterEach(cleanup)

function setupMocks() {
  vi.mocked(useAuth).mockReturnValue({
    session: { user: { email: "a@b.de" } },
    signOut: vi.fn(),
  } as never)
  vi.mocked(useGroupOverview).mockReturnValue({
    groups: [
      {
        id: "g1",
        name: "WG Berlin",
        sortNr: 0,
        memberCount: 2,
        currentUserIsAdmin: false,
        archivedAt: null,
      },
    ],
    isLoading: false,
    loadError: null,
    refreshGroups: vi.fn(),
    createGroup: vi.fn(),
    saveGroupOrder: vi.fn(),
  } as never)
  vi.mocked(useExpenseLists).mockReturnValue({
    getExpenseLists: vi.fn().mockResolvedValue([
      {
        id: "l1",
        groupId: "g1",
        name: "Urlaub",
        status: "open",
        createdAt: "2026-10-26T10:00:00.000Z",
        completedAt: null,
        paidAt: null,
      },
    ]),
    canCloseExpenseLists: vi.fn().mockResolvedValue(false),
    getExpenseItems: vi.fn().mockResolvedValue([]),
    getExpenseListSplitRules: vi.fn().mockResolvedValue({}),
    getItemAccess: vi.fn().mockResolvedValue({
      members: [],
      currentMemberId: null,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    }),
  } as never)
}

function renderRoutes(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<GroupOverview />} path="/" />
        <Route element={<ExpenseListsPage />} path="/groups/:groupId" />
      </Routes>
    </MemoryRouter>
  )
}

describe("GroupOverview Navigation", () => {
  it("navigates from the group overview to that group's lists route", async () => {
    const user = userEvent.setup()
    setupMocks()

    renderRoutes()

    await user.click(screen.getByRole("button", { name: "WG Berlin" }))

    expect(await screen.findByRole("button", { name: /Urlaub/ })).toBeTruthy()
  })

  it("toggles the completed-list filter on the group's lists route", async () => {
    const user = userEvent.setup()
    setupMocks()

    renderRoutes("/groups/g1")
    const checkbox = await screen.findByRole("checkbox", {
      name: "Erledigte anzeigen",
    })
    await user.click(checkbox)

    expect(checkbox.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByRole("heading", { name: "Alle Listen" })).toBeTruthy()
  })

  it("platziert den Bereich „Neue Gruppe erstellen“ im Desktop-Modus oben rechts", () => {
    setupMocks()

    renderRoutes()

    const createHeading = screen.getByRole("heading", {
      name: "Neue Gruppe erstellen",
    })
    const createSection = createHeading.closest("section")
    expect(createSection).not.toBeNull()
    expect(createSection?.className).toContain("md:col-start-2")
    expect(createSection?.className).toContain("md:row-start-1")

    const input = screen.getByRole("textbox", { name: "Gruppenname" })
    expect(input).toBeTruthy()
    const submitBtn = screen.getByRole("button", { name: "Erstellen" })
    expect(submitBtn).toBeTruthy()
  })
})
