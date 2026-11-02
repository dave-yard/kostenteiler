import { getSupabaseClient } from "@/lib/supabase"
import {
  parseExpenseSplitRule,
  type ExpenseSplitRule,
} from "@/lib/expenseSplit"
import type { ExpenseItem } from "@/types/group"

export interface ExpenseItemInput {
  name: string
  amountCents: number
  paidByMemberId: string
  splitRule?: ExpenseSplitRule | null
  isReceipt?: boolean
  parentItemId?: string | null
  item_date?: string | null
}

type ParsedReceipt = {
  storeName: string
  totalCents: number
  date: string
  items: Array<{
    name: string
    amountCents: number
  }>
  reconciliation: {
    itemsTotalCents: number
    differenceCents: number
    matches: boolean
    needsReview: boolean
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type UploadAndProcessReceiptResult = {
  receiptId: string
  needsReview: boolean
  warning?: string
}

export async function uploadAndProcessReceipt(
  listId: string,
  file: File,
  currentMemberId: string
): Promise<UploadAndProcessReceiptResult> {
  const supabase = getSupabaseClient()

  let uploadedPath: string | null = null
  let receiptId: string | null = null

  try {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
    const inferredType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : file.type

    if (!inferredType.startsWith("image/")) {
      throw new Error("Der Beleg muss als Bilddatei hochgeladen werden.")
    }

    // Eindeutiger temporärer Name; der Listenordner bleibt listId.
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const temporaryPath = `${listId}/${crypto.randomUUID()}_${sanitizedFileName}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from("receipts")
      .upload(temporaryPath, file, {
        contentType: inferredType,
        upsert: false,
      })

    if (storageError) throw storageError
    if (!storageData?.path) {
      throw new Error("Storage hat keinen Dateipfad zurückgegeben.")
    }

    uploadedPath = storageData.path

    const { data, error: processError } = await supabase.functions.invoke(
      "process-receipt",
      { body: { filePath: uploadedPath } }
    )

    if (processError) throw processError
    if (!data) {
      throw new Error("Die Belegerkennung hat keine Daten zurückgegeben.")
    }

    const parseResult = data as ParsedReceipt
    const reconciliation = parseResult.reconciliation

    if (
      !Number.isSafeInteger(parseResult.totalCents) ||
      !Array.isArray(parseResult.items) ||
      !reconciliation ||
      typeof reconciliation.needsReview !== "boolean" ||
      !Number.isSafeInteger(reconciliation.differenceCents)
    ) {
      throw new Error(
        "Die Antwort der Belegerkennung ist unvollständig oder ungültig."
      )
    }

    // Erst alle Positionen validieren, bevor überhaupt Datensätze angelegt werden.
    const items = parseResult.items.map((subItem) => {
      if (
        !subItem ||
        typeof subItem.name !== "string" ||
        !subItem.name.trim() ||
        !Number.isSafeInteger(subItem.amountCents) ||
        subItem.amountCents === 0
      ) {
        throw new Error(
          `Ungültige Bonposition: ${subItem?.name ?? "(ohne Namen)"}`
        )
      }

      return {
        name: subItem.name.trim(),
        amountCents: subItem.amountCents,
      }
    })

    // Eine Summenabweichung ist eine Warnung, kein Abbruchgrund.
    const warning = reconciliation.needsReview
      ? `Bon wurde angelegt, aber die Bonpositionen weichen um ${new Intl.NumberFormat(
          "de-DE",
          {
            style: "currency",
            currency: "EUR",
          }
        ).format(
          Math.abs(reconciliation.differenceCents) / 100
        )} von der Gesamtsumme ab. Bitte prüfe die Positionen.`
      : undefined

    // Bon-Elterneintrag anlegen.
    receiptId = await createExpenseItem(listId, {
      name: parseResult.storeName,
      amountCents: parseResult.totalCents,
      isReceipt: true,
      item_date: parseResult.date,
      parentItemId: null,
      paidByMemberId: currentMemberId,
    })

    if (!receiptId) {
      throw new Error("Die Datenbank hat keine Bon-ID zurückgegeben.")
    }

    // Alle validierten Bonpositionen anlegen — auch bei einer Summenabweichung.
    for (const subItem of items) {
      await createExpenseItem(listId, {
        name: subItem.name,
        amountCents: subItem.amountCents,
        isReceipt: false,
        item_date: parseResult.date,
        parentItemId: receiptId,
        paidByMemberId: currentMemberId,
      })
    }

    const { data: attachment, error: attachError } =
      await supabase.functions.invoke("attach-receipt", {
        body: {
          receiptItemId: receiptId,
          filePath: uploadedPath,
        },
      })

    if (
      attachError ||
      !attachment?.success ||
      attachment.receiptItemId !== receiptId ||
      !attachment.storagePath
    ) {
      throw new Error(
        attachment?.error ??
          attachError?.message ??
          `Belegdatei konnte nicht mit Bon ${receiptId} verknüpft werden.`
      )
    }

    return {
      receiptId,
      needsReview: Boolean(reconciliation.needsReview),
      warning,
    }
  } catch (error) {
    // Vor dem Anlegen des Bon-Datensatzes kann die temporäre Datei entfernt werden.
    // Bei einem möglichen Teilerfolg lassen wir Datei und Datensätze bestehen.
    if (uploadedPath && !receiptId) {
      const { error: cleanupError } = await supabase.storage
        .from("receipts")
        .remove([uploadedPath])

      if (cleanupError) {
        console.warn(
          "Temporäre Belegdatei konnte nicht entfernt werden.",
          cleanupError
        )
      }
    }

    if (receiptId) {
      throw new Error(
        `Bon ${receiptId} wurde angelegt, aber der Vorgang wurde nicht vollständig abgeschlossen: ${getErrorMessage(error)}`,
        { cause: error }
      )
    }

    throw error
  }
}

async function setExpenseitem_date(itemId: string, item_dateStr: string) {
  // Prüfen, ob es bereits ein ISO-String ist oder noch konvertiert werden muss
  const itemISOdate =
    item_dateStr.includes("T") || item_dateStr.includes("-")
      ? item_dateStr
      : germanToIsoDateTime(item_dateStr)

  console.log("setExpenseitem_date konvertiert:", itemISOdate)

  if (!itemISOdate) {
    throw new Error("Ungültiges Datum für setExpenseitem_date")
  }

  const { error } = await getSupabaseClient().rpc("set_expense_item_date", {
    p_item_id: itemId,
    p_date: itemISOdate,
  })

  if (error) {
    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key]

  if (typeof value === "string") {
    return value
  }

  if (value === undefined || value === null) {
    throw new Error(
      `In der Positionsantwort fehlt ein gültiger Wert für "${key}".`
    )
  }

  // Wenn es kein String ist, aber in ein Datum/String umgewandelt werden soll:
  // Hier erzwingen wir die Umwandlung zu string/number für den Konstruktor
  if (
    value instanceof Date ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return new Date(value).toISOString()
  }

  // Fallback, falls es ein unerwartetes Objekt ist (z. B. {}):
  return String(value)
}

function readInteger(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Der Wert "${key}" in der Positionsantwort ist ungültig.`)
  }

  return value
}

export async function getExpenseItems(listId: string): Promise<ExpenseItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("expense_items")
    .select(
      "id, list_id, name, amount_cents, paid_by_member_id, is_receipt, parent_item_id, item_date, created_at"
    )
    .eq("list_id", listId)

  if (error) {
    throw error
  }

  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Positionen in einem unerwarteten Format geliefert."
    )
  }

  const items = data.map((row) => ({
    id: readString(row, "id"),
    listId: readString(row, "list_id"),
    name: readString(row, "name"),
    amountCents: readInteger(row, "amount_cents"),
    paidByMemberId: readString(row, "paid_by_member_id"),
    isReceipt: row.is_receipt === true,
    parentItemId:
      typeof row.parent_item_id === "string" ? row.parent_item_id : null,
    item_date: readString(row, "item_date") || readString(row, "item_date"),
    createdAt: readString(row, "created_at"),
  }))

  let rules: Record<string, ExpenseSplitRule> = {}
  try {
    rules = await getExpenseListSplitRules(listId)
  } catch {
    // Bei Fehlern beim Laden der Regeln wird ohne die Spezialsortierung fortgefahren.
  }

  // 1. Hauptpositionen: Neuestes Rechnungsdatum zuerst; bei gleichem Datum neueste Uhrzeit zuerst
  const topLevelItems = items
    .filter((item) => !item.parentItemId)
    .sort((a, b) => {
      const rawDateA = a.item_date || a.createdAt || ""
      const rawDateB = b.item_date || b.createdAt || ""

      // console.log("item_date A:", a.name, a.item_date)
      // console.log("createdAt A:", a.name, a.createdAt)
      // console.log("item_date B:", b.name, b.item_date)
      // console.log("createdAt B:", b.name, b.createdAt)

      const dateStrA =
        rawDateA.length === 10 ? `${rawDateA}T00:00:00Z` : rawDateA
      const dateStrB =
        rawDateB.length === 10 ? `${rawDateB}T00:00:00Z` : rawDateB

      // console.log("dateString A:", a.name, dateStrA)
      // console.log("sateString B", b.name, dateStrB)

      if (dateStrA !== dateStrB) {
        return dateStrB.localeCompare(dateStrA)
      }
      return b.createdAt.localeCompare(a.createdAt)
    })

  // 2. Unterpositionen: Zuweisung ("Komplett bezahlt") vor Rest, danach chronologisch
  const childItems = items
    .filter((item) => Boolean(item.parentItemId))
    .sort((a, b) => {
      const ruleA = rules[a.id]
      const ruleB = rules[b.id]

      const assignedA = getCompletelyAssignedMemberId(ruleA, a.amountCents)
      const assignedB = getCompletelyAssignedMemberId(ruleB, b.amountCents)

      if (assignedA && !assignedB) return -1
      if (!assignedA && assignedB) return 1

      if (assignedA && assignedB && assignedA !== assignedB) {
        return assignedA.localeCompare(assignedB)
      }

      return a.createdAt.localeCompare(b.createdAt)
    })

  return [...topLevelItems, ...childItems]
}

