import { parseAmountToCents } from "@/lib/money"

export type ExpenseSplitRule =
  | { mode: "equal" }
  | { mode: "complete"; memberId: string }
  | {
      mode: "percentage"
      shares: Array<{ memberId: string; basisPoints: number }>
    }
  | {
      mode: "fixed"
      shares: Array<{ memberId: string; amountCents: number }>
    }

export interface ExpenseSplitAllocation {
  memberId: string
  amountCents: number
}

export function createEqualPercentageDrafts(
  memberIds: string[]
): Record<string, string> {
  if (memberIds.length === 0) {
    return {}
  }

  const sortedIds = [...memberIds].sort()
  const base = Math.floor(10_000 / sortedIds.length)
  const remainder = 10_000 % sortedIds.length
  return Object.fromEntries(
    memberIds.map((memberId) => {
      const index = sortedIds.indexOf(memberId)
      const basisPoints = base + (index < remainder ? 1 : 0)
      return [memberId, (basisPoints / 100).toFixed(2).replace(".", ",")]
    })
  )
}

export function parsePercentageToBasisPoints(input: string): number | null {
  const text = input.trim().replace(",", ".")
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) {
    return null
  }

  const wholePercent = Number(match[1])
  const fraction = Number((match[2] ?? "").padEnd(2, "0"))
  const basisPoints = wholePercent * 100 + fraction
  return basisPoints <= 10_000 ? basisPoints : null
}

export function parseNonNegativeCents(input: string): number | null {
  const text = input.trim()
  if (!text) {
    return 0
  }
  if (/^0+(?:[.,]0{1,2})?$/.test(text)) {
    return 0
  }
  return parseAmountToCents(text)
}

export function parseExpenseSplitRule(value: unknown): ExpenseSplitRule {
  if (typeof value !== "object" || value === null || !("mode" in value)) {
    throw new Error("Die gespeicherte Aufteilung hat ein ungültiges Format.")
  }

  const rule = value as Record<string, unknown>
  if (rule.mode === "equal") {
    return { mode: "equal" }
  }
  if (rule.mode === "complete" && typeof rule.memberId === "string") {
    return { mode: "complete", memberId: rule.memberId }
  }
  if (rule.mode === "percentage" && Array.isArray(rule.shares)) {
    return {
      mode: "percentage",
      shares: rule.shares.map((share) => {
        if (
          typeof share !== "object" ||
          share === null ||
          !("memberId" in share) ||
          !("basisPoints" in share) ||
          typeof share.memberId !== "string" ||
          typeof share.basisPoints !== "number" ||
          !Number.isInteger(share.basisPoints)
        ) {
          throw new Error(
            "Die gespeicherten Prozentanteile haben ein ungültiges Format."
          )
        }
        return { memberId: share.memberId, basisPoints: share.basisPoints }
      }),
    }
  }
  if (rule.mode === "fixed" && Array.isArray(rule.shares)) {
    return {
      mode: "fixed",
      shares: rule.shares.map((share) => {
        if (
          typeof share !== "object" ||
          share === null ||
          !("memberId" in share) ||
          !("amountCents" in share) ||
          typeof share.memberId !== "string" ||
          typeof share.amountCents !== "number" ||
          !Number.isSafeInteger(share.amountCents)
        ) {
          throw new Error(
            "Die gespeicherten Festbeträge haben ein ungültiges Format."
          )
        }
        return { memberId: share.memberId, amountCents: share.amountCents }
      }),
    }
  }

  throw new Error("Die gespeicherte Aufteilung hat ein unbekanntes Format.")
}

function assertValidMembers(memberIds: string[]) {
  if (
    memberIds.length === 0 ||
    memberIds.some((memberId) => !memberId) ||
    new Set(memberIds).size !== memberIds.length
  ) {
    throw new Error(
      "Für die Aufteilung werden eindeutige Gruppenmitglieder benötigt."
    )
  }
}

function assertValidAmount(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error(
      "Der Positionsbetrag muss eine positive ganze Centzahl sein."
    )
  }
}

function sortedMemberIds(memberIds: string[]) {
  return [...memberIds].sort((a, b) => a.localeCompare(b))
}

function assertKnownUniqueShares(
  memberIds: string[],
  shares: Array<{ memberId: string }>
) {
  const memberSet = new Set(memberIds)
  const shareIds = shares.map((share) => share.memberId)

  if (
    shareIds.some((memberId) => !memberSet.has(memberId)) ||
    new Set(shareIds).size !== shareIds.length
  ) {
    throw new Error(
      "Die Aufteilung enthält ein unbekanntes oder doppeltes Mitglied."
    )
  }
}

