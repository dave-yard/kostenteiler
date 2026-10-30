import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAuth } from "@/components/contexts/AuthContext"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
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

describe("GroupOverview Navigation", () => {
  it("öffnet Gruppe, dann Liste und geht zurück", async () => {
    const user = userEvent.setup()
    setupMocks()

    render(<GroupOverview />)

    await user.click(screen.getByRole("button", { name: "WG Berlin" }))
    await user.click(await screen.findByRole("button", { name: /Urlaub/ }))

    expect(screen.getByText("Noch keine Positionen")).toBeTruthy()

    await user.click(
      screen.getByRole("button", { name: /Zu den Ausgabenlisten/ })
    )
    expect(await screen.findByRole("button", { name: /Urlaub/ })).toBeTruthy()
  })

  it("behält den Filter „Erledigte anzeigen“ nach der Rückkehr aus der Detailansicht", async () => {
    const user = userEvent.setup()
    setupMocks()

    render(<GroupOverview />)

    await user.click(screen.getByRole("button", { name: "WG Berlin" }))
    await user.click(
      await screen.findByRole("checkbox", { name: "Erledigte anzeigen" })
    )
    await user.click(await screen.findByRole("button", { name: /Urlaub/ }))
    await user.click(
      screen.getByRole("button", { name: /Zu den Ausgabenlisten/ })
    )

    const checkbox = await screen.findByRole("checkbox", {
      name: "Erledigte anzeigen",
    })
    expect(checkbox.getAttribute("aria-checked")).toBe("true")
  })

  it("platziert den Bereich „Neue Gruppe erstellen“ im Desktop-Modus oben rechts", () => {
    setupMocks()

    render(<GroupOverview />)

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
