import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { Group, GroupMember } from "@/types/group"
import { GroupAdmin } from "./GroupAdmin"

vi.mock("@/components/contexts/GroupOverviewContext", () => ({
  useGroupOverview: vi.fn(),
}))

const group: Group = {
  id: "g1",
  name: "WG",
  sortNr: 0,
  memberCount: 1,
  currentUserIsAdmin: true,
  archivedAt: null,
}

const member: GroupMember = {
  id: "m1",
  userId: "u1",
  displayName: "Anna",
  email: "anna@example.com",
  role: "admin",
  membershipStatus: "active",
  canCreateItems: true,
  canEditItems: true,
  canDeleteItems: true,
  canEditSplits: true,
  canCloseLists: true,
}

const addGroupMember = vi.fn()
const setGroupSplitDefault = vi.fn()
const archiveGroup = vi.fn()

beforeEach(() => {
  vi.mocked(useGroupOverview).mockReturnValue({
    groups: [group],
    loadError: null,
    getGroupMembers: vi.fn().mockResolvedValue([member]),
    getGroupSplitDefault: vi.fn().mockResolvedValue({ mode: "equal" }),
    getMyContacts: vi
      .fn()
      .mockResolvedValue([
        { id: "c1", displayName: "Ben", email: "ben@example.com" },
      ]),
    addGroupMember,
    setGroupSplitDefault,
    archiveGroup,
    refreshGroups: vi.fn().mockResolvedValue(undefined),
  } as never)
  addGroupMember.mockResolvedValue(undefined)
  setGroupSplitDefault.mockResolvedValue(undefined)
  archiveGroup.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("GroupAdmin Controls", () => {
  it("öffnet die shadcn-Optionsliste und speichert eine Auswahl", async () => {
    const user = userEvent.setup()
    render(<GroupAdmin group={group} onBack={vi.fn()} />)
    await screen.findByText("Anna")
    await screen.findByText("Gleichmäßig auf alle Mitglieder")

    await user.click(
      screen.getByRole("combobox", { name: "Standard-Aufteilungsmodus" })
    )
    expect(await screen.findByRole("listbox")).toBeTruthy()
    await user.click(await screen.findByRole("option", { name: "Prozentual" }))
    expect((screen.getByLabelText("Anna") as HTMLInputElement).value).toBe(
      "100,00"
    )
    await user.click(screen.getByRole("button", { name: "Standard speichern" }))
    expect(setGroupSplitDefault).toHaveBeenCalledWith("g1", {
      mode: "percentage",
      shares: [{ memberId: "m1", basisPoints: 10000 }],
    })
  })

  it("übernimmt Kontaktvorschläge per Tastatur und fügt den Kontakt hinzu", async () => {
    const user = userEvent.setup()
    render(<GroupAdmin group={group} onBack={vi.fn()} />)
    await screen.findByText("Anna")

    const input = screen.getByRole("combobox", {
      name: "Name oder Freundesliste durchsuchen",
    })
    await user.type(input, "Be")
    expect(await screen.findByRole("option", { name: /Ben/ })).toBeTruthy()
    await user.keyboard("{ArrowDown}{Enter}")

    await waitFor(() => {
      expect(
        (screen.getByLabelText("E-Mail-Adresse") as HTMLInputElement).value
      ).toBe("ben@example.com")
    })
    expect((input as HTMLInputElement).value).toBe("Ben")
    await user.click(screen.getByRole("button", { name: "Person hinzufügen" }))
    await waitFor(() => expect(addGroupMember).toHaveBeenCalledWith("g1", "c1"))
  })

  it("zeigt Kontaktvorschläge auch bei Suche nach E-Mail", async () => {
    const user = userEvent.setup()
    render(<GroupAdmin group={group} onBack={vi.fn()} />)
    await screen.findByText("Anna")

    await user.type(screen.getByLabelText("E-Mail-Adresse"), "ben@")
    await user.click(await screen.findByRole("option", { name: /Ben/ }))
    expect(
      (
        screen.getByLabelText(
          "Name oder Freundesliste durchsuchen"
        ) as HTMLInputElement
      ).value
    ).toBe("Ben")
    expect(
      (screen.getByLabelText("E-Mail-Adresse") as HTMLInputElement).value
    ).toBe("ben@example.com")
  })

  it("archiviert erst nach Bestätigung und nicht nach Abbruch", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<GroupAdmin group={group} onBack={onBack} />)
    await screen.findByText("Anna")

    await user.click(screen.getByRole("button", { name: "Gruppe archivieren" }))
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "sechs Monate"
    )
    await user.click(screen.getByRole("button", { name: "Abbrechen" }))
    expect(archiveGroup).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Gruppe archivieren" }))
    await user.click(screen.getByRole("button", { name: "Bestätigen" }))
    await waitFor(() => expect(archiveGroup).toHaveBeenCalledWith("g1"))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
  })

  it("lädt Mitglieder nach dem Entfernen neu und zeigt Legacy-Mitglieder weiter an", async () => {
    const legacyMember: GroupMember = {
      ...member,
      id: "m-legacy",
      userId: null,
      displayName: "Kind",
      email: null,
      role: "member",
      membershipStatus: "legacy",
    }
    const getGroupMembers = vi
      .fn()
      .mockResolvedValueOnce([member, legacyMember])
      .mockResolvedValueOnce([legacyMember])
    const removeGroupMember = vi.fn().mockResolvedValue(undefined)
    const refreshGroups = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useGroupOverview).mockReturnValue({
      groups: [group],
      loadError: null,
      getGroupMembers,
      getGroupSplitDefault: vi.fn().mockResolvedValue({ mode: "equal" }),
      getMyContacts: vi.fn().mockResolvedValue([]),
      addGroupMember,
      setGroupSplitDefault,
      archiveGroup,
      removeGroupMember,
      refreshGroups,
    } as never)

    const user = userEvent.setup()
    render(<GroupAdmin group={group} onBack={vi.fn()} />)
    await screen.findByText("Kind")

    await user.click(screen.getByRole("button", { name: "Löschen aktivieren" }))
    await user.click(
      screen.getByRole("button", { name: "Anna aus Gruppe entfernen" })
    )
    await user.click(screen.getByRole("button", { name: "Bestätigen" }))

    await waitFor(() => expect(removeGroupMember).toHaveBeenCalledWith("m1"))
    await waitFor(() => expect(getGroupMembers).toHaveBeenCalledTimes(2))
    expect(refreshGroups).toHaveBeenCalled()
    expect(screen.queryByText("Anna")).toBeNull()
    expect(screen.getByText("Kind")).toBeTruthy()
  })

  it("zeigt Datenbankfehler bei nicht umwandelbaren Positionen an", async () => {
    const removeGroupMember = vi.fn().mockRejectedValue({
      message: "Cannot convert a negative item or an overfilled receipt.",
    })
    vi.mocked(useGroupOverview).mockReturnValue({
      groups: [group],
      loadError: null,
      getGroupMembers: vi.fn().mockResolvedValue([member]),
      getGroupSplitDefault: vi.fn().mockResolvedValue({ mode: "equal" }),
      getMyContacts: vi.fn().mockResolvedValue([]),
      removeGroupMember,
      refreshGroups: vi.fn(),
    } as never)

    const user = userEvent.setup()
    render(<GroupAdmin group={group} onBack={vi.fn()} />)
    await screen.findByText("Anna")
    await user.click(screen.getByRole("button", { name: "Löschen aktivieren" }))
    await user.click(
      screen.getByRole("button", { name: "Anna aus Gruppe entfernen" })
    )
    await user.click(screen.getByRole("button", { name: "Bestätigen" }))
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Eine betroffene Position ist negativ"
    )
  })

  it("passt bei zwei Personen den Prozentwert des anderen automatisch an und deaktiviert Speichern bei Abweichung", async () => {
    const member2: GroupMember = {
      ...member,
      id: "m2",
      displayName: "Ben",
      email: "ben@example.com",
    }
    vi.mocked(useGroupOverview).mockReturnValue({
      groups: [group],
      loadError: null,
      getGroupMembers: vi.fn().mockResolvedValue([member, member2]),
      getGroupSplitDefault: vi.fn().mockResolvedValue({ mode: "equal" }),
      getMyContacts: vi.fn().mockResolvedValue([]),
      addGroupMember,
      setGroupSplitDefault,
      archiveGroup,
      refreshGroups: vi.fn().mockResolvedValue(undefined),
    } as never)

    const user = userEvent.setup()
    render(<GroupAdmin group={group} onBack={vi.fn()} />)
    await screen.findByText("Anna")
    await screen.findByText("Ben")
    await screen.findByText("Gleichmäßig auf alle Mitglieder")

    await user.click(
      screen.getByRole("combobox", { name: "Standard-Aufteilungsmodus" })
    )
    expect(await screen.findByRole("listbox")).toBeTruthy()
    await user.click(await screen.findByRole("option", { name: "Prozentual" }))

    const annaInput = screen.getByLabelText("Anna") as HTMLInputElement
    const benInput = screen.getByLabelText("Ben") as HTMLInputElement

    expect(annaInput.value).toBe("50,00")
    expect(benInput.value).toBe("50,00")

    // Anna auf 60 ändern -> Ben muss automatisch auf 40,00 springen
    await user.clear(annaInput)
    await user.type(annaInput, "60")
    expect(benInput.value).toBe("40,00")

    const saveButton = screen.getByRole("button", {
      name: "Standard speichern",
    }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)

    // Anna leeren -> Summe ungültig -> Speichern deaktiviert
    await user.clear(annaInput)
    expect(saveButton.disabled).toBe(true)

    // Anna auf 70 eingeben -> Ben springt auf 30,00
    await user.type(annaInput, "70")
    expect(benInput.value).toBe("30,00")
    expect(saveButton.disabled).toBe(false)

    await user.click(saveButton)
    expect(setGroupSplitDefault).toHaveBeenCalledWith("g1", {
      mode: "percentage",
      shares: [
        { memberId: "m1", basisPoints: 7000 },
        { memberId: "m2", basisPoints: 3000 },
      ],
    })
  })
})
