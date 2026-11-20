import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { LoaderCircle, X } from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ReceiptPreview } from "@/pages/ExpenseListDetail/ReceiptPreview"
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
  germanToIsoDateTime,
  isoToGermanDateTime,
  todayIsoDate,
} from "@/pages/ExpenseListDetail/ExpenseListDetail"
import type { ExpenseItem, GroupMember } from "@/types/group"

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

const formatGermanDateTimeInput = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 12)

  const day = numbers.slice(0, 2)
  const month = numbers.slice(2, 4)
  const year = numbers.slice(4, 8)
  const hour = numbers.slice(8, 10)
  const minute = numbers.slice(10, 12)

  let result = day

  if (month.length > 0) {
    result += `.${month}`
  }
  if (year.length > 0) {
    result += `.${year}`
  }
  if (hour.length > 0) {
    result += ` ${hour}`
  }
  if (minute.length > 0) {
    result += `:${minute}`
  }

  return result
}

export interface ExpenseItemDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (message: string, parentItemId: string | null) => void
  listId: string
  editingItem: ExpenseItem | null
  parentItem?: ExpenseItem | null
  items: ExpenseItem[]
  members: GroupMember[]
  groupDefaultSplitRule: ExpenseSplitRule
  canEditSplits: boolean
  currentMemberId: string | null
}

