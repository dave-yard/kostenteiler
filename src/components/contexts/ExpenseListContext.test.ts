import { describe, expect, it } from "vitest"
import type { GroupMember } from "@/types/group"
import { resolveExpenseListMembers } from "./ExpenseListContext"

const currentMember: GroupMember = {
  id: "legacy-1",
  userId: null,
  displayName: "Neuer Legacy-Name",
  email: null,
  role: "member",
  membershipStatus: "legacy",
  canCreateItems: false,
  canEditItems: false,
  canDeleteItems: false,
  canEditSplits: false,
  canCloseLists: false,
}

describe("resolveExpenseListMembers", () => {
  it("keeps legacy members in open-list member data", () => {
    expect(resolveExpenseListMembers([currentMember], null)).toEqual([
      currentMember,
    ])
  })

  it("uses completed-list snapshots for legacy and removed members", () => {
    const resolved = resolveExpenseListMembers(
      [
        currentMember,
        { ...currentMember, id: "removed-2", displayName: "Veraltet" },
      ],
      {
        "legacy-1": "Name beim Abschluss",
        "removed-1": "Entfernt beim Abschluss",
        "removed-2": "Snapshot des Entfernten",
      }
    )

    expect(resolved.map((member) => member.id)).toEqual([
      "legacy-1",
      "removed-1",
      "removed-2",
    ])
    expect(resolved.map((member) => member.displayName)).toEqual([
      "Name beim Abschluss",
      "Entfernt beim Abschluss",
      "Snapshot des Entfernten",
    ])
    expect(resolved[0]).toMatchObject({ membershipStatus: "legacy" })
    expect(resolved[1]).toMatchObject({ membershipStatus: "removed" })
  })
})
