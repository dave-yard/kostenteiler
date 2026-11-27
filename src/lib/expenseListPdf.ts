import type { jsPDF as JsPdf } from "jspdf"
import { calculateExpenseSplit, type ExpenseSplitRule } from "./expenseSplit"
import {
  toSettlementItems,
  type ItemNode,
} from "./itemHierarchy"
import { formatCents } from "./money"
import { calculateSettlement } from "./settlement"
import type { ExpenseList, Group, GroupMember } from "@/types/group"

export type ExpenseListPdfSort = "date" | "alphabetical"

export interface ExpenseListPdfRow {
  id: string
  parentId: string | null
  name: string
  date: string
  payerId: string | null
  amountCents: number
  sharesByMemberId: Map<string, number>
  includeInTotals: boolean
}

export type ExpenseListPdfEntry =
  | { kind: "item"; row: ExpenseListPdfRow }
  | {
      kind: "subtotal"
      label: string
      amountCents: number
      sharesByMemberId: Map<string, number>
    }

interface BuildExpenseListPdfRowsOptions {
  nodes: ItemNode[]
  members: GroupMember[]
  rules: Record<string, ExpenseSplitRule> | null | undefined
  groupDefaultSplitRule: ExpenseSplitRule
  sort: ExpenseListPdfSort
}

interface CreateExpenseListPdfOptions extends BuildExpenseListPdfRowsOptions {
  group: Group
  list: ExpenseList
}

function addItemShares(
  result: Map<string, number>,
  amountCents: number,
  memberIds: string[],
  rule: ExpenseSplitRule,
  groupDefaultSplitRule: ExpenseSplitRule,
  allocationSeed: string
) {
  for (const share of calculateExpenseSplit(
    amountCents,
    memberIds,
    rule,
    groupDefaultSplitRule,
    allocationSeed
  )) {
    result.set(
      share.memberId,
      (result.get(share.memberId) ?? 0) + share.amountCents
    )
  }
}

function areSplitRulesEqual(first: ExpenseSplitRule, second: ExpenseSplitRule) {
  if (first.mode !== second.mode) return false
  if (first.mode === "equal" && second.mode === "equal") return true
  if (first.mode === "complete" && second.mode === "complete") {
    return first.memberId === second.memberId
  }
  if (first.mode === "percentage" && second.mode === "percentage") {
    const normalize = (
      shares: Array<{ memberId: string; basisPoints: number }>
    ) =>
      [...shares]
        .sort((a, b) => a.memberId.localeCompare(b.memberId))
        .map(({ memberId, basisPoints }) => `${memberId}:${basisPoints}`)
        .join("|")
    return normalize(first.shares) === normalize(second.shares)
  }
  if (first.mode === "fixed" && second.mode === "fixed") {
    const normalize = (
      shares: Array<{ memberId: string; amountCents: number }>
    ) =>
      [...shares]
        .sort((a, b) => a.memberId.localeCompare(b.memberId))
        .map(({ memberId, amountCents }) => `${memberId}:${amountCents}`)
        .join("|")
    return normalize(first.shares) === normalize(second.shares)
  }
  return false
}

