import { useState, type FormEvent } from "react"
import { LoaderCircle, X } from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getActionErrorMessage } from "@/lib/errorMessage"

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
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isCreating) {
      setListName("")
      setCreateError(null)
      onClose()
    }
  }

  function handleClose() {
    if (!isCreating) {
      setListName("")
      setCreateError(null)
      onClose()
    }
  }

  async function handleCreateExpenseList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setIsCreating(true)

    try {
      await createExpenseList(groupId, listName.trim())
      setListName("")
      setCreateError(null)
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
              Vergib einen Namen für die Liste.
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
          <label className="sr-only" htmlFor="expense-list-name">
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
            placeholder="Name der neuen Liste"
            required
            value={listName}
          />
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
