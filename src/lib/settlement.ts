import {
  calculateExpenseSplit,
  type ExpenseSplitRule,
} from "@/lib/expenseSplit"

export interface SettlementItem {
  id: string
  amountCents: number
  paidByMemberId: string
}

export interface SettlementBalance {
  memberId: string
  balanceCents: number
}

export interface SettlementTransfer {
  fromMemberId: string
  toMemberId: string
  amountCents: number
}

export interface Settlement {
  balances: SettlementBalance[]
  transfers: SettlementTransfer[]
}

// Nettosaldo = ausgelegter Betrag - eigener Kostenanteil; positiv heißt "bekommt Geld zurück".
export function calculateSettlement(
  items: SettlementItem[],
  rulesByItemId: Record<string, ExpenseSplitRule>,
  memberIds: string[],
  groupDefaultRule: ExpenseSplitRule
): Settlement {
  const balanceByMember = new Map(memberIds.map((memberId) => [memberId, 0]))

  for (const item of items) {
    if (!balanceByMember.has(item.paidByMemberId)) {
      throw new Error("Die zahlende Person gehört nicht zu dieser Gruppe.")
    }

    const shares = calculateExpenseSplit(
      item.amountCents,
      memberIds,
      rulesByItemId[item.id] ?? groupDefaultRule,
      groupDefaultRule
    )
    balanceByMember.set(
      item.paidByMemberId,
      (balanceByMember.get(item.paidByMemberId) ?? 0) + item.amountCents
    )
    for (const share of shares) {
      balanceByMember.set(
        share.memberId,
        (balanceByMember.get(share.memberId) ?? 0) - share.amountCents
      )
    }
  }

  const balances = memberIds.map((memberId) => ({
    memberId,
    balanceCents: balanceByMember.get(memberId) ?? 0,
  }))

  return { balances, transfers: settleBalances(balances) }
}

// Größter Gläubiger wird jeweils mit dem größten Schuldner verrechnet; das hält die Zahlungsanzahl klein.
function settleBalances(balances: SettlementBalance[]): SettlementTransfer[] {
  const creditors = balances
    .filter((balance) => balance.balanceCents > 0)
    .map((balance) => ({ ...balance }))
  const debtors = balances
    .filter((balance) => balance.balanceCents < 0)
    .map((balance) => ({
      memberId: balance.memberId,
      balanceCents: -balance.balanceCents,
    }))
  const byAmountThenId = (
    a: { memberId: string; balanceCents: number },
    b: { memberId: string; balanceCents: number }
  ) => b.balanceCents - a.balanceCents || a.memberId.localeCompare(b.memberId)
  const transfers: SettlementTransfer[] = []

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byAmountThenId)
    debtors.sort(byAmountThenId)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amountCents = Math.min(creditor.balanceCents, debtor.balanceCents)

    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountCents,
    })
    creditor.balanceCents -= amountCents
    debtor.balanceCents -= amountCents
    if (creditor.balanceCents === 0) {
      creditors.shift()
    }
    if (debtor.balanceCents === 0) {
      debtors.shift()
    }
  }

  return transfers
}
