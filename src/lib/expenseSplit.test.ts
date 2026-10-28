import { describe, expect, it } from "vitest"
import {
  calculateExpenseSplit,
  createEqualPercentageDrafts,
  parseNonNegativeCents,
  parsePercentageToBasisPoints,
} from "./expenseSplit"

const memberIds = ["member-c", "member-a", "member-b"]

describe("calculateExpenseSplit", () => {
  it("supports percentage precision of one hundredth of a percent", () => {
    expect(parsePercentageToBasisPoints("33,33")).toBe(3333)
    expect(parsePercentageToBasisPoints("0,29")).toBe(29)
    expect(parsePercentageToBasisPoints("100,01")).toBeNull()
    expect(parsePercentageToBasisPoints("33,333")).toBeNull()
  })

  it("parses non-negative fixed amounts including zero", () => {
    expect(parseNonNegativeCents("0,00")).toBe(0)
    expect(parseNonNegativeCents("12,50")).toBe(1250)
    expect(parseNonNegativeCents("-1")).toBeNull()
  })

  it("initializes percentage drafts to exactly 100 percent", () => {
    const drafts = createEqualPercentageDrafts(memberIds)
    expect(
      Object.values(drafts).reduce(
        (sum, value) => sum + (parsePercentageToBasisPoints(value) ?? 0),
        0
      )
    ).toBe(10_000)
  })

  it("assigns the full amount to one selected member", () => {
    expect(
      calculateExpenseSplit(1250, memberIds, {
        mode: "complete",
        memberId: "member-b",
      })
    ).toEqual([
      { memberId: "member-c", amountCents: 0 },
      { memberId: "member-a", amountCents: 0 },
      { memberId: "member-b", amountCents: 1250 },
    ])
  })

  it("allocates percentage shares exactly and assigns remainder cents deterministically", () => {
    expect(
      calculateExpenseSplit(100, memberIds, {
        mode: "percentage",
        shares: [
          { memberId: "member-a", basisPoints: 3333 },
          { memberId: "member-b", basisPoints: 3333 },
          { memberId: "member-c", basisPoints: 3334 },
        ],
      })
    ).toEqual([
      { memberId: "member-c", amountCents: 34 },
      { memberId: "member-a", amountCents: 33 },
      { memberId: "member-b", amountCents: 33 },
    ])
  })

  it("rejects percentage shares that do not total 100 percent", () => {
    expect(() =>
      calculateExpenseSplit(100, memberIds, {
        mode: "percentage",
        shares: [
          { memberId: "member-a", basisPoints: 5000 },
          { memberId: "member-b", basisPoints: 4999 },
        ],
      })
    ).toThrow("genau 100 %")
  })

  it("adds a fixed allocation to the equal distribution of the remainder", () => {
    expect(
      calculateExpenseSplit(5000, memberIds, {
        mode: "fixed",
        shares: [{ memberId: "member-a", amountCents: 1000 }],
      })
    ).toEqual([
      { memberId: "member-c", amountCents: 1333 },
      { memberId: "member-a", amountCents: 2334 },
      { memberId: "member-b", amountCents: 1333 },
    ])
  })

  it("uses the supplied group standard for a fixed split remainder", () => {
    expect(
      calculateExpenseSplit(
        6000,
        memberIds,
        {
          mode: "fixed",
          shares: [{ memberId: "member-a", amountCents: 1000 }],
        },
        {
          mode: "percentage",
          shares: [
            { memberId: "member-a", basisPoints: 0 },
            { memberId: "member-b", basisPoints: 5000 },
            { memberId: "member-c", basisPoints: 5000 },
          ],
        }
      )
    ).toEqual([
      { memberId: "member-c", amountCents: 2500 },
      { memberId: "member-a", amountCents: 1000 },
      { memberId: "member-b", amountCents: 2500 },
    ])
  })

  it("rejects fixed allocations greater than the item amount", () => {
    expect(() =>
      calculateExpenseSplit(500, memberIds, {
        mode: "fixed",
        shares: [{ memberId: "member-a", amountCents: 501 }],
      })
    ).toThrow("nicht überschreiten")
  })

  it("rejects unknown members and duplicate member entries", () => {
    expect(() =>
      calculateExpenseSplit(500, memberIds, {
        mode: "complete",
        memberId: "outside-group",
      })
    ).toThrow("gehört nicht")

    expect(() =>
      calculateExpenseSplit(500, memberIds, {
        mode: "fixed",
        shares: [
          { memberId: "member-a", amountCents: 100 },
          { memberId: "member-a", amountCents: 100 },
        ],
      })
    ).toThrow("doppeltes Mitglied")
  })

  it("returns an exact total and non-negative whole-cent amounts", () => {
    const allocation = calculateExpenseSplit(10_003, memberIds, {
      mode: "percentage",
      shares: [
        { memberId: "member-a", basisPoints: 2500 },
        { memberId: "member-b", basisPoints: 3750 },
        { memberId: "member-c", basisPoints: 3750 },
      ],
    })

    expect(allocation.reduce((sum, share) => sum + share.amountCents, 0)).toBe(
      10_003
    )
    expect(
      allocation.every(
        ({ amountCents }) =>
          Number.isSafeInteger(amountCents) && amountCents >= 0
      )
    ).toBe(true)
  })
})
