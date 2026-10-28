import { useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react"
import {
  useExpenseLists,
  type ExpenseItemAccess,
} from "@/components/contexts/ExpenseListContext"
import { ExpenseListStatusBadge } from "@/components/ExpenseListStatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import {
  calculateExpenseSplit,
  createEqualPercentageDrafts,
  parseNonNegativeCents,
  parsePercentageToBasisPoints,
  type ExpenseSplitRule,
} from "@/lib/expenseSplit"
import { getActionErrorMessage } from "@/lib/errorMessage"
import { formatCents, parseAmountToCents } from "@/lib/money"
import {
  buildItemNodes,
  sumTopLevelCents,
  toSettlementItems,
} from "@/lib/itemHierarchy"
import { calculateSettlement, type Settlement } from "@/lib/settlement"
import type { ExpenseItem, ExpenseList, Group } from "@/types/group"

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

function areSplitRulesEqual(first: ExpenseSplitRule, second: ExpenseSplitRule) {
  if (first.mode !== second.mode) {
    return false
  }

  if (first.mode === "equal" && second.mode === "equal") {
    return true
  }
  if (first.mode === "complete" && second.mode === "complete") {
    return first.memberId === second.memberId
  }
  if (first.mode === "percentage" && second.mode === "percentage") {
    const firstShares = [...first.shares].sort((a, b) =>
      a.memberId.localeCompare(b.memberId)
    )
    const secondShares = [...second.shares].sort((a, b) =>
      a.memberId.localeCompare(b.memberId)
    )
    return (
      firstShares.length === secondShares.length &&
      firstShares.every(
        (share, index) =>
          share.memberId === secondShares[index].memberId &&
          share.basisPoints === secondShares[index].basisPoints
      )
    )
  }
  if (first.mode === "fixed" && second.mode === "fixed") {
    const firstShares = [...first.shares].sort((a, b) =>
      a.memberId.localeCompare(b.memberId)
    )
    const secondShares = [...second.shares].sort((a, b) =>
      a.memberId.localeCompare(b.memberId)
    )
    return (
      firstShares.length === secondShares.length &&
      firstShares.every(
        (share, index) =>
          share.memberId === secondShares[index].memberId &&
          share.amountCents === secondShares[index].amountCents
      )
    )
  }

  return false
}