/**
 * Ermittelt die ID des Mitglieds, wenn eine Aufteilungsregel die Kosten zu 100%
 * einer einzelnen Person zuweist. Ansonsten null.
 */
export function getCompletelyAssignedMemberId(
  rule: ExpenseSplitRule | undefined,
  amountCents: number
): string | null {
  if (!rule) return null

  switch (rule.mode) {
    case "complete":
      return rule.memberId
    case "percentage": {
      // Eine Person hat 100% (10000 Basispunkte)
      const fullShare = rule.shares.find((s) => s.basisPoints === 10000)
      return fullShare ? fullShare.memberId : null
    }
    case "fixed": {
      // Eine Person trägt den exakten Gesamtbetrag
      const fullShare = rule.shares.find((s) => s.amountCents === amountCents)
      return fullShare ? fullShare.memberId : null
    }
    default:
      return null
  }
}

export async function createExpenseItem(
  listId: string,
  input: ExpenseItemInput
): Promise<string> {
  console.log("##### createExpenseItem")
  console.log(input.item_date)

  const { data, error } = await getSupabaseClient().rpc(
    "create_expense_item_hierarchical",
    {
      p_list_id: listId,
      p_name: input.name,
      p_amount_cents: input.amountCents,
      p_paid_by_member_id: input.paidByMemberId,
      p_split_rule: input.splitRule ?? null,
      p_is_receipt: input.isReceipt ?? false,
      p_item_date: input.item_date ?? null,
      p_parent_item_id: input.parentItemId ?? null,
    }
  )

  if (error) {
    throw error
  }
  if (typeof data !== "string") {
    throw new Error("Die Position wurde erstellt, aber ihre ID fehlt.")
  }
  if (input.item_date) {
    await setExpenseitem_date(data, input.item_date)
  }

  return data
}

