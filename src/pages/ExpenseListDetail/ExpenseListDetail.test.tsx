import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ExpenseListDetail } from "@/pages/ExpenseListDetail/ExpenseListDetail"
import type { ExpenseList, Group } from "@/types/group"

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
} as ExpenseList

describe("ExpenseListDetail", () => {
  afterEach(cleanup)

  it("zeigt Liste, Status und leere Positionen", () => {
    render(<ExpenseListDetail group={group} list={list} onBack={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "Urlaub" })).toBeTruthy()
    expect(screen.getByText("WG Berlin")).toBeTruthy()
    expect(screen.getByText("Erledigt")).toBeTruthy()
    expect(screen.getByText("Noch keine Positionen")).toBeTruthy()
  })

  it("geht per Zurück-Button zurück", async () => {
    const onBack = vi.fn()
    render(<ExpenseListDetail group={group} list={list} onBack={onBack} />)

    await userEvent.click(
      screen.getByRole("button", { name: /Zu den Ausgabenlisten/ })
    )

    expect(onBack).toHaveBeenCalled()
  })
})
