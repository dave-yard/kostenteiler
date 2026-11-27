import {
  calculateNextPeriodDate,
  formatPeriodName,
  isPeriodDue,
} from "@/lib/recurringSchedule"
import {
  completeExpenseList,
  createExpenseList,
  getExpenseLists,
} from "@/services/listService"
import {
  createExpenseItem,
  getExpenseItems,
  getExpenseListSplitRules,
} from "@/services/itemService"
import type { ExpenseSplitRule } from "@/lib/expenseSplit"
import type { ExpenseItem, ExpenseList } from "@/types/group"

export interface RecurringProcessingResult {
  generatedListsCount: number
  autoClosedListsCount: number
  generatedListIds: string[]
}

/**
 * Klont alle Positionen, Beträge und Aufteilungsregeln einer Vorperiode
 * in die neu erstellte Folgeperiode gemäß FR-5.2.
 */
export async function copyItemsToNextPeriod(
  sourceListId: string,
  targetListId: string
): Promise<void> {
  const [items, rules]: [ExpenseItem[], Record<string, ExpenseSplitRule>] =
    await Promise.all([
      getExpenseItems(sourceListId).catch(() => []),
      getExpenseListSplitRules(sourceListId).catch(
        (): Record<string, ExpenseSplitRule> => ({})
      ),
    ])

  if (items.length === 0) {
    return
  }

  const parentMap = new Map<string, string>()

  // 1. Erst Hauptpositionen (ohne parentItemId) anlegen
  for (const item of items.filter((i) => !i.parentItemId)) {
    const newId = await createExpenseItem(targetListId, {
      name: item.name,
      amountCents: item.amountCents,
      paidByMemberId:
        item.isReceipt && item.isPayerAllocation ? null : item.paidByMemberId,
      splitRule: rules[item.id] ?? null,
      isReceipt: item.isReceipt,
      item_date: new Date().toISOString(),
    })
    parentMap.set(item.id, newId)
  }

  // 2. Danach Unterpositionen mit Verweis auf die neue Parent-ID anlegen
  for (const item of items.filter(
    (i) => Boolean(i.parentItemId) && !i.isPayerAllocation
  )) {
    const newParentId = item.parentItemId
      ? (parentMap.get(item.parentItemId) ?? null)
      : null
    await createExpenseItem(targetListId, {
      name: item.name,
      amountCents: item.amountCents,
      paidByMemberId: item.paidByMemberId,
      splitRule: rules[item.id] ?? null,
      isReceipt: item.isReceipt,
      parentItemId: newParentId,
      item_date: new Date().toISOString(),
    })
  }
}

/**
 * Prüft alle wiederkehrenden Listen einer Gruppe und erzeugt automatisch
 * fällige Folgeperioden (monatlich, quartalsweise, jährlich) gemäß FR-5.2.
 * Wenn autoClose konfiguriert ist, wird die Vorperiode abgeschlossen (FR-5.3).
 */
export async function processRecurringExpenseLists(
  groupId: string,
  referenceDate: Date = new Date()
): Promise<RecurringProcessingResult> {
  const allLists = await getExpenseLists(groupId, true)
  const recurringLists = allLists.filter(
    (list) => list.listType === "recurring" && Boolean(list.interval)
  )

  let generatedListsCount = 0
  let autoClosedListsCount = 0
  const generatedListIds: string[] = []

  // Gruppiere nach Basis-Name (ohne Periodensuffix wie "(Februar 2026)")
  const seriesMap = new Map<string, ExpenseList[]>()
  for (const list of recurringLists) {
    const baseName = list.name.replace(/\s*\([^)]+\)$/, "").trim().toLowerCase()
    const existing = seriesMap.get(baseName) ?? []
    existing.push(list)
    seriesMap.set(baseName, existing)
  }

  for (const [, series] of seriesMap.entries()) {
    // Sortiere nach Erstellungsdatum absteigend, die neueste Liste ist die aktuellste Periode
    const sorted = [...series].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const latestList = sorted[0]
    if (!latestList || !latestList.interval) {
      continue
    }

    // Prüfen, ob die nächste Periode fällig ist
    const nextDate = calculateNextPeriodDate(
      latestList.createdAt,
      latestList.interval,
      latestList.dayOfMonth
    )

    if (isPeriodDue(latestList.createdAt, latestList.interval, latestList.dayOfMonth, referenceDate)) {
      const nextName = formatPeriodName(latestList.name, nextDate, latestList.interval)

      // Verhindere doppeltes Anlegen, falls schon eine Liste mit diesem Namen existiert
      const alreadyExists = series.some(
        (l) => l.name.trim().toLowerCase() === nextName.trim().toLowerCase()
      )
      if (alreadyExists) {
        continue
      }

      // Neue Liste für die nächste Periode anlegen
      const newListId = await createExpenseList(groupId, {
        name: nextName,
        listType: "recurring",
        interval: latestList.interval,
        dayOfMonth: latestList.dayOfMonth,
        autoClose: latestList.autoClose ?? false,
      })

      // Positionen aus Vorperiode übernehmen (FR-5.2)
      await copyItemsToNextPeriod(latestList.id, newListId)

      // Automatischer Kassenabschluss für die Vorperiode falls autoClose aktiv (FR-5.3)
      if (latestList.autoClose && latestList.status === "open") {
        await completeExpenseList(latestList.id).catch(() => {
          // Fehler beim automatischen Kassensturz fangen, damit Folgeperioden nicht blockiert werden
        })
        autoClosedListsCount += 1
      }

      generatedListsCount += 1
      generatedListIds.push(newListId)
    }
  }

  return {
    generatedListsCount,
    autoClosedListsCount,
    generatedListIds,
  }
}