export async function updateExpenseItem(
  itemId: string,
  input: ExpenseItemInput
): Promise<void> {
  console.log("item_date", input.item_date)

  // input.item_date ist hier bereits der ISO-String aus dem Frontend!
  const itemIsoDate = input.item_date ?? null
  console.log("updateExpenseItem", itemIsoDate)

  const { error } = await getSupabaseClient().rpc(
    "update_expense_item_hierarchical",
    {
      p_item_id: itemId,
      p_name: input.name,
      p_amount_cents: input.amountCents,
      p_paid_by_member_id: input.paidByMemberId,
      p_split_rule: input.splitRule ?? null,
      p_is_receipt: input.isReceipt ?? false,
      p_item_date: itemIsoDate,
    }
  )

  if (error) {
    throw error
  }
  if (input.item_date) {
    await setExpenseitem_date(itemId, input.item_date)
  }
}

export function germanToIsoDateTime(
  germanDateStr?: string | null
): string | null {
  if (!germanDateStr || typeof germanDateStr !== "string") return null

  // Erwartet Format: "DD.MM.YYYY HH:mm" oder "DD.MM.YYYY"
  const parts = germanDateStr.trim().split(" ")
  const datePart = parts[0]
  const timePart = parts[1] ?? "00:00"

  if (!datePart) return null

  const dateSplits = datePart.split(".").map(Number)
  const timeSplits = timePart.split(":").map(Number)

  const day = dateSplits[0]
  const month = dateSplits[1]
  const year = dateSplits[2]
  const hours = timeSplits[0] ?? 0
  const minutes = timeSplits[1] ?? 0

  if (day === undefined || month === undefined || year === undefined)
    return null

  // Erstelle ein Date-Objekt in der lokalen Zeitzone des Browsers
  const localDate = new Date(year, month - 1, day, hours, minutes, 0)

  // Prüfen, ob das Datum gültig ist
  if (isNaN(localDate.getTime())) return null

  // Gibt einen sauberen ISO-String zurück, der die lokale Zeit korrekt nach UTC wandelt
  return localDate.toISOString()
}

