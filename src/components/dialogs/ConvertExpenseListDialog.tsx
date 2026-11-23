import { useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, X } from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/ui/select"
import { getActionErrorMessage } from "@/lib/errorMessage"
import type { ExpenseList, ExpenseListType, RecurringInterval } from "@/types/group"

export interface ConvertExpenseListDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (updatedList: ExpenseList) => void
  list: ExpenseList
  isAdmin: boolean
}

export function ConvertExpenseListDialog({
  open,
  onClose,
  onSuccess,
  list,
  isAdmin,
}: ConvertExpenseListDialogProps) {
  const { updateExpenseListType } = useExpenseLists()

  const currentType = list.listType ?? "one_off"
  const defaultTargetType: ExpenseListType =
    currentType === "recurring" ? "one_off" : "recurring"

  const [targetType, setTargetType] = useState<ExpenseListType>(defaultTargetType)
  const [interval, setInterval] = useState<RecurringInterval>(
    list.interval ?? "monthly"
  )
  const [dayOfMonth, setDayOfMonth] = useState<number | string>(
    list.dayOfMonth ?? new Date().getDate()
  )
  const [autoClose, setAutoClose] = useState(list.autoClose ?? false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const initialTarget: ExpenseListType =
      (list.listType ?? "one_off") === "recurring" ? "one_off" : "recurring"
    setTargetType(initialTarget)
    setInterval(list.interval ?? "monthly")
    setDayOfMonth(list.dayOfMonth ?? new Date().getDate())
    setAutoClose(list.autoClose ?? false)
    setError(null)
  }, [open, list])

  function handleClose() {
    if (!isUpdating) {
      setError(null)
      onClose()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isAdmin) {
      setError("Nur Gruppen-Admins können den Listentyp ändern.")
      return
    }

    setIsUpdating(true)
    setError(null)

    const parsedDay =
      typeof dayOfMonth === "number"
        ? dayOfMonth
        : parseInt(String(dayOfMonth), 10) || 1

    try {
      await updateExpenseListType(list.id, {
        listType: targetType,
        interval: targetType === "recurring" ? interval : null,
        dayOfMonth: targetType === "recurring" ? parsedDay : null,
        autoClose: targetType === "recurring" ? autoClose : false,
      })

      const updatedList: ExpenseList = {
        ...list,
        listType: targetType,
        interval: targetType === "recurring" ? interval : null,
        dayOfMonth: targetType === "recurring" ? parsedDay : null,
        autoClose: targetType === "recurring" ? autoClose : false,
      }

      onSuccess(updatedList)
    } catch (err) {
      setError(getActionErrorMessage(err))
    } finally {
      setIsUpdating(false)
    }
  }

  const isConvertingToRecurring = targetType === "recurring"

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isUpdating) handleClose()
      }}
    >
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-semibold">
              Listentyp umwandeln
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Liste „{list.name}“ (aktuell:{" "}
              {currentType === "recurring"
                ? "Wiederkehrend"
                : "Einmalig"}
              ) in den anderen Typ umwandeln.
            </DialogDescription>
          </div>
          <Button
            aria-label="Dialog schließen"
            className="size-8 shrink-0 rounded-lg p-0 text-muted-foreground"
            disabled={isUpdating}
            onClick={handleClose}
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="convert-target-type">
              Neuer Listentyp
            </label>
            <SelectField
              id="convert-target-type"
              onValueChange={(val) => setTargetType(val as ExpenseListType)}
              value={targetType}
              options={[
                {
                  value: "one_off",
                  label: "Einmalige Liste (keine automatischen Folgeperioden)",
                },
                {
                  value: "recurring",
                  label: "Wiederkehrende Liste (mit Periodenautomatik)",
                },
              ]}
            />
          </div>

          {isConvertingToRecurring && (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3.5">
              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="convert-recurring-interval"
                >
                  Wiederholungsintervall
                </label>
                <SelectField
                  id="convert-recurring-interval"
                  onValueChange={(val) => setInterval(val as RecurringInterval)}
                  value={interval}
                  options={[
                    { value: "monthly", label: "Monatlich" },
                    {
                      value: "quarterly",
                      label: "Quartalsweise (alle 3 Monate)",
                    },
                    { value: "yearly", label: "Jährlich (alle 12 Monate)" },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="convert-recurring-day"
                >
                  Stichtag (Kalendertag 1–31)
                </label>
                <Input
                  className="h-10 rounded-xl border-border bg-card px-3 text-sm"
                  id="convert-recurring-day"
                  max={31}
                  min={1}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "") {
                      setDayOfMonth("")
                      return
                    }
                    const parsed = parseInt(val, 10)
                    setDayOfMonth(
                      Number.isNaN(parsed)
                        ? ""
                        : Math.min(31, Math.max(1, parsed))
                    )
                  }}
                  type="number"
                  value={dayOfMonth}
                />
                <p className="text-xs text-muted-foreground">
                  Fällt ein Tag im Zielmonat weg (z. B. der 31. oder 29. Feb),
                  wird automatisch der Monatsletzte verwendet.
                </p>
              </div>

              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card p-2.5 text-sm"
                htmlFor="convert-auto-close"
              >
                <Checkbox
                  aria-label="Am Periodenende automatisch abrechnen"
                  checked={autoClose}
                  className="mt-0.5"
                  id="convert-auto-close"
                  onCheckedChange={(checked) => setAutoClose(checked === true)}
                />
                <div className="min-w-0">
                  <span className="font-medium text-xs sm:text-sm">
                    Am Periodenende automatisch abrechnen
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Salden und Ausgleiche werden zum Stichtag berechnet; Zahlungen
                    bleiben offen.
                  </p>
                </div>
              </label>
            </div>
          )}

          {!isConvertingToRecurring && currentType === "recurring" && (
            <p className="rounded-xl border border-warning-border bg-warning-bg p-3 text-xs text-warning-text">
              Hinweis: Bei der Umwandlung in eine einmalige Liste werden künftig
              keine neuen Folgeperioden mehr für diese Serie generiert.
            </p>
          )}

          {error && (
            <p className="text-sm text-danger-text" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              disabled={isUpdating}
              onClick={handleClose}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
              disabled={isUpdating || !isAdmin}
              type="submit"
            >
              {isUpdating ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              {isUpdating ? "Wird umgewandelt ..." : "Typ umwandeln"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
