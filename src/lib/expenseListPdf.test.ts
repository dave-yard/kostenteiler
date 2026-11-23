import { describe, expect, it } from "vitest"
import {
  buildExpenseListPdfRows,
  formatSettlementCalculation,
} from "./expenseListPdf"
import { buildItemNodes } from "./itemHierarchy"
import type { ExpenseItem, GroupMember } from "@/types/group"

function member(id: string, displayName: string): GroupMember {
  return {
    id,
    displayName,
    userId: null,
    email: null,
    role: "member",
    membershipStatus: "active",
    canCreateItems: false,
    canEditItems: false,
    canDeleteItems: false,
    canEditSplits: false,
    canCloseLists: false,
  }
}

function item(
  values: Partial<ExpenseItem> &
    Pick<ExpenseItem, "id" | "name" | "amountCents" | "item_date">
): ExpenseItem {
  return {
    listId: "list",
    paidByMemberId: "anna",
    isReceipt: false,
    parentItemId: null,
    createdAt: "2026-01-01T12:00:00Z",
    ...values,
  }
}

const members = [member("anna", "Anna"), member("ben", "Ben")]

describe("buildExpenseListPdfRows", () => {
  it("zeigt die Saldo-Berechnung mit eindeutigen Vorzeichen", () => {
    expect(formatSettlementCalculation(1200, 850)).toBe(
      "12,00 € - 8,50 € = +3,50 €"
    )
    expect(formatSettlementCalculation(200, 700)).toBe(
      "2,00 € - 7,00 € = -5,00 €"
    )
    expect(formatSettlementCalculation(500, 500)).toBe(
      "5,00 € - 5,00 € = 0,00 €"
    )
  })

  it("bildet Hauptpositionen ab und sortiert das älteste Datum zuerst", () => {
    const nodes = buildItemNodes([
      item({
        id: "older",
        name: "Zelt",
        amountCents: 1000,
        item_date: "2026-01-01",
      }),
      item({
        id: "newer",
        name: "Brot",
        amountCents: 500,
        item_date: "2026-01-03",
      }),
    ])

    const rows = buildExpenseListPdfRows({
      nodes,
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })

    expect(rows.map((row) => row.id)).toEqual(["older", "newer"])
  })

  it("sortiert Hauptpositionen alphabetisch", () => {
    const nodes = buildItemNodes([
      item({
        id: "zelt",
        name: "Zelt",
        amountCents: 1000,
        item_date: "2026-01-01",
      }),
      item({
        id: "apfel",
        name: "apfel",
        amountCents: 500,
        item_date: "2026-01-03",
      }),
    ])

    const rows = buildExpenseListPdfRows({
      nodes,
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "alphabetical",
    })

    expect(rows.map((row) => row.name)).toEqual(["apfel", "Zelt"])
  })

  it("aggregiert Bon-Rest und Unterpositionen nach Mitgliederanteil", () => {
    const nodes = buildItemNodes([
      item({
        id: "receipt",
        name: "Supermarkt",
        amountCents: 1000,
        item_date: "2026-01-03",
        isReceipt: true,
      }),
      item({
        id: "child",
        name: "Kaffee",
        amountCents: 400,
        item_date: "2026-01-03",
        parentItemId: "receipt",
      }),
    ])

    const [row] = buildExpenseListPdfRows({
      nodes,
      members,
      rules: {
        child: { mode: "complete", memberId: "anna" },
      },
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })

    expect(row.id).toBe("receipt")
    expect(row.sharesByMemberId.get("anna")).toBe(700)
    expect(row.sharesByMemberId.get("ben")).toBe(300)
    expect(
      [...row.sharesByMemberId.values()].reduce((sum, value) => sum + value, 0)
    ).toBe(1000)
  })

  it("listet abweichend aufgeteilte Unterpositionen unter der Hauptposition auf", () => {
    const nodes = buildItemNodes([
      item({
        id: "receipt",
        name: "Supermarkt",
        amountCents: 1000,
        item_date: "2026-01-03",
        isReceipt: true,
      }),
      item({
        id: "child",
        name: "Kaffee Anna",
        amountCents: 400,
        item_date: "2026-01-03",
        parentItemId: "receipt",
      }),
    ])

    const rows = buildExpenseListPdfRows({
      nodes,
      members,
      rules: {
        child: { mode: "complete", memberId: "anna" },
      },
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })

    expect(rows.map((row) => row.id)).toEqual(["receipt", "child"])
    expect(rows[1]).toMatchObject({
      parentId: "receipt",
      includeInTotals: false,
    })
    expect(rows[1].sharesByMemberId.get("anna")).toBe(400)
    expect(rows[1].sharesByMemberId.get("ben")).toBe(0)
  })

  it("listet einen abweichenden Zahler bei gleicher Aufteilung auf", () => {
    const nodes = buildItemNodes([
      item({
        id: "receipt",
        name: "Supermarkt",
        amountCents: 1000,
        item_date: "2026-01-03",
        isReceipt: true,
      }),
      item({
        id: "child",
        name: "Brot",
        amountCents: 400,
        item_date: "2026-01-03",
        parentItemId: "receipt",
        paidByMemberId: "ben",
      }),
    ])

    const rows = buildExpenseListPdfRows({
      nodes,
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })

    expect(rows.map((row) => row.id)).toEqual(["receipt", "child"])
    expect(rows[1].payerId).toBe("ben")
  })

  it("blendet Unterpositionen mit gleichem Zahler und gleicher Aufteilung aus", () => {
    const nodes = buildItemNodes([
      item({
        id: "receipt",
        name: "Supermarkt",
        amountCents: 1000,
        item_date: "2026-01-03",
        isReceipt: true,
      }),
      item({
        id: "child",
        name: "Brot",
        amountCents: 400,
        item_date: "2026-01-03",
        parentItemId: "receipt",
      }),
    ])

    const rows = buildExpenseListPdfRows({
      nodes,
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })

    expect(rows.map((row) => row.id)).toEqual(["receipt"])
  })
})