export function buildExpenseListPdfRows({
  nodes,
  members,
  rules,
  groupDefaultSplitRule,
  sort,
}: BuildExpenseListPdfRowsOptions): ExpenseListPdfRow[] {
  const memberIds = members.map((member) => member.id)
  const mainRows = nodes.map((node) => {
    const { item, remainderCents } = node
    const visibleChildren = node.children
    const sharesByMemberId = new Map(memberIds.map((memberId) => [memberId, 0]))
    const detailRows: ExpenseListPdfRow[] = []
    const mainRule = rules?.[item.id] ?? groupDefaultSplitRule

    if (item.isReceipt) {
      if (remainderCents < 0) {
        throw new Error(
          `Die Unterpositionen von „${item.name}“ übersteigen die Bon-Summe.`
        )
      }
      if (remainderCents > 0) {
        addItemShares(
          sharesByMemberId,
          remainderCents,
          memberIds,
          mainRule,
          groupDefaultSplitRule,
          item.id
        )
      }
      for (const child of visibleChildren) {
        const childRule = rules?.[child.id] ?? groupDefaultSplitRule
        if (child.isPayerAllocation) {
          detailRows.push({
            id: child.id,
            parentId: item.id,
            name: child.name,
            date: child.item_date,
            payerId: child.paidByMemberId,
            amountCents: child.amountCents,
            sharesByMemberId: new Map(
              memberIds.map((memberId) => [memberId, 0])
            ),
            includeInTotals: false,
          })
          continue
        }
        addItemShares(
          sharesByMemberId,
          child.amountCents,
          memberIds,
          childRule,
          groupDefaultSplitRule,
          child.id
        )
        if (
          child.paidByMemberId !== item.paidByMemberId ||
          !areSplitRulesEqual(childRule, mainRule)
        ) {
          const childShares = new Map(
            memberIds.map((memberId) => [memberId, 0])
          )
          addItemShares(
            childShares,
            child.amountCents,
            memberIds,
            childRule,
            groupDefaultSplitRule,
            child.id
          )
          detailRows.push({
            id: child.id,
            parentId: item.id,
            name: child.name,
            date: child.item_date,
            payerId: child.paidByMemberId,
            amountCents: child.amountCents,
            sharesByMemberId: childShares,
            includeInTotals: false,
          })
        }
      }
    } else {
      addItemShares(
        sharesByMemberId,
        item.amountCents,
        memberIds,
        mainRule,
        groupDefaultSplitRule,
        item.id
      )
    }

    return {
      id: item.id,
      parentId: null,
      name: item.name,
      date: item.item_date,
      payerId: item.paidByMemberId,
      amountCents: item.amountCents,
      sharesByMemberId,
      includeInTotals: true,
      detailRows,
    }
  })

  mainRows.sort((a, b) => {
    if (sort === "alphabetical") {
      const aName = a.name.normalize("NFC").toLocaleLowerCase("de")
      const bName = b.name.normalize("NFC").toLocaleLowerCase("de")
      return (
        aName.localeCompare(bName, "de") ||
        (aName < bName ? -1 : aName > bName ? 1 : 0) ||
        b.date.localeCompare(a.date)
      )
    }
    return a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "de")
  })

  return mainRows.flatMap(({ detailRows, ...row }) => [row, ...detailRows])
}

function getIsoWeek(value: string) {
  const dateOnly = value.slice(0, 10)
  const date = new Date(`${dateOnly}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateOnly
  ) {
    throw new Error(`Ungültiges Positionsdatum für das PDF: ${value}`)
  }
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const year = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${year}-${String(week).padStart(2, "0")}`
}

export function buildExpenseListPdfEntries(
  rows: ExpenseListPdfRow[],
  sort: ExpenseListPdfSort
): ExpenseListPdfEntry[] {
  const entries: ExpenseListPdfEntry[] = []
  const groups: { main: ExpenseListPdfRow; details: ExpenseListPdfRow[] }[] = []
  for (const row of rows) {
    if (row.includeInTotals) {
      groups.push({ main: row, details: [] })
    } else {
      const group = groups[groups.length - 1]
      if (!group || row.parentId !== group.main.id) {
        throw new Error("Unterposition ohne zugehörige Hauptposition im PDF.")
      }
      group.details.push(row)
    }
  }

  const addItems = (group: (typeof groups)[number]) => {
    entries.push({ kind: "item", row: group.main })
    for (const row of group.details) entries.push({ kind: "item", row })
  }
  const addSubtotal = (label: string, subtotalRows: ExpenseListPdfRow[]) => {
    const sharesByMemberId = new Map<string, number>()
    let amountCents = 0
    for (const row of subtotalRows) {
      amountCents += row.amountCents
      for (const [memberId, share] of row.sharesByMemberId) {
        sharesByMemberId.set(
          memberId,
          (sharesByMemberId.get(memberId) ?? 0) + share
        )
      }
    }
    entries.push({ kind: "subtotal", label, amountCents, sharesByMemberId })
  }

  if (sort === "date") {
    let week = ""
    let weekRows: ExpenseListPdfRow[] = []
    for (const group of groups) {
      const nextWeek = getIsoWeek(group.main.date)
      if (week && nextWeek !== week) {
        addSubtotal(
          `Zwischensumme KW ${week.slice(5)}/${week.slice(0, 4)}`,
          weekRows
        )
        weekRows = []
      }
      week = nextWeek
      addItems(group)
      weekRows.push(group.main)
    }
    if (weekRows.length) {
      addSubtotal(
        `Zwischensumme KW ${week.slice(5)}/${week.slice(0, 4)}`,
        weekRows
      )
    }
  } else {
    let otherRows: ExpenseListPdfRow[] = []
    const nameKey = (name: string) =>
      name.normalize("NFC").toLocaleLowerCase("de")
    for (let i = 0; i < groups.length;) {
      let end = i + 1
      while (
        end < groups.length &&
        nameKey(groups[end].main.name) === nameKey(groups[i].main.name)
      )
        end += 1
      const nameGroups = groups.slice(i, end)
      for (const group of nameGroups) {
        addItems(group)
        if (nameGroups.length < 5) {
          otherRows.push(group.main)
          if (otherRows.length === 10) {
            addSubtotal("Zwischensumme übrige Positionen (10)", otherRows)
            otherRows = []
          }
        }
      }
      if (nameGroups.length >= 5) {
        addSubtotal(
          `Zwischensumme ${groups[i].main.name}`,
          nameGroups.map((group) => group.main)
        )
      }
      i = end
    }
    if (otherRows.length) {
      addSubtotal(
        `Zwischensumme übrige Positionen (${otherRows.length})`,
        otherRows
      )
    }
  }
  return entries
}

function formatPdfDate(value: string) {
  if (!value) return "-"
  const dateOnly = value.slice(0, 10)
  const [year, month, day] = dateOnly.split("-").map(Number)
  if (!year || !month || !day) return value
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, " ") || "Ausgabenliste"
  )
}

