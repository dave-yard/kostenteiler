import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, LoaderCircle, Plus, ReceiptText, X } from "lucide-react"
import {
  useExpenseLists,
  type ExpenseItemAccess,
} from "@/components/contexts/ExpenseListContext"
import { ExpenseListStatusBadge } from "@/components/ExpenseListStatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { getActionErrorMessage } from "@/lib/errorMessage"
import { formatCents, parseAmountToCents } from "@/lib/money"
import type { ExpenseItem, ExpenseList, Group } from "@/types/group"

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

interface ItemsResult {
  listId: string
  reloadNumber: number
  items: ExpenseItem[]
  access: ExpenseItemAccess | null
  errorMessage: string | null
}

export function ExpenseListDetail({
  group,
  list,
  onBack,
}: {
  group: Group
  list: ExpenseList
  onBack: () => void
}) {
  const { getExpenseItems, getItemAccess, createExpenseItem } =
    useExpenseLists()
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ItemsResult | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [itemName, setItemName] = useState("")
  const [amountText, setAmountText] = useState("")
  const [paidByMemberId, setPaidByMemberId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    Promise.all([getExpenseItems(list.id), getItemAccess(group)])
      .then(([items, access]) => {
        if (isCurrent) {
          setResult({
            listId: list.id,
            reloadNumber,
            items,
            access,
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
            errorMessage: getActionErrorMessage(error),
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [getExpenseItems, getItemAccess, group, list.id, reloadNumber])

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
  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const members = result?.access?.members ?? []
  // Nur zur Bequemlichkeit: Die Datenbank prüft Rechte, Status und Archiv erneut.
  const canAddItem =
    Boolean(result?.access?.canCreate) &&
    list.status === "open" &&
    !group.archivedAt

  function openDialog() {
    setItemName("")
    setAmountText("")
    setPaidByMemberId(result?.access?.currentMemberId ?? members[0]?.id ?? "")
    setDialogError(null)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    if (!isSaving) {
      setIsDialogOpen(false)
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

    setIsSaving(true)
    setDialogError(null)
    try {
      await createExpenseItem(list.id, { name, amountCents, paidByMemberId })
      setIsDialogOpen(false)
      setSuccessMessage("Die Position wurde hinzugefügt.")
      setReloadNumber((current) => current + 1)
    } catch (error) {
      setDialogError(getActionErrorMessage(error))
    } finally {
      setIsSaving(false)
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
          {canAddItem && (
            <Button
              aria-label="Position hinzufügen"
              className="size-9 shrink-0 rounded-xl bg-[#1f3b2d] p-0 text-white hover:bg-[#294b38]"
              onClick={openDialog}
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
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold" id="add-item-title">
                Position hinzufügen
              </h2>
              <Button
                aria-label="Dialog schließen"
                className="size-8 shrink-0 rounded-lg p-0 text-[#555b53]"
                disabled={isSaving}
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
              {dialogError && (
                <p className="text-sm text-red-800" role="alert">
                  {dialogError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  disabled={isSaving}
                  onClick={closeDialog}
                  type="button"
                  variant="outline"
                >
                  Abbrechen
                </Button>
                <Button
                  className="rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  )}
                  {isSaving ? "Speichert ..." : "Hinzufügen"}
                </Button>
              </div>
            </form>
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
            {items.map((item) => (
              <li
                className="flex items-start justify-between gap-3 py-3"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">{item.name}</p>
                  <p className="mt-0.5 text-xs text-[#72766f]">
                    Bezahlt von{" "}
                    {memberNames.get(item.paidByMemberId) ?? "Unbekannt"}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">
                  {formatCents(item.amountCents)}
                </p>
              </li>
            ))}
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
    </section>
  )
}
