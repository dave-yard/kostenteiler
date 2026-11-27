import { describe, expect, it } from "vitest"
import type { ExpenseItem } from "@/types/group"
import {
  buildItemNodes,
  sumTopLevelCents,
  toSettlementItems,
} from "./itemHierarchy"

function item(overrides: Partial<ExpenseItem> & { id: string }): ExpenseItem {
  return {
    listId: "list-1",
    name: overrides.id,
    amountCents: 100,
    paidByMemberId: "a",
    isPayerAllocation: false,
    isReceipt: false,
    parentItemId: null,
    comment: null,
    item_date: "2026-10-28",
    createdAt: "2026-10-28T10:00:00.000Z",
    ...overrides,
  }
}

describe("itemHierarchy", () => {
  const items = [
    item({
      id: "bon",
      amountCents: 5000,
      isReceipt: true,
      paidByMemberId: "a",
    }),
    item({
      id: "socken",
      amountCents: 500,
      parentItemId: "bon",
      paidByMemberId: "b",
    }),
    item({ id: "kaese", amountCents: 1230 }),
  ]

  it("gruppiert Unterpositionen unter ihrem Bon und summiert nur oberste Ebene", () => {
    const nodes = buildItemNodes(items)

    expect(nodes.map((node) => node.item.id)).toEqual(["bon", "kaese"])
    expect(nodes[0].children.map((child) => child.id)).toEqual(["socken"])
    expect(nodes[0].remainderCents).toBe(4500)
    expect(sumTopLevelCents(nodes)).toBe(6230)
  })

  it("verrechnet den Bon-Rest mit dem Zahler des Bons", () => {
    const result = toSettlementItems(buildItemNodes(items))

    expect(
      result.map((entry) => [entry.id, entry.amountCents, entry.paidByMemberId])
    ).toEqual([
      ["bon", 4500, "a"],
      ["socken", 500, "b"],
      ["kaese", 1230, "a"],
    ])
  })

  it("zählt Zahler-Ausgleichspositionen nicht zur Bon-Summe", () => {
    const nodes = buildItemNodes([
      item({ id: "bon", amountCents: 1000, isReceipt: true }),
      item({ id: "child", amountCents: 1000, parentItemId: "bon" }),
      item({
        id: "positive",
        amountCents: 100,
        parentItemId: "bon",
        isPayerAllocation: true,
      }),
      item({
        id: "negative",
        amountCents: -100,
        parentItemId: "bon",
        isPayerAllocation: true,
      }),
    ])

    expect(nodes[0].childrenCents).toBe(1000)
    expect(nodes[0].remainderCents).toBe(0)
  })

  it("lässt den Bon-Rest weg, wenn die Unterpositionen die Summe ausschöpfen", () => {
    const result = toSettlementItems(
      buildItemNodes([
        item({ id: "bon", amountCents: 500, isReceipt: true }),
        item({ id: "x", amountCents: 500, parentItemId: "bon" }),
      ])
    )

    expect(result.map((entry) => entry.id)).toEqual(["x"])
  })

  it("behält die Zahler von aufgeteilten Unterpositionen", () => {
    const result = toSettlementItems(
      buildItemNodes([
        item({
          id: "bon",
          amountCents: 101,
          isReceipt: true,
          paidByMemberId: null,
        }),
        item({
          id: "a",
          amountCents: 51,
          parentItemId: "bon",
          paidByMemberId: "a",
        }),
        item({
          id: "b",
          amountCents: 50,
          parentItemId: "bon",
          paidByMemberId: "b",
        }),
      ])
    )

    expect(
      result.map(({ id, amountCents, paidByMemberId }) => [
        id,
        amountCents,
        paidByMemberId,
      ])
    ).toEqual([
      ["a", 51, "a"],
      ["b", 50, "b"],
    ])
  })

  it("verrechnet den Rest eines aufgeteilten Bons ohne festen Zahler", () => {
    const result = toSettlementItems(
      buildItemNodes([
        item({
          id: "bon",
          amountCents: 101,
          isReceipt: true,
          paidByMemberId: null,
        }),
        item({
          id: "child",
          amountCents: 100,
          parentItemId: "bon",
          paidByMemberId: "a",
        }),
      ])
    )

    expect(
      result.map(({ id, amountCents, paidByMemberId }) => [
        id,
        amountCents,
        paidByMemberId,
      ])
    ).toEqual([
      ["bon", 1, null],
      ["child", 100, "a"],
    ])
  })

  it("behält markierte Ausgleichspositionen in der Abrechnung", () => {
    const result = toSettlementItems(
      buildItemNodes([
        item({ id: "bon", amountCents: 100, isReceipt: true }),
        item({
          id: "child",
          amountCents: 100,
          parentItemId: "bon",
        }),
        item({
          id: "adjustment",
          amountCents: -20,
          parentItemId: "bon",
          paidByMemberId: "b",
          isPayerAllocation: true,
        }),
      ])
    )

    expect(result.map(({ id }) => id)).toEqual(["child", "adjustment"])
  })

  it("meldet Unterpositionen über der Bon-Summe", () => {
    expect(() =>
      toSettlementItems(
        buildItemNodes([
          item({ id: "bon", amountCents: 100, isReceipt: true }),
          item({ id: "x", amountCents: 200, parentItemId: "bon" }),
        ])
      )
    ).toThrow(/übersteigen/)
  })
})
