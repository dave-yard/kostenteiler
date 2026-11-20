import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { getActionErrorMessage } from "@/lib/errorMessage"
import type { ExpenseItem } from "@/types/group"

export interface DeleteExpenseItemDialogProps {
  item: ExpenseItem | null
  onClose: () => void
  onSuccess: () => void
}

export function DeleteExpenseItemDialog({
  item,
  onClose,
  onSuccess,
}: DeleteExpenseItemDialogProps) {
  const { deleteExpenseItem } = useExpenseLists()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleOpenChange(open: boolean) {
    if (!open && !isDeleting) {
      setDeleteError(null)
      onClose()
    }
  }

  async function handleDelete() {
    if (!item) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteExpenseItem(item.id)
      setDeleteError(null)
      onSuccess()
    } catch (error) {
      setDeleteError(getActionErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={Boolean(item)} onOpenChange={handleOpenChange}>
      {item && (
        <AlertDialogContent className="max-w-md">
          <AlertDialogTitle className="text-lg font-semibold">
            Position löschen?
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-muted-foreground">
            „{item.name}“ wird dauerhaft aus dieser Liste entfernt.
          </AlertDialogDescription>
          {deleteError && (
            <p className="mt-3 text-sm text-danger-text" role="alert">
              {deleteError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              disabled={isDeleting}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
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
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