function splitRuleLabel(rule: ExpenseSplitRule) {
  switch (rule.mode) {
    case "equal":
      return "Gleichmäßig auf alle Gruppenmitglieder"
    case "complete":
      return "Komplett für eine Person"
    case "percentage":
      return "Prozentual"
    case "fixed":
      return "Fester Betrag"
  }
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
      const share = rule.shares.find((entry) => entry.memberId === currentMemberId)
      const percent = (share?.basisPoints ?? 0) / 100
      return `${percent.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
    }
    case "fixed": {
      const share = rule.shares.find((entry) => entry.memberId === currentMemberId)
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
    getExpenseItemSplitRule,
    getExpenseListSplitRules,
    getItemAccess,
    completeExpenseList,
    createExpenseItem,
    updateExpenseItem,
    deleteExpenseItem,
  } = useExpenseLists()
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ItemsResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null)
  const [itemName, setItemName] = useState("")
  const [amountText, setAmountText] = useState("")
  const [paidByMemberId, setPaidByMemberId] = useState("")
  const [customSplitMode, setCustomSplitMode] =
    useState<ExpenseSplitRule["mode"]>("equal")
  const [completeMemberId, setCompleteMemberId] = useState("")
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSplitRule, setIsLoadingSplitRule] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<ExpenseItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSettlementOpen, setIsSettlementOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

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
  const memberNames = new Map(
    (result?.access?.members ?? []).map((member) => [
      member.id,
      member.displayName,
    ])
  )
  const members = result?.access?.members ?? []
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
  const [isReceiptDraft, setIsReceiptDraft] = useState(false)
  const [newParentId, setNewParentId] = useState<string | null>(null)
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
  const groupDefaultSplitRule = result?.access?.groupDefaultSplitRule ?? {
    mode: "equal" as const,
  }

  const amountForPreview = parseAmountToCents(amountText)
  const nodes = buildItemNodes(items)
  const totalCents = sumTopLevelCents(nodes)
  const dialogParentId = editingItem ? editingItem.parentItemId : newParentId
  const dialogParent = items.find((item) => item.id === dialogParentId)
  const editingHasChildren = editingItem
    ? items.some((item) => item.parentItemId === editingItem.id)
    : false

  function renderItemRow(item: ExpenseItem) {
    const splitHint = getSplitHint(
      result?.rules?.[item.id] ?? groupDefaultSplitRule,
      result?.access?.currentMemberId ?? null,
      memberNames
    )

    return (
      <div
        className={`relative flex items-start justify-between gap-3 py-3 ${
          canDeleteItems && deleteMode ? "pr-10" : ""
        }`}
      >
        <div className="min-w-0">
          <p className="font-medium break-words">
            {item.name}
            {item.isReceipt && (
              <span className="ml-2 rounded-full bg-[#edf3e9] px-2 py-0.5 align-middle text-xs font-medium text-[#31563e]">
                Bon
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-[#72766f]">
            Bezahlt von {memberNames.get(item.paidByMemberId) ?? "Unbekannt"}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <p className="font-semibold">{formatCents(item.amountCents)}</p>
            {splitHint && (
              <p className="mt-0.5 text-xs text-[#72766f]">{splitHint}</p>
            )}
          </div>
          {canEditItems && (
            <Button
              aria-label={`Position bearbeiten: ${item.name}`}
              className="size-8 p-0 text-[#555b53]"
              onClick={() => void openDialog(item)}
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
          )}
          {canDeleteItems && deleteMode && (
            <Button
              aria-label={`Position löschen: ${item.name}`}
              className="absolute top-2 right-0 size-8 p-0 text-red-700 hover:text-red-800"
              onClick={(event) => {
                event.stopPropagation()
                setDeletingItem(item)
                setDeleteError(null)
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

  let settlement: Settlement | null = null
  let settlementError: string | null = result?.rulesErrorMessage ?? null
  if (!isLoading && !errorMessage && result?.rules && !settlementError) {
    try {
      settlement = calculateSettlement(
        toSettlementItems(nodes),
        result.rules,
        members.map((member) => member.id),
        groupDefaultSplitRule
      )
    } catch (error) {
      settlementError = getActionErrorMessage(error)
    }
  }
  const topCreditor = settlement?.balances
    .filter((balance) => balance.balanceCents > 0)
    .sort(
      (a, b) =>
        b.balanceCents - a.balanceCents || a.memberId.localeCompare(b.memberId)
    )[0]
  const canCloseList =
    Boolean(result?.access?.canCloseLists) &&
    list.status === "open" &&
    !group.archivedAt
  let previewRule: ExpenseSplitRule | null
  if (customSplitMode === "equal") {
    previewRule = { mode: "equal" }
  } else if (customSplitMode === "complete") {
    previewRule = { mode: "complete", memberId: completeMemberId }
  } else if (customSplitMode === "percentage") {
    const shares = members.map((member) => ({
      memberId: member.id,
      basisPoints: parsePercentageToBasisPoints(splitInputs[member.id] ?? ""),
    }))
    previewRule = shares.some((share) => share.basisPoints === null)
      ? null
      : {
          mode: "percentage",
          shares: shares.filter(
            (share): share is { memberId: string; basisPoints: number } =>
              share.basisPoints !== null
          ),
        }
  } else {
    const shares = members.map((member) => ({
      memberId: member.id,
      amountCents: parseNonNegativeCents(splitInputs[member.id] ?? ""),
    }))
    previewRule = shares.some((share) => share.amountCents === null)
      ? null
      : {
          mode: "fixed",
          shares: shares.filter(
            (share): share is { memberId: string; amountCents: number } =>
              share.amountCents !== null
          ),
        }
  }
  const isGroupDistribution =
    previewRule !== null &&
    areSplitRulesEqual(previewRule, groupDefaultSplitRule)
  let splitPreview: ReturnType<typeof calculateExpenseSplit> | null = null
  let splitPreviewError: string | null = null
  if (amountForPreview !== null && previewRule && members.length > 0) {
    try {
      splitPreview = calculateExpenseSplit(
        amountForPreview,
        members.map((member) => member.id),
        previewRule,
        groupDefaultSplitRule
      )
    } catch (error) {
      splitPreviewError = getActionErrorMessage(error)
    }
  }

  async function openDialog(
    item: ExpenseItem | null = null,
    parent: ExpenseItem | null = null
  ) {
    setEditingItem(item)
    setIsReceiptDraft(item?.isReceipt ?? false)
    setNewParentId(parent?.id ?? null)
    setItemName(item?.name ?? "")
    setAmountText(
      item ? (item.amountCents / 100).toFixed(2).replace(".", ",") : ""
    )
    setPaidByMemberId(
      item?.paidByMemberId ??
        result?.access?.currentMemberId ??
        members[0]?.id ??
        ""
    )
    setDialogError(null)
    setIsDialogOpen(true)
    setSplitDraft(result?.access?.groupDefaultSplitRule ?? { mode: "equal" })
    if (item) {
      setIsLoadingSplitRule(true)
      try {
        const savedRule = await getExpenseItemSplitRule(item.id)
        setSplitDraft(savedRule)
      } catch (error) {
        setDialogError(getActionErrorMessage(error))
      } finally {
        setIsLoadingSplitRule(false)
      }
    }
  }

  function setSplitDraft(rule: ExpenseSplitRule) {
    setCustomSplitMode(rule.mode)
    if (rule.mode === "complete") {
      setCompleteMemberId(rule.memberId)
    } else if (rule.mode === "percentage") {
      const shares = new Map(
        rule.shares.map((share) => [share.memberId, share.basisPoints])
      )
      setSplitInputs(
        Object.fromEntries(
          members.map((member) => [
            member.id,
            ((shares.get(member.id) ?? 0) / 100).toFixed(2).replace(".", ","),
          ])
        )
      )
    } else if (rule.mode === "fixed") {
      const shares = new Map(
        rule.shares.map((share) => [share.memberId, share.amountCents])
      )
      setSplitInputs(
        Object.fromEntries(
          members.map((member) => [
            member.id,
            ((shares.get(member.id) ?? 0) / 100).toFixed(2).replace(".", ","),
          ])
        )
      )
    } else {
      setSplitInputs({})
    }
  }

  function changeCustomSplitMode(mode: ExpenseSplitRule["mode"]) {
    setCustomSplitMode(mode)
    if (mode === "complete") {
      setCompleteMemberId(
        (current) =>
          current || result?.access?.currentMemberId || members[0]?.id || ""
      )
    } else if (mode === "percentage") {
      setSplitInputs(
        createEqualPercentageDrafts(members.map((member) => member.id))
      )
    } else if (mode === "fixed") {
      setSplitInputs(
        Object.fromEntries(members.map((member) => [member.id, "0,00"]))
      )
    } else {
      setSplitInputs({})
    }
  }

  function closeDialog() {
    if (!isSaving) {
      setIsDialogOpen(false)
    }
  }

  function closeDeleteDialog() {
    if (!isDeleting) {
      setDeletingItem(null)
      setDeleteError(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = itemName.trim()
    const amountCents = parseAmountToCents(amountText)

    if (!name) {
      setDialogError("Bitte eine Bezeichnung eingeben.")
      return
    }
    if (amountCents === null) {
      setDialogError("Bitte einen gültigen Betrag eingeben, z. B. 12,50.")
      return
    }
    if (!paidByMemberId) {
      setDialogError("Bitte auswählen, wer bezahlt hat.")
      return
    }

    let splitRule: ExpenseSplitRule | null = null
    if (canEditSplits) {
      if (customSplitMode === "equal") {
        splitRule = { mode: "equal" }
      } else if (customSplitMode === "complete") {
        splitRule = { mode: "complete", memberId: completeMemberId }
      } else if (customSplitMode === "percentage") {
        const shares = members.map((member) => ({
          memberId: member.id,
          basisPoints: parsePercentageToBasisPoints(
            splitInputs[member.id] ?? ""
          ),
        }))
        if (shares.some((share) => share.basisPoints === null)) {
          setDialogError(
            "Bitte gültige Prozentanteile mit höchstens zwei Nachkommastellen eingeben."
          )
          return
        }
        splitRule = {
          mode: "percentage",
          shares: shares.filter(
            (share): share is { memberId: string; basisPoints: number } =>
              share.basisPoints !== null
          ),
        }
      } else {
        const shares = members.map((member) => ({
          memberId: member.id,
          amountCents: parseNonNegativeCents(splitInputs[member.id] ?? ""),
        }))
        if (shares.some((share) => share.amountCents === null)) {
          setDialogError("Bitte gültige Festbeträge in Euro eingeben.")
          return
        }
        splitRule = {
          mode: "fixed",
          shares: shares.filter(
            (share): share is { memberId: string; amountCents: number } =>
              share.amountCents !== null
          ),
        }
      }

      try {
        calculateExpenseSplit(
          amountCents,
          members.map((member) => member.id),
          splitRule,
          groupDefaultSplitRule
        )
        if (areSplitRulesEqual(splitRule, groupDefaultSplitRule)) {
          splitRule = editingItem ? groupDefaultSplitRule : null
        }
      } catch (error) {
        setDialogError(getActionErrorMessage(error))
        return
      }
    }

    setIsSaving(true)
    setDialogError(null)
    try {
      if (editingItem) {
        await updateExpenseItem(editingItem.id, {
          name,
          amountCents,
          paidByMemberId,
          splitRule,
          isReceipt: dialogParentId ? false : isReceiptDraft,
        })
      } else {
        await createExpenseItem(list.id, {
          name,
          amountCents,
          paidByMemberId,
          splitRule,
          isReceipt: dialogParentId ? false : isReceiptDraft,
          parentItemId: dialogParentId,
        })
      }
      setIsDialogOpen(false)
      setEditingItem(null)
      if (dialogParentId) {
        setExpandedIds((current) => new Set(current).add(dialogParentId))
      }
      setSuccessMessage(
        editingItem
          ? "Die Position wurde aktualisiert."
          : "Die Position wurde hinzugefügt."
      )
      setReloadNumber((current) => current + 1)
    } catch (error) {
      setDialogError(getActionErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCloseList() {
    if (
      !window.confirm(
        `Liste „${list.name}“ abschließen? Danach kann sie nicht mehr als offen geführt werden.`
      )
    ) {
      return
    }

    setIsClosing(true)
    setCloseError(null)
    try {
      await completeExpenseList(list.id)
      setSuccessMessage("Die Ausgabenliste wurde abgeschlossen.")
      onListChange?.({
        ...list,
        status: "completed",
        completedAt: new Date().toISOString(),
      })
    } catch (error) {
      setCloseError(getActionErrorMessage(error))
    } finally {
      setIsClosing(false)
    }
  }

  async function handleDelete() {
    if (!deletingItem) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteExpenseItem(deletingItem.id)
      setDeletingItem(null)
      setSuccessMessage("Die Position wurde gelöscht.")
      setReloadNumber((current) => current + 1)
    } catch (error) {
      setDeleteError(getActionErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[#e8ebe5] bg-white p-6 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-10">
      <div className="shrink-0">
        <Button
          className="mb-8 h-auto p-0 text-sm font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e]"
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zu den Ausgabenlisten
        </Button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[#72766f]">{group.name}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] break-words">
              {list.name}
            </h1>
            <p className="mt-1 text-xs text-[#72766f]">
              Erstellt am {dateFormat.format(new Date(list.createdAt))}
              {list.completedAt &&
                ` · Erledigt am ${dateFormat.format(new Date(list.completedAt))}`}
              {list.paidAt &&
                ` · Bezahlt am ${dateFormat.format(new Date(list.paidAt))}`}
            </p>
          </div>
          <ExpenseListStatusBadge status={list.status} />
        </div>

        <div className="mt-7 flex items-baseline justify-between gap-3 border-b border-[#eef0eb] pb-4">
          <h2 className="font-semibold">Positionen</h2>
          {items.length > 0 && (
            <p className="text-sm text-[#72766f]">
              Summe{" "}
              <span className="font-semibold text-[#20241f]">
                {formatCents(totalCents)}
              </span>
            </p>
          )}
          {canDeleteItems && items.length > 0 && (
            <Button
              aria-label="Löschen aktivieren"
              aria-pressed={deleteMode}
              className={`size-9 shrink-0 rounded-xl p-0 ${
                deleteMode
                  ? "bg-red-700 text-white hover:bg-red-800"
                  : "text-red-700"
              }`}
              onClick={() => setDeleteMode((current) => !current)}
              type="button"
              variant={deleteMode ? "default" : "outline"}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          )}
          {canAddItem && (
            <Button
              aria-label="Position hinzufügen"
              className="size-9 shrink-0 rounded-xl bg-[#1f3b2d] p-0 text-white hover:bg-[#294b38]"
              onClick={() => openDialog()}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {isDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeDialog()
            }
          }}
        >
          <div
            aria-labelledby="add-item-title"
            aria-modal="true"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold" id="add-item-title">
                {dialogParentId
                  ? editingItem
                    ? "Unterposition bearbeiten"
                    : "Unterposition hinzufügen"
                  : editingItem
                    ? "Position bearbeiten"
                    : "Position hinzufügen"}
              </h2>
              <Button
                aria-label="Dialog schließen"
                className="size-8 shrink-0 rounded-lg p-0 text-[#555b53]"
                disabled={isSaving || isLoadingSplitRule}
                onClick={closeDialog}
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <form
              className="mt-5 space-y-4"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              {dialogParent ? (
                <p className="text-sm text-[#72766f]">
                  Teil des Bons „{dialogParent.name}“. Was nicht als
                  Unterposition erfasst ist, wird nach Zahler und Verteilung des
                  Bons verrechnet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="item-type">
                    Art der Position
                  </label>
                  <select
                    className="h-11 w-full rounded-xl border border-[#e4e7e1] bg-white px-3 text-sm"
                    disabled={editingHasChildren}
                    id="item-type"
                    onChange={(event) =>
                      setIsReceiptDraft(event.target.value === "receipt")
                    }
                    value={isReceiptDraft ? "receipt" : "single"}
                  >
                    <option value="single">Einzelposition</option>
                    <option value="receipt">
                      Bon (Summe mit Unterpositionen)
                    </option>
                  </select>
                  {editingHasChildren && (
                    <p className="text-xs text-[#72766f]">
                      Ein Bon mit Unterpositionen kann nicht zur Einzelposition
                      werden.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="item-name">
                  Bezeichnung
                </label>
                <Input
                  autoComplete="off"
                  autoFocus
                  className="h-11 rounded-xl border-[#e4e7e1] bg-white px-4 text-sm"
                  id="item-name"
                  maxLength={120}
                  onChange={(event) => setItemName(event.target.value)}
                  value={itemName}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="item-amount">
                  Betrag in Euro
                </label>
                <Input
                  autoComplete="off"
                  className="h-11 rounded-xl border-[#e4e7e1] bg-white px-4 text-sm"
                  id="item-amount"
                  inputMode="decimal"
                  onChange={(event) => setAmountText(event.target.value)}
                  placeholder="12,50"
                  value={amountText}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="item-payer">
                  Bezahlt von
                </label>
                <select
                  className="h-11 w-full rounded-xl border border-[#e4e7e1] bg-white px-3 text-sm"
                  id="item-payer"
                  onChange={(event) => setPaidByMemberId(event.target.value)}
                  value={paidByMemberId}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <hr className="border-[#e8ebe5]" />
              <section aria-labelledby="item-split-title" className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold" id="item-split-title">
                    Verteilung
                  </h3>
                  <p
                    aria-live="polite"
                    className="mt-1 text-xs text-[#72766f]"
                    role="status"
                  >
                    {isGroupDistribution
                      ? "Gruppenverteilung"
                      : "Individuelle Verteilung"}
                    {" · Gruppenstandard: "}
                    {splitRuleLabel(groupDefaultSplitRule)}
                  </p>
                </div>
                {canEditSplits && (
                  <>
                    <label className="sr-only" htmlFor="item-split-mode">
                      Aufteilungsmodus
                    </label>
                    <select
                      className="h-11 w-full rounded-xl border border-[#e4e7e1] bg-white px-3 text-sm"
                      id="item-split-mode"
                      onChange={(event) =>
                        changeCustomSplitMode(
                          event.target.value as
                            "complete" | "percentage" | "fixed"
                        )
                      }
                      value={customSplitMode}
                    >
                      <option value="equal">
                        Gleichmäßig auf alle Gruppenmitglieder
                      </option>
                      <option value="complete">Komplett für eine Person</option>
                      <option value="percentage">Prozentual</option>
                      <option value="fixed">Fester Betrag</option>
                    </select>
                    {customSplitMode === "complete" ? (
                      <div className="space-y-1.5">
                        <label
                          className="text-sm font-medium"
                          htmlFor="item-split-member"
                        >
                          Übernimmt den gesamten Betrag
                        </label>
                        <select
                          className="h-11 w-full rounded-xl border border-[#e4e7e1] bg-white px-3 text-sm"
                          id="item-split-member"
                          onChange={(event) =>
                            setCompleteMemberId(event.target.value)
                          }
                          value={completeMemberId}
                        >
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            className="flex items-center justify-between gap-3"
                            key={member.id}
                          >
                            <label
                              className="min-w-0 flex-1 truncate text-sm"
                              htmlFor={`split-${member.id}`}
                            >
                              {member.displayName}
                            </label>
                            <div className="flex w-36 shrink-0 items-center gap-2">
                              <Input
                                className="h-10 rounded-xl border-[#e4e7e1] px-3 text-right text-sm"
                                id={`split-${member.id}`}
                                inputMode="decimal"
                                onChange={(event) =>
                                  setSplitInputs((current) => ({
                                    ...current,
                                    [member.id]: event.target.value,
                                  }))
                                }
                                placeholder={
                                  customSplitMode === "percentage"
                                    ? "0,00"
                                    : "0,00"
                                }
                                value={splitInputs[member.id] ?? ""}
                              />
                              <span className="text-sm text-[#72766f]">
                                {customSplitMode === "percentage" ? "%" : "€"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {splitPreviewError && (
                  <p className="text-sm text-red-800" role="alert">
                    {splitPreviewError}
                  </p>
                )}
                {splitPreview && (
                  <ul
                    aria-label="Vorschau der Verteilung"
                    className="space-y-1 rounded-xl bg-[#fafbf9] p-3 text-sm"
                  >
                    {splitPreview.map((allocation) => (
                      <li
                        className="flex justify-between gap-3"
                        key={allocation.memberId}
                      >
                        <span>
                          {memberNames.get(allocation.memberId) ?? "Unbekannt"}
                        </span>
                        <span className="font-medium">
                          {formatCents(allocation.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {dialogError && (
                <p className="text-sm text-red-800" role="alert">
                  {dialogError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  disabled={isSaving || isLoadingSplitRule}
                  onClick={closeDialog}
                  type="button"
                  variant="outline"
                >
                  Abbrechen
                </Button>
                <Button
                  className="rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
                  disabled={isSaving || isLoadingSplitRule}
                  type="submit"
                >
                  {isSaving && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  )}
                  {isSaving
                    ? "Speichert ..."
                    : editingItem
                      ? "Speichern"
                      : "Hinzufügen"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deletingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeDeleteDialog()
            }
          }}
        >
          <div
            aria-labelledby="delete-item-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="alertdialog"
          >
            <h2 className="text-lg font-semibold" id="delete-item-title">
              Position löschen?
            </h2>
            <p className="mt-2 text-sm text-[#555b53]">
              „{deletingItem.name}“ wird dauerhaft aus dieser Liste entfernt.
            </p>
            {deleteError && (
              <p className="mt-3 text-sm text-red-800" role="alert">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={isDeleting}
                onClick={closeDeleteDialog}
                type="button"
                variant="outline"
              >
                Abbrechen
              </Button>
              <Button
                className="bg-red-700 text-white hover:bg-red-800"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
                type="button"
              >
                {isDeleting && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                {isDeleting ? "Löscht ..." : "Löschen"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <Toast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div className="mt-4 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          <p
            className="flex items-center gap-2 text-sm text-[#72766f]"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Positionen werden geladen …
          </p>
        ) : errorMessage ? (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
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
          <ul className="divide-y divide-[#eef0eb]">
            {nodes.map((node) => {
              const { item } = node
              const isExpanded = expandedIds.has(item.id)

              return (
                <li key={item.id}>
                  {renderItemRow(item)}
                  {item.isReceipt && (
                    <div className="pb-3">
                      <button
                        aria-expanded={isExpanded}
                        aria-label={`Unterpositionen von ${item.name} ${
                          isExpanded ? "ausblenden" : "anzeigen"
                        }`}
                        className="flex w-full items-center justify-between gap-2 rounded-lg bg-[#fafbf9] px-3 py-2 text-left text-xs text-[#555b53]"
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
                          <ChevronDown aria-hidden="true" className="size-4" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 ml-3 border-l-2 border-[#e4e7e1] pl-3">
                          <ul className="divide-y divide-[#eef0eb]">
                            {node.children.map((child) => (
                              <li key={child.id}>{renderItemRow(child)}</li>
                            ))}
                          </ul>
                          {node.remainderCents > 0 && (
                            <p className="py-2 text-xs text-[#72766f]">
                              Rest {formatCents(node.remainderCents)} wird nach
                              Zahler und Verteilung des Bons verrechnet.
                            </p>
                          )}
                          {node.remainderCents < 0 && (
                            <p
                              className="py-2 text-xs text-red-800"
                              role="alert"
                            >
                              Die Unterpositionen übersteigen die Bon-Summe um{" "}
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
                              <Plus aria-hidden="true" className="size-3.5" />
                              Unterposition hinzufügen
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d7ded3] bg-[#fafbf9] px-5 py-10 text-center">
            <ReceiptText
              aria-hidden="true"
              className="mx-auto mb-2 size-6 text-[#72766f]"
            />
            <p className="font-medium">Noch keine Positionen</p>
            <p className="mt-1 text-sm text-[#72766f]">
              Zu dieser Liste wurden noch keine Positionen erfasst.
            </p>
          </div>
        )}
      </div>

      {!isLoading && !errorMessage && (
        <section
          aria-label="Abrechnung"
          className="mt-4 shrink-0 border-t border-[#eef0eb] pt-3"
        >
          <button
            aria-controls="settlement-details"
            aria-expanded={isSettlementOpen}
            className="flex w-full items-center justify-between gap-3 rounded-xl py-1 text-left text-sm"
            onClick={() => setIsSettlementOpen((current) => !current)}
            type="button"
          >
            <span className="min-w-0 font-medium">
              {settlementError
                ? "Abrechnung nicht verfügbar"
                : !settlement || items.length === 0
                  ? "Noch nichts abzurechnen"
                  : topCreditor
                    ? `${memberNames.get(topCreditor.memberId) ?? "Unbekannt"} bekommt am meisten zurück: ${formatCents(topCreditor.balanceCents)}`
                    : "Alles ausgeglichen"}
            </span>
            {isSettlementOpen ? (
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <ChevronUp aria-hidden="true" className="size-4 shrink-0" />
            )}
          </button>
          {isSettlementOpen && (
            <div
              className="mt-3 max-h-64 space-y-3 overflow-y-auto"
              id="settlement-details"
            >
              {settlementError ? (
                <p className="text-sm text-red-800" role="alert">
                  {settlementError}
                </p>
              ) : settlement && settlement.transfers.length > 0 ? (
                <ul
                  aria-label="Erstattungen"
                  className="space-y-1.5 rounded-xl bg-[#fafbf9] p-3 text-sm"
                >
                  {settlement.transfers.map((transfer) => (
                    <li key={`${transfer.fromMemberId}-${transfer.toMemberId}`}>
                      <span className="font-medium">
                        {memberNames.get(transfer.toMemberId) ?? "Unbekannt"}
                      </span>{" "}
                      bekommt{" "}
                      <span className="font-semibold">
                        {formatCents(transfer.amountCents)}
                      </span>{" "}
                      von{" "}
                      <span className="font-medium">
                        {memberNames.get(transfer.fromMemberId) ?? "Unbekannt"}
                      </span>{" "}
                      zurück
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#72766f]">
                  Es sind keine Erstattungen nötig.
                </p>
              )}
              {closeError && (
                <p className="text-sm text-red-800" role="alert">
                  {closeError}
                </p>
              )}
              {canCloseList && (
                <div className="flex justify-end">
                  <Button
                    className="rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
                    disabled={isClosing || Boolean(settlementError)}
                    onClick={() => void handleCloseList()}
                    type="button"
                  >
                    {isClosing && (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    )}
                    Abschluss
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  )
}
