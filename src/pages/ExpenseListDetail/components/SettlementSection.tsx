import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { getActionErrorMessage } from "@/lib/errorMessage"
import { toSettlementItems, type ItemNode } from "@/lib/itemHierarchy"
import { formatCents } from "@/lib/money"
import { calculateSettlement, type Settlement } from "@/lib/settlement"
import type { ExpenseSplitRule } from "@/lib/expenseSplit"
import type {
  ExpenseItem,
  ExpenseList,
  ExpenseListPayment,
  GroupMember,
} from "@/types/group"

export interface SettlementSectionProps {
  list: ExpenseList
  items: ExpenseItem[]
  nodes: ItemNode[]
  members: GroupMember[]
  memberNames: Map<string, string>
  groupDefaultSplitRule: ExpenseSplitRule
  rules: Record<string, ExpenseSplitRule> | null | undefined
  rulesErrorMessage: string | null
  canCloseList: boolean
  currentMemberId: string | null
  isAdmin: boolean
  isArchived: boolean
  onListChange?: (list: ExpenseList) => void
  onSuccess: (message: string) => void
}

export function SettlementSection({
  list,
  items,
  nodes,
  members,
  memberNames,
  groupDefaultSplitRule,
  rules,
  rulesErrorMessage,
  canCloseList,
  currentMemberId,
  isAdmin,
  isArchived,
  onListChange,
  onSuccess,
}: SettlementSectionProps) {
  const {
    completeExpenseList,
    getExpenseListPayments,
    markExpenseListPaymentPaid,
  } = useExpenseLists()
  const [isSettlementOpen, setIsSettlementOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [paymentReload, setPaymentReload] = useState(0)
  const [paymentResult, setPaymentResult] = useState<{
    requestKey: string
    payments: ExpenseListPayment[]
  } | null>(null)
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const paymentRequestKey = `${list.id}:${paymentReload}`

  let settlement: Settlement | null = null
  let settlementError: string | null = rulesErrorMessage
  if (rules && !settlementError) {
    try {
      settlement = calculateSettlement(
        toSettlementItems(nodes),
        rules,
        members.map((member) => member.id),
        groupDefaultSplitRule
      )
    } catch (error) {
      settlementError = getActionErrorMessage(error)
    }
  }

  useEffect(() => {
    if (list.status === "open") {
      return
    }

    let isCurrent = true
    void getExpenseListPayments(list.id)
      .then((loadedPayments) => {
        if (isCurrent) {
          setPaymentResult({
            requestKey: paymentRequestKey,
            payments: loadedPayments,
          })
          setCloseError(null)
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setCloseError(getActionErrorMessage(error))
        }
      })

    return () => {
      isCurrent = false
    }
  }, [
    getExpenseListPayments,
    list.id,
    list.status,
    paymentReload,
    paymentRequestKey,
  ])

  const topCreditor = settlement?.balances
    .filter((balance) => balance.balanceCents > 0)
    .sort(
      (a, b) =>
        b.balanceCents - a.balanceCents || a.memberId.localeCompare(b.memberId)
    )[0]

  async function handleCloseList() {
    if (
      !(await confirm(
        `Liste „${list.name}“ abschließen? Danach kann sie nicht mehr als offen geführt werden.`
      ))
    ) {
      return
    }

    setIsClosing(true)
    setCloseError(null)
    try {
      await completeExpenseList(list.id, settlement?.transfers ?? [])
      onSuccess("Die Ausgabenliste wurde abgeschlossen.")
      onListChange?.({
        ...list,
        status: settlement?.transfers.length ? "completed" : "isPaid",
        completedAt: new Date().toISOString(),
        paidAt: settlement?.transfers.length ? null : new Date().toISOString(),
      })
    } catch (error) {
      setCloseError(getActionErrorMessage(error))
    } finally {
      setIsClosing(false)
    }
  }

  async function handlePaymentPaid(payment: ExpenseListPayment) {
    const confirmed = await confirm(
      `Erstattung von ${memberNames.get(payment.fromMemberId) ?? "Unbekannt"} an ${memberNames.get(payment.toMemberId) ?? "Unbekannt"} über ${formatCents(payment.amountCents)} als bezahlt bestätigen?`
    )
    if (!confirmed) {
      return
    }

    setBusyPaymentId(payment.id)
    setCloseError(null)
    try {
      const allPaid = await markExpenseListPaymentPaid(payment.id)
      setPaymentReload((current) => current + 1)
      onSuccess("Die Erstattung wurde als bezahlt bestätigt.")
      if (allPaid) {
        onListChange?.({
          ...list,
          status: "isPaid",
          paidAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      setCloseError(getActionErrorMessage(error))
    } finally {
      setBusyPaymentId(null)
    }
  }

  const visiblePayments =
    list.status === "open" || paymentResult?.requestKey !== paymentRequestKey
      ? []
      : paymentResult.payments
  const isLoadingPayments =
    list.status !== "open" && paymentResult?.requestKey !== paymentRequestKey

  return (
    <>
      {confirmDialog}
      <section
        aria-label="Abrechnung"
        className="mt-4 shrink-0 border-t border-border pt-3"
      >
        <Button
          aria-controls="settlement-details"
          aria-expanded={isSettlementOpen}
          className="flex h-auto w-full items-center justify-between gap-3 rounded-xl px-0 py-1 text-left text-sm"
          onClick={() => setIsSettlementOpen((current) => !current)}
          type="button"
          variant="ghost"
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
        </Button>
        {isSettlementOpen && (
          <div
            className="mt-3 max-h-64 space-y-3 overflow-y-auto"
            id="settlement-details"
          >
            {settlementError ? (
              <p className="text-sm text-danger-text" role="alert">
                {settlementError}
              </p>
            ) : isLoadingPayments ? (
              <p className="text-sm text-muted-foreground" role="status">
                Erstattungen werden geladen …
              </p>
            ) : list.status !== "open" && visiblePayments.length > 0 ? (
              <ul
                aria-label="Erstattungen"
                className="space-y-2 rounded-xl bg-muted p-3 text-sm"
              >
                {visiblePayments.map((payment) => {
                  const canConfirm =
                    !isArchived &&
                    payment.status === "pending" &&
                    (payment.toMemberId === currentMemberId || isAdmin)
                  return (
                    <li
                      className="flex items-center justify-between gap-3"
                      key={payment.id}
                    >
                      <span>
                        <span className="font-medium">
                          {memberNames.get(payment.toMemberId) ?? "Unbekannt"}
                        </span>{" "}
                        bekommt{" "}
                        <span className="font-semibold">
                          {formatCents(payment.amountCents)}
                        </span>{" "}
                        von{" "}
                        <span className="font-medium">
                          {memberNames.get(payment.fromMemberId) ?? "Unbekannt"}
                        </span>{" "}
                        zurück
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {payment.status === "paid" ? "Bezahlt" : "Offen"}
                        </span>
                      </span>
                      {canConfirm && (
                        <Button
                          className="shrink-0 rounded-xl"
                          disabled={busyPaymentId === payment.id}
                          onClick={() => void handlePaymentPaid(payment)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {busyPaymentId === payment.id ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="size-4 animate-spin"
                            />
                          ) : (
                            "Als bezahlt bestätigen"
                          )}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : settlement && settlement.transfers.length > 0 ? (
              <ul
                aria-label="Erstattungen"
                className="space-y-1.5 rounded-xl bg-muted p-3 text-sm"
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
              <p className="text-sm text-muted-foreground">
                Es sind keine Erstattungen nötig.
              </p>
            )}
            {closeError && (
              <p className="text-sm text-danger-text" role="alert">
                {closeError}
              </p>
            )}
            {canCloseList && list.status === "open" && (
              <div className="flex justify-end">
                <Button
                  className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
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
    </>
  )
}
