import { useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ExpenseListStatusBadge } from "@/components/ExpenseListStatusBadge"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { getActionErrorMessage } from "@/lib/errorMessage"
import type { ExpenseList, Group } from "@/types/group"

interface ExpenseListsResult {
  requestKey: string
  lists: ExpenseList[] | null
  errorMessage: string | null
}

function ExpenseListCard({
  list,
  canClose,
  isBusy,
  onOpen,
  onComplete,
  onMarkPaid,
}: {
  list: ExpenseList
  canClose: boolean
  isBusy: boolean
  onOpen: () => void
  onComplete: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMarkPaid: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <article
      className="rounded-3xl border border-border bg-card p-3"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">
            <button
              className="group inline-flex max-w-full min-w-0 items-center gap-1 border-b border-transparent text-left hover:border-current hover:text-brand-text"

              type="button"
            >
              <span className="truncate">{list.name}</span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground group-hover:text-brand-text"
              />
            </button>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Erstellt am{" "}
            {new Intl.DateTimeFormat("de-DE", {
              dateStyle: "medium",
            }).format(new Date(list.createdAt))}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <ExpenseListStatusBadge status={list.status} />
        </div>
      </div>
      {canClose && list.status !== "isPaid" && (
        <div className="mt-3 flex justify-end">
          <Button
            className="rounded-xl"
            disabled={isBusy}
            onClick={list.status === "open" ? onComplete : onMarkPaid}
            size="sm"
            type="button"
            variant="outline"
          >
            {isBusy ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {list.status === "open" ? "Abschließen" : "Als bezahlt markieren"}
          </Button>
        </div>
      )}
    </article>
  )
}

export function ExpenseLists({
  group,
  includeCompleted,
  onIncludeCompletedChange: setIncludeCompleted,
  onBack,
  onOpenList,
}: {
  group: Group
  includeCompleted: boolean
  onIncludeCompletedChange: (value: boolean) => void
  onBack: () => void
  onOpenList: (list: ExpenseList) => void
}) {
  const {
    getExpenseLists,
    createExpenseList,
    completeExpenseList,
    markExpenseListPaid,
    canCloseExpenseLists,
  } = useExpenseLists()
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ExpenseListsResult | null>(null)
  const [listName, setListName] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyListId, setBusyListId] = useState<string | null>(null)
  const [canClose, setCanClose] = useState(false)
  const requestKey = `${group.id}:${includeCompleted}:${reloadNumber}`

  useEffect(() => {
    let isCurrent = true

    canCloseExpenseLists(group)
      .then((allowed) => {
        if (isCurrent) {
          setCanClose(allowed && !group.archivedAt)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setCanClose(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [canCloseExpenseLists, group])

  useEffect(() => {
    let isCurrent = true

    getExpenseLists(group.id, includeCompleted)
      .then((nextLists) => {
        if (isCurrent) {
          setResult({
            requestKey,
            lists: nextLists,
            errorMessage: null,
          })
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setResult({
            requestKey,
            lists: null,
            errorMessage: getActionErrorMessage(error),
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [getExpenseLists, group.id, includeCompleted, reloadNumber, requestKey])

  const isLoading = result?.requestKey !== requestKey
  const errorMessage = isLoading ? null : (result?.errorMessage ?? null)
  const lists = isLoading ? [] : (result?.lists ?? [])

  async function handleStatusChange(list: ExpenseList) {
    const isCompleting = list.status === "open"
    const confirmed = window.confirm(
      isCompleting
        ? `Liste „${list.name}“ abschließen? Danach kann sie nicht mehr als offen geführt werden.`
        : `Liste „${list.name}“ als bezahlt markieren?`
    )
    if (!confirmed) {
      return
    }

    setActionError(null)
    setCreateSuccess(null)
    setBusyListId(list.id)

    try {
      if (isCompleting) {
        await completeExpenseList(list.id)
      } else {
        await markExpenseListPaid(list.id)
      }
      setCreateSuccess(
        isCompleting
          ? "Die Ausgabenliste wurde abgeschlossen."
          : "Die Ausgabenliste wurde als bezahlt markiert."
      )
      setReloadNumber((current) => current + 1)
    } catch (error) {
      setActionError(getActionErrorMessage(error))
    } finally {
      setBusyListId(null)
    }
  }

  async function handleCreateExpenseList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)
    setIsCreating(true)

    try {
      await createExpenseList(group.id, listName.trim())
      setListName("")
      setIsCreateModalOpen(false)
      setCreateSuccess("Die Ausgabenliste wurde erstellt.")
      setIncludeCompleted(false)
      setReloadNumber((current) => current + 1)
    } catch (error) {
      setCreateError(getActionErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col border border-border bg-card p-3 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-10">
      <div className="shrink-0">
        <Button
          className="mb-8 h-auto p-0 text-sm font-medium text-brand-text hover:bg-transparent hover:text-foreground"
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zur Gruppenübersicht
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-surface text-brand-text">
            <CircleDollarSign aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ausgabenlisten</p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em]">
              {group.name}
            </h1>
          </div>
        </div>

        {group.archivedAt && (
          <p
            className="mt-5 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text"
            role="status"
          >
            Diese Gruppe ist archiviert und kann nur noch gelesen werden. Sie
            wird nach sechs Monaten endgültig gelöscht.
          </p>
        )}

        <div className="mt-7 flex items-center gap-3 border-b border-border pb-4">
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={includeCompleted}
              onCheckedChange={(checked) =>
                setIncludeCompleted(checked === true)
              }
            />
            Erledigte anzeigen
          </label>
          <h2 className="min-w-0 flex-1 font-semibold">
            {includeCompleted ? "Alle Listen" : "Offene Listen"}
          </h2>
          {group.currentUserIsAdmin && !group.archivedAt && (
            <Button
              aria-label="Neue Ausgabenliste hinzufügen"
              className="size-9 shrink-0 rounded-xl bg-brand-primary p-0 text-white hover:bg-brand-primary-hover"
              disabled={isCreating}
              onClick={() => {
                setIsCreateModalOpen(true)
                setCreateError(null)
                setCreateSuccess(null)
              }}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {group.currentUserIsAdmin && !group.archivedAt && isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isCreating) {
              setIsCreateModalOpen(false)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !isCreating) {
              setIsCreateModalOpen(false)
            }
          }}
        >
          <div
            aria-labelledby="create-expense-list-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-lg font-semibold"
                  id="create-expense-list-title"
                >
                  Neue Ausgabenliste
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vergib einen Namen für die Liste.
                </p>
              </div>
              <Button
                aria-label="Dialog schließen"
                className="size-8 shrink-0 rounded-lg p-0 text-muted-foreground"
                disabled={isCreating}
                onClick={() => setIsCreateModalOpen(false)}
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
                  onClick={() => setIsCreateModalOpen(false)}
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
          </div>
        </div>
      )}
      <Toast message={createSuccess} onClose={() => setCreateSuccess(null)} />
      <Toast
        message={actionError}
        onClose={() => setActionError(null)}
        variant="error"
      />

      <div className="mt-4 min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          <p
            className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Listen werden geladen ...
          </p>
        ) : errorMessage ? (
          <div
            className="rounded-2xl border border-danger-border bg-danger-bg p-4 text-sm text-danger-text"
            role="alert"
          >
            <p>{errorMessage}</p>
            <Button
              className="mt-3 rounded-xl"
              onClick={() => setReloadNumber((current) => current + 1)}
              variant="outline"
            >
              Erneut versuchen
            </Button>
          </div>
        ) : lists.length > 0 ? (
          lists.map((list) => (
            <ExpenseListCard
              canClose={canClose}
              isBusy={busyListId === list.id}
              key={list.id}
              list={list}
              onComplete={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                void handleStatusChange(list)
              }}
              onMarkPaid={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                void handleStatusChange(list)
              }}
              onOpen={() => onOpenList(list)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted px-5 py-10 text-center">
            <p className="font-medium">
              {includeCompleted ? "Noch keine Listen" : "Keine offenen Listen"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {includeCompleted
                ? "Für diese Gruppe wurden noch keine Listen erstellt."
                : "Erledigte Listen kannst du über den Filter einblenden."}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