export function ExpenseItemDialog({
  open,
  onClose,
  onSuccess,
  listId,
  editingItem,
  parentItem = null,
  items,
  members,
  groupDefaultSplitRule,
  canEditSplits,
  currentMemberId,
}: ExpenseItemDialogProps) {
  const {
    createExpenseItem,
    updateExpenseItem,
    getExpenseItemSplitRule,
  } = useExpenseLists()

  const [itemName, setItemName] = useState("")
  const [amountText, setAmountText] = useState("")
  const [itemDateText, setItemDateText] = useState("")
  const [isReceiptDraft, setIsReceiptDraft] = useState(false)
  const [paidByMemberId, setPaidByMemberId] = useState("")
  const [customSplitMode, setCustomSplitMode] =
    useState<ExpenseSplitRule["mode"]>("equal")
  const [completeMemberId, setCompleteMemberId] = useState("")
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSplitRule, setIsLoadingSplitRule] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const dialogParentId = editingItem ? editingItem.parentItemId : parentItem?.id ?? null
  const dialogParent = parentItem ?? (dialogParentId ? items.find((item) => item.id === dialogParentId) : null)
  const editingHasChildren = editingItem
    ? items.some((item) => item.parentItemId === editingItem.id)
    : false

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members]
  )

  function applySplitDraft(rule: ExpenseSplitRule) {
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
          current || currentMemberId || members[0]?.id || ""
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

  function handlePositionDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatGermanDateTimeInput(e.target.value)
    setItemDateText(formatted)
  }

  function handleSplitInputChange(memberId: string, rawValue: string) {
    setSplitInputs((current) => {
      const next = { ...current, [memberId]: rawValue }
      if (customSplitMode === "percentage" && members.length === 2) {
        const otherMember = members.find((m) => m.id !== memberId)
        if (otherMember) {
          const sanitized = rawValue.trim().replace(/[,.]$/, "")
          const bp = parsePercentageToBasisPoints(sanitized)
          if (bp !== null && bp >= 0 && bp <= 10_000) {
            const otherBp = 10_000 - bp
            next[otherMember.id] = (otherBp / 100).toFixed(2).replace(".", ",")
          }
        }
      }
      return next
    })
  }

  useEffect(() => {
    if (!open) {
      return
    }

    let isCurrent = true
    setItemName(editingItem?.name ?? "")
    setAmountText(
      editingItem
        ? (editingItem.amountCents / 100).toFixed(2).replace(".", ",")
        : ""
    )
    setItemDateText(
      isoToGermanDateTime(editingItem?.item_date ?? todayIsoDate())
    )
    setIsReceiptDraft(editingItem?.isReceipt ?? false)
    setPaidByMemberId(
      editingItem?.paidByMemberId ??
        currentMemberId ??
        members[0]?.id ??
        ""
    )
    setDialogError(null)

    applySplitDraft(groupDefaultSplitRule ?? { mode: "equal" })

    if (editingItem) {
      setIsLoadingSplitRule(true)
      void Promise.resolve(getExpenseItemSplitRule(editingItem.id))
        .then((savedRule) => {
          if (!isCurrent) return
          if (savedRule) {
            applySplitDraft(savedRule)
          }
        })
        .catch((error: unknown) => {
          if (!isCurrent) return
          setDialogError(getActionErrorMessage(error))
        })
        .finally(() => {
          if (!isCurrent) return
          setIsLoadingSplitRule(false)
        })
    }

    return () => {
      isCurrent = false
    }
  }, [
    open,
    editingItem,
    parentItem,
    currentMemberId,
    members,
    groupDefaultSplitRule,
    getExpenseItemSplitRule,
  ])

  const amountForPreview = parseAmountToCents(amountText)
  let previewRule: ExpenseSplitRule | null = null
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

  const isPercentageSumValid = useMemo(() => {
    if (!canEditSplits || customSplitMode !== "percentage") {
      return true
    }
    const shares = members.map((m) =>
      parsePercentageToBasisPoints(splitInputs[m.id] ?? "")
    )
    if (shares.some((bp) => bp === null)) {
      return false
    }
    const sum = shares.reduce((acc, bp) => (acc ?? 0) + (bp ?? 0), 0)
    return sum === 10_000
  }, [canEditSplits, customSplitMode, members, splitInputs])

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

    const itemDateIso = itemDateText
      ? germanToIsoDateTime(itemDateText)
      : null
    if (itemDateText && !itemDateIso) {
      setDialogError(
        "Bitte ein gültiges Datum im Format TT.MM.JJJJ HH:MM eingeben."
      )
      return
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
          item_date: itemDateIso,
        })
      } else {
        await createExpenseItem(listId, {
          name,
          amountCents,
          paidByMemberId,
          splitRule,
          isReceipt: dialogParentId ? false : isReceiptDraft,
          parentItemId: dialogParentId,
          item_date: itemDateIso,
        })
      }
      onSuccess(
        editingItem
          ? "Die Position wurde aktualisiert."
          : "Die Position wurde hinzugefügt.",
        dialogParentId
      )
    } catch (error) {
      setDialogError(getActionErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isSaving && !isLoadingSplitRule) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md md:max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-lg font-semibold">
            {dialogParentId
              ? editingItem
                ? "Unterposition bearbeiten"
                : "Unterposition hinzufügen"
              : editingItem
                ? "Position bearbeiten"
                : "Position hinzufügen"}
          </DialogTitle>
          <Button
            aria-label="Dialog schließen"
            className="size-8 shrink-0 rounded-lg p-0 text-muted-foreground"
            disabled={isSaving || isLoadingSplitRule}
            onClick={onClose}
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="item-name">
              Bezeichnung
            </label>
            <Input
              autoComplete="one-time-code"
              data-roboform-disable="true"
              autoFocus
              className="h-11 rounded-xl border-border bg-card px-4 text-sm"
              id="item-name"
              maxLength={120}
              onChange={(event) => setItemName(event.target.value)}
              value={itemName}
            />
          </div>
          <div className="flex flex-row gap-1">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium" htmlFor="item-amount">
                Betrag in €
              </label>
              <Input
                autoComplete="one-time-code"
                data-roboform-disable="true"
                className="h-11 rounded-xl border-border bg-card px-4 text-sm"
                id="item-amount"
                inputMode="decimal"
                onChange={(event) => setAmountText(event.target.value)}
                placeholder="12,50"
                value={amountText}
              />
            </div>
            {!dialogParentId && (
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium" htmlFor="item-date">
                  Datum
                </label>
                <Input
                  className="h-11 rounded-xl border-border bg-card px-4 text-sm"
                  id="item-date"
                  onChange={handlePositionDateChange}
                  type="text"
                  inputMode="numeric"
                  placeholder="TT.MM.JJJJ"
                  value={itemDateText}
                />
              </div>
            )}
          </div>
          <div className="flex flex-row gap-1">
            {dialogParent ? (
              <p className="text-sm text-muted-foreground">
                Teil des Bons „{dialogParent.name}“. Was nicht als
                Unterposition erfasst ist, wird nach Zahler und Verteilung
                des Bons verrechnet.
              </p>
            ) : (
              <div className="w-1/2 space-y-1.5">
                <label className="text-sm font-medium" htmlFor="item-type">
                  Art der Position
                </label>
                <SelectField
                  disabled={editingHasChildren}
                  id="item-type"
                  onValueChange={(value) =>
                    setIsReceiptDraft(value === "receipt")
                  }
                  value={isReceiptDraft ? "receipt" : "single"}
                  options={[
                    { value: "single", label: "Einzelposition" },
                    {
                      value: "receipt",
                      label: "Bon (Summe mit Unterpositionen)",
                    },
                  ]}
                />
                {editingHasChildren && (
                  <p className="text-xs text-muted-foreground">
                    Ein Bon mit Unterpositionen kann nicht zur
                    Einzelposition werden.
                  </p>
                )}
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium" htmlFor="item-payer">
                Bezahlt von
              </label>
              <SelectField
                id="item-payer"
                onValueChange={setPaidByMemberId}
                value={paidByMemberId}
                options={members.map((member) => ({
                  value: member.id,
                  label: member.displayName,
                }))}
              />
            </div>
          </div>
          <hr className="border-border" />
          <section aria-labelledby="item-split-title" className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold" id="item-split-title">
                Verteilung
              </h3>
              <p
                aria-live="polite"
                className="mt-1 text-xs text-muted-foreground"
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
                <SelectField
                  id="item-split-mode"
                  onValueChange={changeCustomSplitMode}
                  value={customSplitMode}
                  options={[
                    {
                      value: "equal",
                      label: "Gleichmäßig auf alle Gruppenmitglieder",
                    },
                    {
                      value: "complete",
                      label: "Komplett für eine Person",
                    },
                    { value: "percentage", label: "Prozentual" },
                    { value: "fixed", label: "Fester Betrag" },
                  ]}
                />
                {customSplitMode === "equal" ||
                customSplitMode === "complete" ? (
                  members.length <= 4 ? (
                    <fieldset className="space-y-1.5">
                      <legend className="text-sm font-medium">
                        Übernimmt den gesamten Betrag
                      </legend>
                      <RadioGroup
                        aria-label="Übernimmt den gesamten Betrag"
                        className="grid grid-cols-2 gap-2"
                        name="item-split-member"
                        onValueChange={(value: string) => {
                          changeCustomSplitMode("complete")
                          setCompleteMemberId(value)
                        }}
                        value={
                          customSplitMode === "complete"
                            ? completeMemberId
                            : ""
                        }
                      >
                        {members.map((member) => (
                          <label
                            className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                            htmlFor={`item-split-member-${member.id}`}
                            key={member.id}
                          >
                            <RadioGroupItem
                              id={`item-split-member-${member.id}`}
                              value={member.id}
                            />
                            <span className="truncate">
                              {member.displayName}
                            </span>
                          </label>
                        ))}
                      </RadioGroup>
                    </fieldset>
                  ) : (
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="item-split-member"
                      >
                        Übernimmt den gesamten Betrag
                      </label>
                      <SelectField
                        id="item-split-member"
                        onValueChange={(value) => {
                          changeCustomSplitMode("complete")
                          setCompleteMemberId(value)
                        }}
                        placeholder="Person wählen"
                        value={
                          customSplitMode === "complete"
                            ? completeMemberId
                            : ""
                        }
                        options={members.map((member) => ({
                          value: member.id,
                          label: member.displayName,
                        }))}
                      />
                    </div>
                  )
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
                            className="h-10 rounded-xl border-border px-3 text-right text-sm"
                            id={`split-${member.id}`}
                            inputMode="decimal"
                            onChange={(event) =>
                              handleSplitInputChange(
                                member.id,
                                event.target.value
                              )
                            }
                            placeholder={
                              customSplitMode === "percentage"
                                ? "0,00"
                                : "0,00"
                            }
                            value={splitInputs[member.id] ?? ""}
                          />
                          <span className="text-sm text-muted-foreground">
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
              <p className="text-sm text-danger-text" role="alert">
                {splitPreviewError}
              </p>
            )}
            {splitPreview && (
              <ul
                aria-label="Vorschau der Verteilung"
                className="space-y-1 rounded-xl bg-muted p-3 text-sm"
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
          {(editingItem || dialogParentId) && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-sm font-medium">Beleg</p>
              <ReceiptPreview
                fallbackItemId={editingItem?.parentItemId ?? dialogParentId}
                itemId={editingItem?.id}
              />
            </div>
          )}
          {dialogError && (
            <p className="text-sm text-danger-text" role="alert">
              {dialogError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              disabled={isSaving || isLoadingSplitRule}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
              disabled={isSaving || isLoadingSplitRule || !isPercentageSumValid}
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
      </DialogContent>
    </Dialog>
  )
}
