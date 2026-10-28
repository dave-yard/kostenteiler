import type { ExpenseItem } from "@/types/group"

export interface ItemNode {
  item: ExpenseItem
  children: ExpenseItem[]
  childrenCents: number
  // Bon-Summe minus Unterpositionen; negativ heißt, die Unterpositionen übersteigen die Summe.
  remainderCents: number
}

// Unterpositionen ohne auffindbaren Bon werden wie Einzelpositionen behandelt.
export function buildItemNodes(items: ExpenseItem[]): ItemNode[] {
  const ids = new Set(items.map((item) => item.id))
  const childrenByParent = new Map<string, ExpenseItem[]>()
  for (const item of items) {
    if (item.parentItemId && ids.has(item.parentItemId)) {
      childrenByParent.set(item.parentItemId, [
        ...(childrenByParent.get(item.parentItemId) ?? []),
        item,
      ])
    }
  }

  return items
    .filter((item) => !item.parentItemId || !ids.has(item.parentItemId))
    .map((item) => {
      const children = item.isReceipt
        ? (childrenByParent.get(item.id) ?? [])
        : []
      const childrenCents = children.reduce(
        (sum, child) => sum + child.amountCents,
        0
      )

      return {
        item,
        children,
        childrenCents,
        remainderCents: item.amountCents - childrenCents,
      }
    })
}

export function sumTopLevelCents(nodes: ItemNode[]) {
  return nodes.reduce((sum, node) => sum + node.item.amountCents, 0)
}

// Der Bon-Rest läuft mit Zahler und Schlüssel des Bons; Unterpositionen behalten ihre eigenen.
export function toSettlementItems(nodes: ItemNode[]) {
  return nodes.flatMap((node) => {
    if (!node.item.isReceipt) {
      return [node.item]
    }
    if (node.remainderCents < 0) {
      throw new Error(
        `Die Unterpositionen von „${node.item.name}“ übersteigen die Bon-Summe.`
      )
    }

    return [
      ...(node.remainderCents > 0
        ? [{ ...node.item, amountCents: node.remainderCents }]
        : []),
      ...node.children,
    ]
  })
}
