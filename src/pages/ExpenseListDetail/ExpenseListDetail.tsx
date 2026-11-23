import { useEffect, useState, useMemo, useRef, type ReactNode } from "react"
import { SlidersHorizontal } from "lucide-react"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Printer,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
  Camera,
} from "lucide-react"
import {
  useExpenseLists,
  type ExpenseItemAccess,
} from "@/components/contexts/ExpenseListContext"
import { ExpenseListStatusBadge } from "@/components/ExpenseListStatusBadge"
import { ReceiptPreview } from "./ReceiptPreview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ExpenseItemDialog } from "@/components/dialogs/ExpenseItemDialog"
import { DeleteExpenseItemDialog } from "@/components/dialogs/DeleteExpenseItemDialog"
import { ConvertExpenseListDialog } from "@/components/dialogs/ConvertExpenseListDialog"
import { Toast } from "@/components/ui/toast"
import { type ExpenseSplitRule } from "@/lib/expenseSplit"
import { getActionErrorMessage } from "@/lib/errorMessage"
import { formatCents } from "@/lib/money"
import {
  buildItemNodes,
  sumTopLevelCents,
  type ItemNode,
} from "@/lib/itemHierarchy"
import { SettlementSection } from "./components/SettlementSection"
import { calculateNextPeriodDate } from "@/lib/recurringSchedule"
import type { ExpenseItem, ExpenseList, Group } from "@/types/group"
import {
  createExpenseListPdf,
  type ExpenseListPdfSort,
} from "@/lib/expenseListPdf"

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })
const timeFormat = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" })
const equalSplitRule: ExpenseSplitRule = { mode: "equal" }

export function todayIsoDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function isoToGermanDateTime(isoDate: string) {
  if (!isoDate) return ""

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) {
    return isoDate
  }

  // Nutzen der lokalen Methoden (.getHours(), .getMinutes() etc.),
  // damit der UTC-Zeitstempel aus der DB korrekt in die lokale Browser-Zeit konvertiert wird
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${day}.${month}.${year} ${hours}:${minutes}`
}

export function germanToIsoDateTime(text: string) {
  // Erlaubt nun flexibel 1 oder 2 Ziffern bei Tag, Monat, Stunde und Minute
  const match =
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/.exec(
      text.trim()
    )
  console.log("######## germanToIsoDateTime ############")
  console.log(text)
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const hours = match[4] !== undefined ? Number(match[4]) : 0
  const minutes = match[5] !== undefined ? Number(match[5]) : 0

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  const date = new Date(year, month - 1, day, hours, minutes)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  console.log(date)
  return date.toISOString()
}

function formatitem_date(isoDate: string, showTime = false) {
  if (!isoDate) return ""

  const hasTime = isoDate.includes("T") || isoDate.includes(" ")

  // 1. Reines Datum ohne Zeitangabe ("YYYY-MM-DD") ohne Zeitzonenverschiebung formatieren
  if (!hasTime) {
    const datePart = isoDate.slice(0, 10)
    const [year, month, day] = datePart.split("-").map(Number)

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return ""
    }

    return dateFormat.format(new Date(year, month - 1, day))
  }

  // 2. Vollständiger Zeitstempel: Komplett in lokaler Zeitzone formatieren
  const parsedDate = new Date(isoDate)
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate
  }

  const formattedDate = dateFormat.format(parsedDate)

  if (showTime) {
    return `${formattedDate}, ${timeFormat.format(parsedDate)}`
  }

  return formattedDate
}

function highlightSearchMatch(text: string, searchQuery: string): ReactNode {
  const query = searchQuery.trim()
  if (!query) return text

  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  const parts: ReactNode[] = []
  let position = 0
  let matchIndex = normalizedText.indexOf(normalizedQuery, position)

  while (matchIndex !== -1) {
    if (matchIndex > position) {
      parts.push(text.slice(position, matchIndex))
    }

    const matchEnd = matchIndex + query.length
    parts.push(
      <mark
        className="rounded-sm bg-highlight px-0.5 text-inherit"
        key={matchIndex}
      >
        {text.slice(matchIndex, matchEnd)}
      </mark>
    )
    position = matchEnd
    matchIndex = normalizedText.indexOf(normalizedQuery, position)
  }

  if (parts.length === 0) return text
  if (position < text.length) parts.push(text.slice(position))
  return parts
}

// Kurzinfo zur Verteilung: bei gleichmäßiger Verteilung nichts, bei „komplett“ den Namen,
// sonst den eigenen Anteil.
function getSplitHint(
  rule: ExpenseSplitRule,
  currentMemberId: string | null,
  memberNames: Map<string, string>
) {
  switch (rule.mode) {
    case "equal":
      return null
    case "complete":
      return memberNames.get(rule.memberId) ?? "Unbekannt"
    case "percentage": {
      const share = rule.shares.find(
        (entry) => entry.memberId === currentMemberId
      )
      const percent = (share?.basisPoints ?? 0) / 100
      return `${percent.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
    }
    case "fixed": {
      const share = rule.shares.find(
        (entry) => entry.memberId === currentMemberId
      )
      return formatCents(share?.amountCents ?? 0)
    }
  }
}

