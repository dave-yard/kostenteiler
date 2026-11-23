import { useState, type FormEvent } from "react"
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
import type { ExpenseListType, RecurringInterval } from "@/types/group"

export interface ExpenseListDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  groupId: string
}

export function ExpenseListDialog({
  open,
  onClose,
  onSuccess,
  groupId,
}: ExpenseListDialogProps) {
  const { createExpenseList } = useExpenseLists()
  const [listName, setListName] = useState("")
  const [listType, setListType] = useState<ExpenseListType>("one_off")
  const [interval, setInterval] = useState<RecurringInterval>("monthly")
  const [dayOfMonth, setDayOfMonth] = useState<number | string>(() => new Date().getDate())
  const [autoClose, setAutoClose] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function resetForm() {
    setListName("")
    setListType("one_off")
    setInterval("monthly")
    setDayOfMonth(new Date().getDate())
    setAutoClose(false)
    setCreateError(null)
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isCreating) {
      resetForm()
      onClose()
    }
  }

  function handleClose() {
    if (!isCreating) {
      resetForm()
      onClose()
    }
  }

  async function handleCreateExpenseList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setIsCreating(true)

    try {
      if (listType === "one_off") {
        await createExpenseList(groupId, listName.trim())
      } else {
        const parsedDay =
          typeof dayOfMonth === "number"
            ? dayOfMonth
            : parseInt(String(dayOfMonth), 10) || 1
        await createExpenseList(groupId, {
          name: listName.trim(),
          listType: "recurring",
          interval,
          dayOfMonth: parsedDay,
          autoClose,
        })
      }
      resetForm()
      onSuccess("Die Ausgabenliste wurde erstellt.")
    } catch (error) {
      setCreateError(getActionErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-semibold">
              Neue Ausgabenliste
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Vergib einen Namen und wähle den Listentyp.
            </DialogDescription>
          </div>
          <Button
            aria-label="Dialog schließen"
            className="size-8 shrink-0 rounded-lg p-0 text-muted-foreground"
            disabled={isCreating}
            onClick={handleClose}
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void handleCreateExpenseList(event)}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="expense-list-name">
              Name der neuen Ausgabenliste
            </label>
            <Input
              autoComplete="off"
              autoFocus
              className="h-11 rounded-xl border-border bg-card px-4 text-sm"
              id="expense-list-name"
              maxLength={80}
              minLength={1}
              onChange={(event) => setListName(event.target.value)}
              placeholder="z. B. Wocheneinkauf oder Miete"
              required
              value={listName}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="expense-list-type">
              Listentyp
            </label>
            <SelectField
              id="expense-list-type"
              onValueChange={(val) => setListType(val as ExpenseListType)}
              value={listType}
              options={[
                {
                  value: "one_off",
                  label: "Einmalige Liste (z. B. Urlaub, Einkauf)",
                },
                {
                  value: "recurring",
                  label: "Wiederkehrende Liste (z. B. Miete, Fixkosten)",
                },
              ]}
            />
          </div>

          {listType === "recurring" && (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-3.5">
              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-interval"
                >
                  Intervall
                </label>
                <SelectField
                  id="recurring-interval"
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
                  htmlFor="recurring-day-of-month"
                >
                  Stichtag (Kalendertag 1–31)
                </label>
                <Input
                  className="h-10 rounded-xl border-border bg-card px-3 text-sm"
                  id="recurring-day-of-month"
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
                htmlFor="recurring-auto-close"
              >
                <Checkbox
                  aria-label="Am Periodenende automatisch abrechnen"
                  checked={autoClose}
                  className="mt-0.5"
                  id="recurring-auto-close"
                  onCheckedChange={(checked) => setAutoClose(checked === true)}
                />
                <div className="min-w-0">
                  <span className="font-medium text-xs sm:text-sm">
                    Am Periodenende automatisch abrechnen
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Salden und Ausgleiche werden zum Stichtag berechnet; Zahlungen bleiben offen.
                  </p>
                </div>
              </label>
            </div>
          )}

          {createError && (
            <p className="text-sm text-danger-text" role="alert">
              {createError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              disabled={isCreating}
              onClick={handleClose}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
              disabled={isCreating || !listName.trim()}
              type="submit"
            >
              {isCreating ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              {isCreating ? "Erstellt ..." : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
