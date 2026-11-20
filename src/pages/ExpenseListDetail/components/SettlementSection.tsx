import { useState } from "react"
import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { getActionErrorMessage } from "@/lib/errorMessage"
import { toSettlementItems, type ItemNode } from "@/lib/itemHierarchy"
import { formatCents } from "@/lib/money"
import { calculateSettlement, type Settlement } from "@/lib/settlement"
import type { ExpenseSplitRule } from "@/lib/expenseSplit"
import type { ExpenseItem, ExpenseList, GroupMember } from "@/types/group"

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
  onListChange,
  onSuccess,
}: SettlementSectionProps) {
  const { completeExpenseList } = useExpenseLists()
  const [isSettlementOpen, setIsSettlementOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

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
      await completeExpenseList(list.id)
      onSuccess("Die Ausgabenliste wurde abgeschlossen.")
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
            {canCloseList && (
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