export async function getExpenseItemSplitRule(
  itemId: string
): Promise<ExpenseSplitRule> {
  const { data, error } = await getSupabaseClient().rpc("get_item_split_rule", {
    p_item_id: itemId,
  })

  if (error) {
    throw error
  }

  return parseExpenseSplitRule(data)
}

export async function getExpenseListMemberNames(
  listId: string
): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_list_member_names",
    { p_list_id: listId }
  )

  if (error) {
    throw error
  }
  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Mitgliedsnamen in einem unerwarteten Format geliefert."
    )
  }

  return Object.fromEntries(
    data.map((row) => [
      readString(row, "member_id"),
      readString(row, "display_name"),
    ])
  )
}

export async function getExpenseListSplitRules(
  listId: string
): Promise<Record<string, ExpenseSplitRule>> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_list_split_rules",
    {
      p_list_id: listId,
    }
  )

  if (error) {
    throw error
  }
  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error(
      "Supabase hat Aufteilungen in einem unerwarteten Format geliefert."
    )
  }

  return Object.fromEntries(
    data.map((row) => [
      readString(row, "item_id"),
      parseExpenseSplitRule(row.split_rule),
    ])
  )
}

export async function deleteExpenseItem(itemId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("delete_expense_item", {
    p_item_id: itemId,
  })

  if (error) {
    throw error
  }
}