export function formatSettlementCalculation(
  paidCents: number,
  shareCents: number
) {
  const balanceCents = paidCents - shareCents
  const signedBalance =
    balanceCents > 0
      ? `+${formatCents(balanceCents)}`
      : formatCents(balanceCents)

  return `${formatCents(paidCents)} - ${formatCents(shareCents)} = ${signedBalance}`.replace(
    /\u00A0/g,
    " "
  )
}

function fitText(doc: JsPdf, text: string, maxWidth: number, maxLines = 2) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (doc.getTextWidth(candidate) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) {
      lines.push(line)
      line = word
    } else {
      let clipped = word
      while (clipped && doc.getTextWidth(`${clipped}…`) > maxWidth) {
        clipped = clipped.slice(0, -1)
      }
      line = clipped ? `${clipped}...` : ""
    }
  }
  if (line) lines.push(line)

  if (lines.length <= maxLines) return lines
  const limited = lines.slice(0, maxLines)
  let last = limited[maxLines - 1]
  while (last && doc.getTextWidth(`${last}…`) > maxWidth) {
    last = last.slice(0, -1)
  }
  limited[maxLines - 1] = `${last}...`
  return limited
}

export async function createExpenseListPdf({
  group,
  list,
  nodes,
  members,
  rules,
  groupDefaultSplitRule,
  sort,
}: CreateExpenseListPdfOptions) {
  if (members.length === 0) {
    throw new Error("Für die PDF-Ausgabe werden Gruppenmitglieder benötigt.")
  }

  const rows = buildExpenseListPdfRows({
    nodes,
    members,
    rules,
    groupDefaultSplitRule,
    sort,
  })
  const entries = buildExpenseListPdfEntries(rows, sort)
  const orientation = members.length > 4 ? "landscape" : "portrait"
  const format = members.length > 7 ? "a3" : "a4"
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation, unit: "mm", format })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  const dateWidth = 23
  const payerWidth = 29
  const amountWidth = 25
  const shareWidth = Math.min(
    30,
    (contentWidth - dateWidth - payerWidth - amountWidth - 40) / members.length
  )
  const positionWidth =
    contentWidth -
    dateWidth -
    payerWidth -
    amountWidth -
    shareWidth * members.length
  const columnWidths = [
    dateWidth,
    positionWidth,
    payerWidth,
    amountWidth,
    ...members.map(() => shareWidth),
  ]
  const memberNames = new Map(
    members.map((member) => [member.id, member.displayName])
  )
  const settlementItems = toSettlementItems(nodes)
  const settlement = calculateSettlement(
    settlementItems,
    rules ?? {},
    members.map((member) => member.id),
    groupDefaultSplitRule
  )

  function drawHeader() {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text(list.name, margin, 18)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text(
      `${group.name} · Hauptpositionen · ${
        sort === "date"
          ? "Sortierung nach Datum, ältestes zuerst"
          : "Alphabetische Sortierung"
      }`,
      margin,
      24
    )
    doc.setTextColor(0)
  }

  function drawTableHeader(y: number) {
    doc.setFillColor(238, 241, 237)
    doc.rect(margin, y, contentWidth, 10, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    const headers = [
      "Datum",
      "Position",
      "Bezahlt von",
      "Gesamt",
      ...members.map((member) => member.displayName),
    ]
    let x = margin
    headers.forEach((header, index) => {
      const lines = fitText(doc, header, columnWidths[index] - 2, 2)
      const isAmount = index >= 3
      doc.text(
        lines,
        isAmount ? x + columnWidths[index] - 1.5 : x + 1.5,
        y + 4,
        { align: isAmount ? "right" : "left" }
      )
      x += columnWidths[index]
    })
  }

  drawHeader()
  let y = 31
  drawTableHeader(y)
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  for (const entry of entries) {
    if (entry.kind === "subtotal") {
      const rowHeight = 9
      if (y + rowHeight > pageHeight - 18) {
        doc.addPage()
        drawHeader()
        y = 31
        drawTableHeader(y)
        y += 10
      }
      doc.setFillColor(238, 241, 237)
      doc.rect(margin, y, contentWidth, rowHeight, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7.5)
      doc.text(
        fitText(
          doc,
          entry.label,
          dateWidth + positionWidth + payerWidth - 3,
          2
        ),
        margin + 1.5,
        y + 3.8
      )
      let x = margin + dateWidth + positionWidth + payerWidth
      const amounts = [
        entry.amountCents,
        ...members.map((member) => entry.sharesByMemberId.get(member.id) ?? 0),
      ]
      amounts.forEach((amount, index) => {
        const width = index === 0 ? amountWidth : shareWidth
        doc.text(
          formatCents(amount).replace(/\u00A0/g, " "),
          x + width - 1.5,
          y + 5.8,
          { align: "right" }
        )
        x += width
      })
      y += rowHeight
      doc.setFont("helvetica", "normal")
      continue
    }
    const row = entry.row
    const isSubitem = row.parentId !== null
    const positionLabel = isSubitem
      ? `Unterposition: ${row.name} (im Gesamtbetrag enthalten)`
      : row.name
    const positionLines = fitText(
      doc,
      positionLabel,
      columnWidths[1] - (isSubitem ? 7 : 3),
      2
    )
    const rowHeight = Math.max(8, positionLines.length * 3.6 + 3)
    if (y + rowHeight > pageHeight - 18) {
      doc.addPage()
      drawHeader()
      y = 31
      drawTableHeader(y)
      y += 10
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
    }

    if (isSubitem) {
      doc.setFillColor(247, 248, 246)
      doc.rect(margin, y, contentWidth, rowHeight, "F")
      doc.setFont("helvetica", "italic")
      doc.setTextColor(80)
    }
    let x = margin
    const values = [
      isSubitem ? "" : formatPdfDate(row.date),
      positionLines,
      row.payerId
        ? (memberNames.get(row.payerId) ?? "Unbekannt")
        : "Aufgeteilt",
      formatCents(row.amountCents).replace(/\u00A0/g, " "),
      ...members.map((member) =>
        formatCents(row.sharesByMemberId.get(member.id) ?? 0).replace(
          /\u00A0/g,
          " "
        )
      ),
    ]
    values.forEach((value, index) => {
      const isAmount = index >= 3
      const leftOffset = index === 1 && isSubitem ? 5.5 : 1.5
      doc.text(
        typeof value === "string"
          ? fitText(doc, value, columnWidths[index] - 3, 2)
          : value,
        isAmount ? x + columnWidths[index] - 1.5 : x + leftOffset,
        y + 3.8,
        { align: isAmount ? "right" : "left" }
      )
      x += columnWidths[index]
    })
    doc.setDrawColor(220)
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
    y += rowHeight
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0)
  }

  const totalRowHeight = 9
  if (y + totalRowHeight > pageHeight - 18) {
    doc.addPage()
    drawHeader()
    y = 31
  }
  const totalsByMember = members.map((member) =>
    rows.reduce(
      (sum, row) =>
        sum +
        (row.includeInTotals ? (row.sharesByMemberId.get(member.id) ?? 0) : 0),
      0
    )
  )
  const totalAmount = rows.reduce(
    (sum, row) => sum + (row.includeInTotals ? row.amountCents : 0),
    0
  )
  doc.setFont("helvetica", "bold")
  doc.setFillColor(238, 241, 237)
  doc.rect(margin, y, contentWidth, totalRowHeight, "F")
  let x = margin
  columnWidths.forEach((width, index) => {
    const text =
      index === 0
        ? "Summe"
        : index === 3
          ? formatCents(totalAmount).replace(/\u00A0/g, " ")
          : index >= 4
            ? formatCents(totalsByMember[index - 4]).replace(/\u00A0/g, " ")
            : ""
    if (text) {
      doc.text(text, index >= 3 ? x + width - 1.5 : x + 1.5, y + 5.8, {
        align: index >= 3 ? "right" : "left",
      })
    }
    x += width
  })
  y += totalRowHeight

  const summaryRowHeight = 10
  const summaryHeadingHeight = 13
  const transferHeight = settlement.transfers.length * 6 + 26
  const requiredSummaryHeight =
    summaryHeadingHeight +
    summaryRowHeight * (members.length + 1) +
    transferHeight
  if (y + requiredSummaryHeight > pageHeight - 18) {
    doc.addPage()
    drawHeader()
    y = 31
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Abrechnung", margin, y + 8)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(90)
  doc.text("Saldo = selbst bezahlt minus eigener Kostenanteil.", margin, y + 12)
  doc.setTextColor(0)
  y += summaryHeadingHeight + 2

  const summaryColumns = [55, 38, 38, contentWidth - 131]
  doc.setFillColor(238, 241, 237)
  doc.rect(margin, y, contentWidth, summaryRowHeight, "F")
  doc.setFont("helvetica", "bold")
  ;["Person", "Bezahlt", "Kostenanteil", "Berechnung"].forEach(
    (text, index) => {
      const x =
        margin +
        summaryColumns.slice(0, index).reduce((sum, width) => sum + width, 0)
      doc.text(
        text,
        index === 0 ? x + 1.5 : x + summaryColumns[index] - 1.5,
        y + 6.2,
        {
          align: index === 0 ? "left" : "right",
        }
      )
    }
  )
  y += summaryRowHeight

  doc.setFont("helvetica", "normal")
  for (const member of members) {
    const paidCents = settlementItems
      .filter((item) => item.paidByMemberId === member.id)
      .reduce((sum, item) => sum + item.amountCents, 0)
    const shareCents = rows.reduce(
      (sum, row) =>
        sum +
        (row.includeInTotals ? (row.sharesByMemberId.get(member.id) ?? 0) : 0),
      0
    )
    const values = [
      member.displayName,
      formatCents(paidCents),
      formatCents(shareCents),
      formatSettlementCalculation(paidCents, shareCents),
    ]

    let x = margin
    values.forEach((text, index) => {
      doc.text(
        fitText(
          doc,
          text.replace(/\u00A0/g, " "),
          summaryColumns[index] - 3,
          2
        ),
        index === 0 ? x + 1.5 : x + summaryColumns[index] - 1.5,
        y + 5.5,
        { align: index === 0 ? "left" : "right" }
      )
      x += summaryColumns[index]
    })
    doc.setDrawColor(220)
    doc.line(
      margin,
      y + summaryRowHeight,
      pageWidth - margin,
      y + summaryRowHeight
    )
    y += summaryRowHeight
  }

  y += 8
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(90)
  doc.text(
    "Positives Ergebnis: bekommt Geld zurück. Negatives Ergebnis: muss zahlen.",
    margin,
    y
  )
  doc.setTextColor(0)
  y += 7
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Rückzahlungen", margin, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  if (settlement.transfers.length === 0) {
    doc.text("Es sind keine Rückzahlungen erforderlich.", margin, y + 3)
  } else {
    for (const transfer of settlement.transfers) {
      doc.text(
        `${memberNames.get(transfer.fromMemberId) ?? "Unbekannt"} zahlt ${memberNames.get(transfer.toMemberId) ?? "Unbekannt"} ${formatCents(transfer.amountCents).replace(/\u00A0/g, " ")}.`,
        margin,
        y + 3
      )
      y += 6
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(110)
    doc.text(
      `Seite ${page} von ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    )
  }

  doc.save(
    `${safeFileName(list.name)}-${
      sort === "date" ? "nach-datum" : "alphabetisch"
    }.pdf`
  )
}
