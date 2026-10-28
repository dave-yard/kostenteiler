import { describe, expect, it } from "vitest"
import { calculateSettlement } from "@/lib/settlement"

const equal = { mode: "equal" } as const

describe("calculateSettlement", () => {
  it("verrechnet das Beispiel aus den Anforderungen", () => {
    const settlement = calculateSettlement(
      [
        { id: "i1", amountCents: 10000, paidByMemberId: "a" },
        { id: "i2", amountCents: 3000, paidByMemberId: "b" },
      ],
      {},
      ["a", "b"],
      equal
    )

    expect(settlement.balances).toEqual([
      { memberId: "a", balanceCents: 3500 },
      { memberId: "b", balanceCents: -3500 },
    ])
    expect(settlement.transfers).toEqual([
      { fromMemberId: "b", toMemberId: "a", amountCents: 3500 },
    ])
  })

  it("berücksichtigt individuelle Regeln und den Gruppenstandard", () => {
    const settlement = calculateSettlement(
      [
        { id: "i1", amountCents: 1000, paidByMemberId: "a" },
        { id: "i2", amountCents: 600, paidByMemberId: "a" },
      ],
      { i1: { mode: "complete", memberId: "b" } },
      ["a", "b", "c"],
      equal
    )

    expect(settlement.transfers).toEqual([
      { fromMemberId: "b", toMemberId: "a", amountCents: 1200 },
      { fromMemberId: "c", toMemberId: "a", amountCents: 200 },
    ])
  })

  it("liefert keine Zahlungen bei ausgeglichenen Salden", () => {
    const settlement = calculateSettlement(
      [{ id: "i1", amountCents: 1000, paidByMemberId: "a" }],
      { i1: { mode: "complete", memberId: "a" } },
      ["a", "b"],
      equal
    )

    expect(settlement.transfers).toEqual([])
  })

  it("hält die Summe der Salden bei Rundungsresten bei null", () => {
    const settlement = calculateSettlement(
      [{ id: "i1", amountCents: 100, paidByMemberId: "a" }],
      {},
      ["a", "b", "c"],
      equal
    )

    expect(
      settlement.balances.reduce((sum, item) => sum + item.balanceCents, 0)
    ).toBe(0)
    expect(
      settlement.transfers.reduce((sum, item) => sum + item.amountCents, 0)
    ).toBe(66)
  })

  it("lehnt unbekannte Zahler ab", () => {
    expect(() =>
      calculateSettlement(
        [{ id: "i1", amountCents: 100, paidByMemberId: "x" }],
        {},
        ["a", "b"],
        equal
      )
    ).toThrow("zahlende Person")
  })
})
