import { useEffect, useState, type FormEvent } from "react"
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
import { SelectField } from "@/components/ui/select"
import { getActionErrorMessage } from "@/lib/errorMessage"
import type { ExpenseItemTransferResult, ExpenseList } from "@/types/group"

const newListOption = "__create_new_list__"

interface ExpenseItemTransferDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (result: ExpenseItemTransferResult, targetListName: string) => void
  groupId: string
  sourceListId: string
  sourceItemId: string
  sourceItemName: string
  isAdmin: boolean
}

export function ExpenseItemTransferDialog({
  open,
  onClose,
  onSuccess,
  groupId,
  sourceListId,
  sourceItemId,
  sourceItemName,
  isAdmin,
}: ExpenseItemTransferDialogProps) {
  const { getExpenseLists, transferExpenseItemToList } = useExpenseLists()
  const [targetLists, setTargetLists] = useState<ExpenseList[]>([])
  const [selectedTarget, setSelectedTarget] = useState("")
  const [newListName, setNewListName] = useState("")
  const [hasLoadedLists, setHasLoadedLists] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)
  const isLoadingLists = open && !hasLoadedLists && !loadError

  useEffect(() => {
    if (!open) {
      return
    }

    let isCurrent = true
    void getExpenseLists(groupId, true)
      .then((lists) => {
        if (!isCurrent) return
        const availableLists = lists.filter(
          (list) => list.id !== sourceListId && list.status === "open"
        )
        setTargetLists(availableLists)
        setSelectedTarget(
          availableLists[0]?.id ?? (isAdmin ? newListOption : "")
        )
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadError(getActionErrorMessage(error))
      })
      .finally(() => {
        if (isCurrent) setHasLoadedLists(true)
      })

    return () => {
      isCurrent = false
    }
  }, [getExpenseLists, groupId, isAdmin, open, sourceListId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTransferError(null)

    const targetList = targetLists.find(
      (list) => list.id === selectedTarget && list.status === "open"
    )
    const creatingList = selectedTarget === newListOption && isAdmin
    const trimmedName = newListName.trim()
    if (!targetList && !creatingList) {
      setTransferError("Bitte eine offene Zielliste auswählen.")
      return
    }
    if (creatingList && (trimmedName.length < 1 || trimmedName.length > 80)) {
      setTransferError(
        "Der Listenname muss zwischen 1 und 80 Zeichen lang sein."
      )
      return
    }

    setIsTransferring(true)
    try {
      const result = await transferExpenseItemToList(
        sourceItemId,
        targetList
          ? { targetListId: targetList.id }
          : { newListName: trimmedName }
      )
      onClose()
      onSuccess(result, targetList?.name ?? trimmedName)
    } catch (error) {
      setTransferError(getActionErrorMessage(error))
    } finally {
      setIsTransferring(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isTransferring && !isLoadingLists) {
      onClose()
    }
  }

  const selectOptions = [
    { value: "", label: "Zielliste auswählen" },
    ...targetLists.map((list) => ({ value: list.id, label: list.name })),
    ...(isAdmin
      ? [{ value: newListOption, label: "Neue offene Einmalliste erstellen" }]
      : []),
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-semibold">
              In andere Liste übertragen
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              „{sourceItemName}“ wird in der Quellliste ausgeglichen und als
              Gegenposition in der Zielliste angelegt.
            </DialogDescription>
          </div>
          <Button
            aria-label="Dialog schließen"
            className="size-8 shrink-0 rounded-lg p-0 text-muted-foreground"
            disabled={isTransferring || isLoadingLists}
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="transfer-target-list"
            >
              Offene Zielliste
            </label>
            <SelectField
              disabled={isLoadingLists || isTransferring}
              id="transfer-target-list"
              onValueChange={(value) => {
                setSelectedTarget(value)
                setTransferError(null)
              }}
              options={selectOptions}
              value={selectedTarget}
            />
            {targetLists.length === 0 && !isAdmin && !isLoadingLists && (
              <p className="text-xs text-muted-foreground">
                Es gibt keine andere offene Liste in dieser Gruppe.
              </p>
            )}
          </div>
          {selectedTarget === newListOption && isAdmin && (
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="transfer-new-list-name"
              >
                Name der neuen Einmalliste
              </label>
              <Input
                autoFocus
                id="transfer-new-list-name"
                maxLength={80}
                onChange={(event) => setNewListName(event.target.value)}
                value={newListName}
              />
            </div>
          )}
          {(loadError || transferError) && (
            <p className="text-sm text-danger-text" role="alert">
              {loadError ?? transferError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isTransferring || isLoadingLists}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
              disabled={
                isLoadingLists ||
                isTransferring ||
                Boolean(loadError) ||
                !selectedTarget
              }
              type="submit"
            >
              {isTransferring && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}
              {isTransferring ? "Überträgt ..." : "Übertragen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