interface ItemsResult {
  listId: string
  reloadNumber: number
  items: ExpenseItem[]
  access: ExpenseItemAccess | null
  rules: Record<string, ExpenseSplitRule> | null
  rulesErrorMessage: string | null
  errorMessage: string | null
}

export function ExpenseListDetail({
  group,
  list,
  onBack,
  onListChange,
}: {
  group: Group
  list: ExpenseList
  onBack: () => void
  onListChange?: (list: ExpenseList) => void
}) {
  const {
    getExpenseItems,
    getExpenseListSplitRules,
    getItemAccess,
    uploadAndProcessReceipt,
  } = useExpenseLists()
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ItemsResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null)
  const [dialogParent, setDialogParent] = useState<ExpenseItem | null>(null)
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showTime, setShowTime] = useState(false)
  const [sortBy, setSortBy] = useState<"item_date" | "createdAt">("item_date")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [scanWarningMessage, setScanWarningMessage] = useState<string | null>(
    null
  )
  const [deletingItem, setDeletingItem] = useState<ExpenseItem | null>(null)
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isCurrent = true

    Promise.all([
      getExpenseItems(list.id),
      getItemAccess(group, list),
      // Ein Fehler hier soll die Positionsliste nicht blockieren.
      getExpenseListSplitRules(list.id).then(
        (rules) => ({ rules, rulesErrorMessage: null }),
        (error: unknown) => ({
          rules: null,
          rulesErrorMessage: getActionErrorMessage(error),
        })
      ),
    ])
      .then(([items, access, splitRules]) => {
        if (isCurrent) {
          setResult({
            listId: list.id,
            reloadNumber,
            items,
            access,
            ...splitRules,
            errorMessage: null,
          })
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setResult({
            listId: list.id,
            reloadNumber,
            items: [],
            access: null,
            rules: null,
            rulesErrorMessage: null,
            errorMessage: getActionErrorMessage(error),
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [
    getExpenseItems,
    getExpenseListSplitRules,
    getItemAccess,
    group,
    list,
    reloadNumber,
  ])

  const isLoading =
    result?.listId !== list.id || result.reloadNumber !== reloadNumber
  const errorMessage = isLoading ? null : (result?.errorMessage ?? null)
  const items = isLoading ? [] : (result?.items ?? [])
  const accessMembers = result?.access?.members
  const memberNames = useMemo(
    () =>
      new Map(
        (accessMembers ?? []).map((member) => [member.id, member.displayName])
      ),
    [accessMembers]
  )
  const members = accessMembers ?? []
  // Nur zur Bequemlichkeit: Die Datenbank prüft Rechte, Status und Archiv erneut.
  const canAddItem =
    !isLoading &&
    !errorMessage &&
    Boolean(result?.access?.canCreate) &&
    list.status === "open" &&
    !group.archivedAt
  const canEditItems =
    !isLoading &&
    !errorMessage &&
    Boolean(result?.access?.canEdit) &&
    list.status === "open" &&
    !group.archivedAt
  const [deleteMode, setDeleteMode] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const canDeleteItems =
    !isLoading &&
    !errorMessage &&
    Boolean(result?.access?.canDelete) &&
    list.status === "open" &&
    !group.archivedAt
  const canEditSplits =
    Boolean(result?.access?.canEditSplits) &&
    list.status === "open" &&
    !group.archivedAt
  const groupDefaultSplitRule =
    result?.access?.groupDefaultSplitRule ?? equalSplitRule

  const nodes = buildItemNodes(items)

  const sortedNodes = useMemo(() => {
    return getSortedNodes({
      nodes,
      sortBy,
      searchQuery,
      memberNames,
      rules: result?.rules,
      groupDefaultSplitRule,
    })
  }, [
    nodes,
    sortBy,
    searchQuery,
    memberNames,
    result?.rules,
    groupDefaultSplitRule,
  ])

  const totalCents = sumTopLevelCents(nodes)

  function renderItemRow(item: ExpenseItem) {
    const splitHint = getSplitHint(
      result?.rules?.[item.id] ?? groupDefaultSplitRule,
      result?.access?.currentMemberId ?? null,
      memberNames
    )
    const payerName = memberNames.get(item.paidByMemberId) ?? "Unbekannt"
    const amount = formatCents(item.amountCents)

    return (
      <div
        className={`relative flex items-start justify-between gap-3 py-3 ${
          canDeleteItems && deleteMode ? "pr-10" : ""
        }`}
        onClick={() => openDialog(item)}
      >
        <div className="min-w-0">
          <Button
            className="h-auto max-w-full justify-start p-0 text-left font-medium break-words whitespace-normal hover:bg-transparent"
            onClick={(event) => {
              event.stopPropagation()
              void openDialog(item)
            }}
            type="button"
            variant="ghost"
          >
            <span>
              {highlightSearchMatch(item.name, searchQuery)}
              {!item.parentItemId && item.item_date && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  •{" "}
                  {highlightSearchMatch(
                    formatitem_date(item.item_date, showTime),
                    searchQuery
                  )}
                </span>
              )}
              {item.isReceipt && (
                <span className="ml-2 rounded-full bg-brand-surface px-2 py-0.5 align-middle text-xs font-medium text-brand-text">
                  Bon
                </span>
              )}
            </span>
          </Button>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bezahlt von {highlightSearchMatch(payerName, searchQuery)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <p className="font-semibold">
              {highlightSearchMatch(amount, searchQuery)}
            </p>
            {splitHint && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {highlightSearchMatch(splitHint, searchQuery)}
              </p>
            )}
          </div>
          {canEditItems && (
            <Button
              aria-label={`Position bearbeiten: ${item.name}`}
              className="size-8 p-0 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation()
                void openDialog(item)
              }}
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
          )}
          {canDeleteItems && deleteMode && (
            <Button
              aria-label={`Position löschen: ${item.name}`}
              className="absolute top-2 right-0 size-8 p-0 text-destructive hover:text-danger-text"
              onClick={(event) => {
                event.stopPropagation()
                setDeletingItem(item)
              }}
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  const canCloseList =
    Boolean(result?.access?.canCloseLists) &&
    list.status === "open" &&
    !group.archivedAt

  function openDialog(
    item: ExpenseItem | null = null,
    parent: ExpenseItem | null = null
  ) {
    setEditingItem(item)
    const resolvedParent =
      parent ??
      (item?.parentItemId
        ? (items.find((i) => i.id === item.parentItemId) ?? null)
        : null)
    setDialogParent(resolvedParent)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setEditingItem(null)
    setDialogParent(null)
  }

  function handleDialogSuccess(message: string, parentItemId: string | null) {
    closeDialog()
    if (parentItemId) {
      setExpandedIds((current) => new Set(current).add(parentItemId))
    }
    setSuccessMessage(message)
    setReloadNumber((current) => current + 1)
  }

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const memberId = result?.access?.currentMemberId ?? members[0]?.id ?? ""

    if (!memberId) {
      console.error("Kein Mitglied für den Bon gefunden.")
      return
    }

    try {
      setIsScanning(true)
      const scanResult = await uploadAndProcessReceipt(list.id, file, memberId)

      if (scanResult.needsReview && scanResult.warning) {
        // Bon wurde angelegt, aber Summen weichen ab -> Nutzer muss prüfen
        setScanWarningMessage(scanResult.warning)
      } else {
        // Alles passend angelegt
        setSuccessMessage("Der Bon wurde erfolgreich gescannt und angelegt.")
      }

      setReloadNumber((current) => current + 1)
    } catch (err) {
      console.error("Fehler beim Scannen des Bons:", err)
      setScanWarningMessage(getActionErrorMessage(err))
    } finally {
      setIsScanning(false)
      event.target.value = ""
    }
  }

  async function handleCreatePdf(sort: ExpenseListPdfSort) {
    if (result?.rulesErrorMessage) {
      setPdfErrorMessage(
        "Das PDF kann nicht erstellt werden, weil die Aufteilungen nicht geladen werden konnten."
      )
      return
    }

    try {
      await createExpenseListPdf({
        group,
        list,
        nodes,
        members,
        rules: result?.rules,
        groupDefaultSplitRule,
        sort,
      })
      setIsViewSettingsOpen(false)
    } catch (error) {
      setPdfErrorMessage(getActionErrorMessage(error))
    }
  }

  return (
    <>
      {isScanning && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="fixed inset-0 z-40 flex cursor-wait flex-col items-center justify-center bg-background/80 backdrop-blur-sm select-none"
          onClick={(event) => event.stopPropagation()}
          role="status"
        >
          <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
            <LoaderCircle
              aria-hidden="true"
              className="size-8 shrink-0 animate-spin text-brand-primary"
            />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                Wird gescannt...
              </p>
              <p className="text-xs text-muted-foreground">
                Der Bon wird analysiert und die Ausgaben werden erfasst. Bitte
                warten...
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden border border-border bg-card p-4 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:h-[calc(100dvh-8rem)] sm:p-6">
        <div className="shrink-0">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                aria-label="Zurück"
                className="size-8 shrink-0 rounded-lg border border-border p-0 text-brand-text"
                onClick={onBack}
                type="button"
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Button>
              <h1 className="min-w-0 text-2xl leading-8 font-semibold tracking-[-0.04em] break-words">
                {list.name}
              </h1>
            </div>
            <ExpenseListStatusBadge status={list.status} />
          </div>

          <div className="mt-1 ml-[42px]">
            <div className="flex flex-row items-start gap-1">
              <div className="min-w-0">
                <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <p>
                    Erstellt am {dateFormat.format(new Date(list.createdAt))}
                    {list.listType === "recurring" && list.interval && (
                      <>
                        {" · "}
                        {list.interval === "monthly"
                          ? "Monatlich"
                          : list.interval === "quarterly"
                            ? "Quartalsweise"
                            : "Jährlich"}
                        {list.dayOfMonth
                          ? ` (Stichtag: ${list.dayOfMonth}.)`
                          : ""}
                        {list.autoClose ? " · Auto-Abschluss" : ""}
                      </>
                    )}
                    {list.completedAt &&
                      ` · Erledigt am ${dateFormat.format(new Date(list.completedAt))}`}
                    {list.paidAt &&
                      ` · Bezahlt am ${dateFormat.format(new Date(list.paidAt))}`}
                  </p>
                  {list.listType === "recurring" && list.interval && (
                    <p>
                      Folgeperiode wird am{" "}
                      <span className="font-medium text-foreground">
                        {dateFormat.format(
                          calculateNextPeriodDate(
                            list.createdAt,
                            list.interval,
                            list.dayOfMonth
                          )
                        )}
                      </span>{" "}
                      automatisch erzeugt
                      {list.autoClose
                        ? " (inkl. automatischem Kassenabschluss)"
                        : " (manueller Kassenabschluss)"}
                      .
                    </p>
                  )}
                </div>
              </div>
              <Popover
                open={isViewSettingsOpen}
                onOpenChange={setIsViewSettingsOpen}
              >
                <PopoverTrigger
                  render={
                    <Button
                      aria-label="Ansichts- und Sortieroptionen"
                      className="size-8 rounded-lg border border-border p-0 text-muted-foreground hover:bg-muted"
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <SlidersHorizontal className="size-4" />
                </PopoverTrigger>

                <PopoverContent
                  align="end"
                  className="w-64 max-w-[calc(100vw-24px)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      Ansichts- und Sortieroptionen
                    </p>
                  </div>

                  <div className="mt-2.5 space-y-2.5 text-xs">
                    {/* Uhrzeit-Umschalter */}
                    <div>
                      <label className="text-muted-foreground">
                        Uhrzeit anzeigen
                      </label>
                      <Button
                        type="button"
                        onClick={() => setShowTime((prev) => !prev)}
                        className="mt-1 w-full rounded-lg border border-border bg-muted py-1 text-center font-medium hover:bg-muted"
                        variant="ghost"
                      >
                        {showTime ? "✓ Mit Uhrzeit" : "Nur Datum"}
                      </Button>
                    </div>

                    {/* Sortierung */}
                    <div>
                      <label className="text-muted-foreground">
                        Sortieren nach
                      </label>
                      <Button
                        type="button"
                        onClick={() =>
                          setSortBy((prev) =>
                            prev === "item_date" ? "createdAt" : "item_date"
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-muted py-1 text-center font-medium hover:bg-muted"
                        variant="ghost"
                      >
                        {sortBy === "item_date"
                          ? "📅 Belegdatum"
                          : "🕒 Erfassungszeit"}
                      </Button>
                    </div>

                    <hr className="border-border" />

                    <div className="space-y-1.5">
                      <p className="text-muted-foreground">Druckbild als PDF</p>
                      <Button
                        className="w-full justify-start rounded-lg"
                        disabled={isLoading || items.length === 0}
                        onClick={() => handleCreatePdf("date")}
                        type="button"
                        variant="outline"
                      >
                        <Printer aria-hidden="true" className="size-4" />
                        Nach Datum (älteste zuerst)
                      </Button>
                      <Button
                        className="w-full justify-start rounded-lg"
                        disabled={isLoading || items.length === 0}
                        onClick={() => handleCreatePdf("alphabetical")}
                        type="button"
                        variant="outline"
                      >
                        <Printer aria-hidden="true" className="size-4" />
                        Alphabetisch
                      </Button>
                      {group.currentUserIsAdmin &&
                        list.status === "open" &&
                        !group.archivedAt && (
                          <>
                            <hr className="mt-2 border-border" />
                            <Button
                              className="mt-2 w-full justify-start rounded-lg"
                              onClick={() => {
                                setIsViewSettingsOpen(false)
                                setIsConvertDialogOpen(true)
                              }}
                              type="button"
                              variant="outline"
                            >
                              Typ umwandeln
                            </Button>
                          </>
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="relative mt-4">
            <label className="sr-only" htmlFor="item-search">
              Positionen durchsuchen
            </label>
            <Input
              id="item-search"
              placeholder="Positionen durchsuchen"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 rounded-xl border-border bg-muted px-3 pr-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-1.5 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Suche zurücksetzen"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold">Positionen</h2>
              {items.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatCents(totalCents)}
                  </span>{" "}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canDeleteItems && items.length > 0 && (
                <Button
                  aria-label="Löschen aktivieren"
                  aria-pressed={deleteMode}
                  className={`size-9 shrink-0 rounded-xl p-0 ${
                    deleteMode
                      ? "bg-destructive text-white hover:bg-destructive/90"
                      : "text-destructive"
                  }`}
                  onClick={() => setDeleteMode((current) => !current)}
                  type="button"
                  variant={deleteMode ? "default" : "outline"}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              )}
              {canAddItem && (
                <div className="relative inline-block">
                  <Input
                    ref={receiptInputRef}
                    type="file"
                    id="receipt-scan-input"
                    accept="image/png, image/jpeg, application/pdf"
                    capture="environment"
                    className="hidden"
                    disabled={isScanning}
                    onChange={handleFileSelected}
                  />
                  <Button
                    aria-label="Bon einscannen"
                    className="h-9 rounded-xl bg-brand-primary px-3 text-white hover:bg-brand-primary-hover"
                    disabled={isScanning}
                    onClick={() => receiptInputRef.current?.click()}
                    type="button"
                  >
                    {isScanning ? (
                      <>
                        <LoaderCircle className="size-4 shrink-0 animate-spin" />
                        <span className="hidden sm:inline">
                          Wird gescannt...
                        </span>
                      </>
                    ) : (
                      <>
                        <Camera className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Bon einscannen</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
              {canAddItem && (
                <Button
                  aria-label="Position hinzufügen"
                  className="size-9 shrink-0 rounded-xl bg-brand-primary p-0 text-white hover:bg-brand-primary-hover"
                  onClick={() => openDialog()}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <ExpenseItemDialog
          open={isDialogOpen}
          onClose={closeDialog}
          onSuccess={handleDialogSuccess}
          listId={list.id}
          editingItem={editingItem}
          parentItem={dialogParent}
          items={items}
          members={members}
          groupDefaultSplitRule={groupDefaultSplitRule}
          canEditSplits={canEditSplits}
          currentMemberId={result?.access?.currentMemberId ?? null}
        />
        <DeleteExpenseItemDialog
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onSuccess={() => {
            setDeletingItem(null)
            setSuccessMessage("Die Position wurde gelöscht.")
            setReloadNumber((current) => current + 1)
          }}
        />
        {isConvertDialogOpen && (
          <ConvertExpenseListDialog
            open={isConvertDialogOpen}
            onClose={() => setIsConvertDialogOpen(false)}
            onSuccess={(updatedList) => {
              setIsConvertDialogOpen(false)
              setSuccessMessage("Der Listentyp wurde erfolgreich geändert.")
              onListChange?.(updatedList)
              setReloadNumber((current) => current + 1)
            }}
            list={list}
            isAdmin={Boolean(group.currentUserIsAdmin && !group.archivedAt)}
          />
        )}
        <Toast
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
        <Toast
          message={scanWarningMessage}
          onClose={() => setScanWarningMessage(null)}
          variant="error"
        />
        <Toast
          message={pdfErrorMessage}
          onClose={() => setPdfErrorMessage(null)}
          variant="error"
        />

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {isLoading ? (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              Positionen werden geladen …
            </p>
          ) : errorMessage ? (
            <div
              className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text"
              role="alert"
            >
              <p>{errorMessage}</p>
              <Button
                className="mt-3"
                onClick={() => setReloadNumber((current) => current + 1)}
                variant="outline"
              >
                Erneut versuchen
              </Button>
            </div>
          ) : items.length > 0 ? (
            <ul className="divide-y divide-border">
              {sortedNodes.map((node) => {
                const { item } = node
                const isExpanded = expandedIds.has(item.id)

                return (
                  <li key={item.id}>
                    {renderItemRow(item)}
                    {item.isReceipt && (
                      <div className="pb-3">
                        <Button
                          aria-expanded={isExpanded}
                          aria-label={`Unterpositionen von ${item.name} ${
                            isExpanded ? "ausblenden" : "anzeigen"
                          }`}
                          className="flex h-auto w-full items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground"
                          onClick={() =>
                            setExpandedIds((current) => {
                              const next = new Set(current)
                              if (next.has(item.id)) {
                                next.delete(item.id)
                              } else {
                                next.add(item.id)
                              }
                              return next
                            })
                          }
                          type="button"
                          variant="ghost"
                        >
                          <span>
                            Bon · {node.children.length}{" "}
                            {node.children.length === 1
                              ? "Unterposition"
                              : "Unterpositionen"}
                            {" · "}
                            {node.remainderCents < 0
                              ? `${formatCents(-node.remainderCents)} über der Bon-Summe`
                              : `Rest ${formatCents(node.remainderCents)}`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp aria-hidden="true" className="size-4" />
                          ) : (
                            <ChevronDown
                              aria-hidden="true"
                              className="size-4"
                            />
                          )}
                        </Button>
                        {isExpanded && (
                          <div className="mt-2 ml-3 border-l-2 border-border pl-3">
                            <div className="flex flex-col gap-4 lg:flex-row">
                              <div className="min-w-0 flex-1">
                                <ul className="divide-y divide-border">
                                  {node.children.map((child) => (
                                    <li key={child.id}>
                                      {renderItemRow(child)}
                                    </li>
                                  ))}
                                </ul>
                                {node.remainderCents > 0 && (
                                  <p className="py-2 text-xs text-muted-foreground">
                                    Rest {formatCents(node.remainderCents)} wird
                                    nach Zahler und Verteilung des Bons
                                    verrechnet.
                                  </p>
                                )}
                                {node.remainderCents < 0 && (
                                  <p
                                    className="py-2 text-xs text-danger-text"
                                    role="alert"
                                  >
                                    Die Unterpositionen übersteigen die
                                    Bon-Summe um{" "}
                                    {formatCents(-node.remainderCents)}. Bitte
                                    Positionen oder Bon-Summe korrigieren.
                                  </p>
                                )}
                                {canAddItem && (
                                  <Button
                                    className="my-2 h-8 rounded-lg text-xs"
                                    onClick={() => void openDialog(null, item)}
                                    type="button"
                                    variant="outline"
                                  >
                                    <Plus
                                      aria-hidden="true"
                                      className="size-3.5"
                                    />
                                    Unterposition hinzufügen
                                  </Button>
                                )}
                              </div>
                              <div className="w-full min-w-0 lg:flex-1">
                                <ReceiptPreview itemId={item.id} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted px-5 py-10 text-center">
              <ReceiptText
                aria-hidden="true"
                className="mx-auto mb-2 size-6 text-muted-foreground"
              />
              <p className="font-medium">Noch keine Positionen</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Zu dieser Liste wurden noch keine Positionen erfasst.
              </p>
            </div>
          )}
        </div>

        {!isLoading && !errorMessage && (
          <SettlementSection
            list={list}
            items={items}
            nodes={nodes}
            members={members}
            memberNames={memberNames}
            groupDefaultSplitRule={groupDefaultSplitRule}
            rules={result?.rules}
            rulesErrorMessage={result?.rulesErrorMessage ?? null}
            canCloseList={canCloseList}
            currentMemberId={result?.access?.currentMemberId ?? null}
            isAdmin={group.currentUserIsAdmin}
            isArchived={Boolean(group.archivedAt)}
            onListChange={onListChange}
            onSuccess={setSuccessMessage}
          />
        )}
      </section>
    </>
  )
}

interface GetSortedNodesParams {
  nodes: ItemNode[]
  sortBy: "item_date" | "createdAt"
  searchQuery: string
  memberNames: Map<string, string>
  rules: Record<string, ExpenseSplitRule> | null | undefined
  groupDefaultSplitRule: ExpenseSplitRule
}

function matchesItem(
  item: ExpenseItem,
  query: string,
  memberNames: Map<string, string>,
  rules: Record<string, ExpenseSplitRule> | null | undefined,
  groupDefaultSplitRule: ExpenseSplitRule
): boolean {
  if (!query) return false

  // 1. Bezeichnung
  if (item.name.toLowerCase().includes(query)) return true

  // 2. Ausleger (sichtbar als: "Bezahlt von ...")
  const payerName = (memberNames.get(item.paidByMemberId) ?? "").toLowerCase()
  if (payerName.includes(query)) return true

  // 3. Betrag
  const euroString = (item.amountCents / 100).toFixed(2) // "12.50"
  const euroStringGerman = euroString.replace(".", ",") // "12,50"

  if (
    item.amountCents.toString().includes(query) ||
    euroString.includes(query) ||
    euroStringGerman.includes(query)
  ) {
    return true
  }

  // 4. Nur wenn der Name sichtbar als Zuweisung ("Komplett") rechts steht
  const rule = rules?.[item.id] ?? groupDefaultSplitRule
  if (rule.mode === "complete") {
    const assignedName = (memberNames.get(rule.memberId) ?? "").toLowerCase()
    if (assignedName.includes(query)) return true
  }

  // 5. Datum
  const isoDate = item.item_date || ""

  let germanDate = ""
  if (isoDate.length >= 10) {
    const [year, month, day] = isoDate.substring(0, 10).split("-")
    if (year && month && day) {
      germanDate = `${day}.${month}.${year}`
    }
  }

  if (germanDate.includes(query)) {
    return true
  }

  return false
}

function getSortedNodes({
  nodes,
  sortBy,
  searchQuery,
  memberNames,
  rules,
  groupDefaultSplitRule,
}: GetSortedNodesParams): ItemNode[] {
  // 1. Sortieren
  const sorted = [...nodes].sort((a, b) => {
    if (sortBy === "item_date") {
      if (a.item.item_date !== b.item.item_date) {
        return b.item.item_date.localeCompare(a.item.item_date)
      }
    }
    return b.item.createdAt.localeCompare(a.item.createdAt)
  })

  // 2. Volltext-Filter
  const query = searchQuery.trim().toLowerCase()
  if (!query) return sorted

  return sorted.filter((node) => {
    const mainMatches = matchesItem(
      node.item,
      query,
      memberNames,
      rules,
      groupDefaultSplitRule
    )
    const childMatches = node.children.some((child) =>
      matchesItem(child, query, memberNames, rules, groupDefaultSplitRule)
    )
    return mainMatches || childMatches
  })
}