function splitEvenly(
  amountCents: number,
  memberIds: string[]
): Map<string, number> {
  const sortedIds = sortedMemberIds(memberIds)
  const baseCents = Math.floor(amountCents / sortedIds.length)
  const remainderCents = amountCents % sortedIds.length

  return new Map(
    sortedIds.map((memberId, index) => [
      memberId,
      baseCents + (index < remainderCents ? 1 : 0),
    ])
  )
}

function allocatePercentage(
  amountCents: number,
  memberIds: string[],
  shares: Array<{ memberId: string; basisPoints: number }>
): Map<string, number> {
  assertKnownUniqueShares(memberIds, shares)

  if (
    shares.some(
      ({ basisPoints }) =>
        !Number.isInteger(basisPoints) ||
        basisPoints < 0 ||
        basisPoints > 10_000
    ) ||
    shares.reduce((sum, share) => sum + share.basisPoints, 0) !== 10_000
  ) {
    throw new Error("Die Prozentanteile müssen zusammen genau 100 % ergeben.")
  }

  const shareByMember = new Map(
    shares.map(({ memberId, basisPoints }) => [memberId, basisPoints])
  )
  const fractionalAllocations = memberIds.map((memberId) => {
    const numerator = amountCents * (shareByMember.get(memberId) ?? 0)
    return {
      memberId,
      amountCents: Math.floor(numerator / 10_000),
      remainder: numerator % 10_000,
    }
  })
  const allocatedCents = fractionalAllocations.reduce(
    (sum, allocation) => sum + allocation.amountCents,
    0
  )
  const centsToDistribute = amountCents - allocatedCents
  const remainderOrder = [...fractionalAllocations].sort(
    (a, b) => b.remainder - a.remainder || a.memberId.localeCompare(b.memberId)
  )
  const extraCentMembers = new Set(
    remainderOrder
      .slice(0, centsToDistribute)
      .map((allocation) => allocation.memberId)
  )

  return new Map(
    fractionalAllocations.map(({ memberId, amountCents: cents }) => [
      memberId,
      cents + (extraCentMembers.has(memberId) ? 1 : 0),
    ])
  )
}

function allocateFixed(
  amountCents: number,
  memberIds: string[],
  shares: Array<{ memberId: string; amountCents: number }>,
  remainderRule: ExpenseSplitRule
): Map<string, number> {
  assertKnownUniqueShares(memberIds, shares)

  if (
    shares.some(
      ({ amountCents: shareCents }) =>
        !Number.isSafeInteger(shareCents) || shareCents < 0
    )
  ) {
    throw new Error(
      "Feste Aufteilungsbeträge müssen ganze, nicht negative Centbeträge sein."
    )
  }

  const fixedTotal = shares.reduce((sum, share) => sum + share.amountCents, 0)
  if (!Number.isSafeInteger(fixedTotal) || fixedTotal > amountCents) {
    throw new Error(
      "Die festen Aufteilungsbeträge dürfen den Positionsbetrag nicht überschreiten."
    )
  }

  const remainingCents = amountCents - fixedTotal
  const remainder =
    remainingCents === 0
      ? new Map(memberIds.map((memberId) => [memberId, 0]))
      : calculateExpenseSplit(
          remainingCents,
          memberIds,
          remainderRule.mode === "fixed" ? { mode: "equal" } : remainderRule
        ).reduce(
          (allocations, allocation) =>
            allocations.set(allocation.memberId, allocation.amountCents),
          new Map<string, number>()
        )
  const fixedByMember = new Map(
    shares.map(({ memberId, amountCents: shareCents }) => [
      memberId,
      shareCents,
    ])
  )

  return new Map(
    memberIds.map((memberId) => [
      memberId,
      (fixedByMember.get(memberId) ?? 0) + (remainder.get(memberId) ?? 0),
    ])
  )
}

export function calculateExpenseSplit(
  amountCents: number,
  memberIds: string[],
  rule: ExpenseSplitRule,
  remainderRule: ExpenseSplitRule = { mode: "equal" }
): ExpenseSplitAllocation[] {
  assertValidAmount(amountCents)
  assertValidMembers(memberIds)

  let allocationByMember: Map<string, number>

  if (rule.mode === "complete") {
    if (!memberIds.includes(rule.memberId)) {
      throw new Error("Die ausgewählte Person gehört nicht zu dieser Gruppe.")
    }
    allocationByMember = new Map(
      memberIds.map((memberId) => [
        memberId,
        memberId === rule.memberId ? amountCents : 0,
      ])
    )
  } else if (rule.mode === "equal") {
    allocationByMember = splitEvenly(amountCents, memberIds)
  } else if (rule.mode === "percentage") {
    allocationByMember = allocatePercentage(amountCents, memberIds, rule.shares)
  } else {
    allocationByMember = allocateFixed(
      amountCents,
      memberIds,
      rule.shares,
      remainderRule
    )
  }

  return memberIds.map((memberId) => ({
    memberId,
    amountCents: allocationByMember.get(memberId) ?? 0,
  }))
}
