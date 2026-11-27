import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildExpenseListPdfEntries,
  buildExpenseListPdfRows,
  createExpenseListPdf,
  formatSettlementCalculation,
} from "./expenseListPdf"
import { buildItemNodes } from "./itemHierarchy"
import type { ExpenseItem, GroupMember } from "@/types/group"

const pdf = vi.hoisted(() => ({
  text: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
}))

vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 80 } }
    text = pdf.text
    addPage = pdf.addPage
    save = pdf.save
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    rect() {}
    line() {}
    setPage() {}
    getNumberOfPages() {
      return 1
    }
    getTextWidth(text: string) {
      return text.length
    }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

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
    isPayerAllocation: false,
    isReceipt: false,
    parentItemId: null,
    createdAt: "2026-01-01T12:00:00Z",
    ...values,
  }
}

const members = [member("anna", "Anna"), member("ben", "Ben")]

describe("buildExpenseListPdfEntries", () => {
  it("zeichnet Zwischensummen auch bei Seitenumbrüchen und behält die Gesamtsumme bei", async () => {
    await createExpenseListPdf({
      group: {
        id: "group",
        name: "Gruppe",
        sortNr: 0,
        memberCount: 2,
        currentUserIsAdmin: true,
        archivedAt: null,
      },
      list: {
        id: "list",
        groupId: "group",
        name: "Liste",
        status: "open",
        createdAt: "2026-01-01",
        completedAt: null,
        paidAt: null,
      },
      nodes: buildItemNodes(
        Array.from({ length: 10 }, (_, i) =>
          item({
            id: String(i),
            name: `Position ${i}`,
            amountCents: 100,
            item_date: "2026-01-01",
          })
        )
      ),
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "alphabetical",
    })
    const texts = pdf.text.mock.calls.map(([text]) =>
      Array.isArray(text) ? text.join(" ") : text
    )
    expect(texts).toContain("Zwischensumme übrige Positionen (10)")
    expect(texts).toContain("Summe")
    expect(texts.filter((text) => text === "10,00 €")).toHaveLength(3)
    expect(pdf.addPage).toHaveBeenCalled()
    expect(pdf.save).toHaveBeenCalledWith("Liste-alphabetisch.pdf")
  })

  it("bildet ISO-Wochensummen über den Jahreswechsel ohne Unterpositionen doppelt zu zählen", () => {
    const nodes = buildItemNodes([
      item({
        id: "a",
        name: "Bon",
        amountCents: 1000,
        item_date: "2020-12-31",
        isReceipt: true,
      }),
      item({
        id: "child",
        name: "Kaffee",
        amountCents: 400,
        item_date: "2021-01-02",
        parentItemId: "a",
      }),
      item({
        id: "b",
        name: "Brot",
        amountCents: 200,
        item_date: "2021-01-03",
      }),
      item({
        id: "c",
        name: "Milch",
        amountCents: 300,
        item_date: "2021-01-04",
      }),
    ])
    const rows = buildExpenseListPdfRows({
      nodes,
      members,
      rules: { child: { mode: "complete", memberId: "anna" } },
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })
    const entries = buildExpenseListPdfEntries(rows, "date")
    expect(
      entries.map((entry) =>
        entry.kind === "item" ? entry.row.id : entry.label
      )
    ).toEqual([
      "a",
      "child",
      "b",
      "Zwischensumme KW 53/2020",
      "c",
      "Zwischensumme KW 01/2021",
    ])
    const subtotals = entries.filter((entry) => entry.kind === "subtotal")
    expect(subtotals.map((entry) => entry.amountCents)).toEqual([1200, 300])
    expect(subtotals[0].sharesByMemberId.get("anna")).toBe(800)
    expect(subtotals[0].sharesByMemberId.get("ben")).toBe(400)
  })

  it("summiert Namen ab fünf Positionen unabhängig von Großschreibung und übrige in Zehnerblöcken", () => {
    const items = [
      ...Array.from({ length: 5 }, (_, i) =>
        item({
          id: `lidl${i}`,
          name: i % 2 ? "LIDL" : "Lidl",
          amountCents: 100,
          item_date: "2026-01-01",
        })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        item({
          id: `aldi${i}`,
          name: "Aldi",
          amountCents: 200,
          item_date: "2026-01-01",
        })
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        item({
          id: `z${i}`,
          name: `Z${i}`,
          amountCents: 300,
          item_date: "2026-01-01",
        })
      ),
    ]
    const rows = buildExpenseListPdfRows({
      nodes: buildItemNodes(items),
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "alphabetical",
    })
    const entries = buildExpenseListPdfEntries(rows, "alphabetical")
    const subtotals = entries.filter((entry) => entry.kind === "subtotal")
    expect(
      subtotals.map(({ label, amountCents }) => [label, amountCents])
    ).toEqual([
      ["Zwischensumme Lidl", 500],
      ["Zwischensumme übrige Positionen (10)", 2600],
      ["Zwischensumme übrige Positionen (1)", 300],
    ])
    expect(subtotals[1].sharesByMemberId.get("anna")).toBe(1300)
    expect(subtotals[1].sharesByMemberId.get("ben")).toBe(1300)
    expect(entries.filter((entry) => entry.kind === "item")).toHaveLength(16)
    expect(buildExpenseListPdfEntries([], "alphabetical")).toEqual([])
  })

  it("meldet ungültige Datumsangaben statt eine falsche Kalenderwoche auszugeben", () => {
    const rows = buildExpenseListPdfRows({
      nodes: buildItemNodes([
        item({ id: "a", name: "A", amountCents: 100, item_date: "2026-02-30" }),
      ]),
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })
    expect(() => buildExpenseListPdfEntries(rows, "date")).toThrow(
      "Ungültiges Positionsdatum"
    )
  })
})

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

  it("weist Zahler-Ausgleichspositionen im PDF als Details aus", () => {
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
        amountCents: 1000,
        item_date: "2026-01-03",
        parentItemId: "receipt",
      }),
      item({
        id: "allocation",
        name: "Ausgleich",
        amountCents: -200,
        item_date: "2026-01-03",
        parentItemId: "receipt",
        isPayerAllocation: true,
      }),
    ])

    const [row, detailRow] = buildExpenseListPdfRows({
      nodes,
      members,
      rules: null,
      groupDefaultSplitRule: { mode: "equal" },
      sort: "date",
    })

    expect(row.amountCents).toBe(1000)
    expect(detailRow).toMatchObject({
      id: "allocation",
      parentId: "receipt",
      amountCents: -200,
      includeInTotals: false,
    })
    expect(row.sharesByMemberId).toEqual(
      new Map([
        ["anna", 500],
        ["ben", 500],
      ])
    )
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
