import { useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { Input } from "@/components/ui/input"
import type { ExpenseList, Group } from "@/types/group"

interface ExpenseListsResult {
  requestKey: string
  lists: ExpenseList[] | null
  errorMessage: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return "Die Aktion konnte nicht ausgeführt werden."
}

function ExpenseListCard({ list }: { list: ExpenseList }) {
  return (
    <article className="rounded-2xl border border-[#e8ebe5] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{list.name}</h2>
          <p className="mt-1 text-xs text-[#72766f]">
            Erstellt am{" "}
            {new Intl.DateTimeFormat("de-DE", {
              dateStyle: "medium",
            }).format(new Date(list.createdAt))}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              list.status === "open" || list.status === "isPaid"
                ? "bg-[#edf3e9] text-[#31563e]"
                : "bg-[#f1f1ee] text-[#656960]"
            }`}
          >
            {list.status === "open"
              ? "Offen"
              : list.status === "completed"
                ? "Erledigt"
                : "Bezahlt"}
          </span>
        </div>
      </div>
    </article>
  )
}

export function ExpenseLists({
  group,
  onBack,
}: {
  group: Group
  onBack: () => void
}) {
  const { getExpenseLists, createExpenseList } = useExpenseLists()
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ExpenseListsResult | null>(null)
  const [listName, setListName] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const requestKey = `${group.id}:${includeCompleted}:${reloadNumber}`

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
            errorMessage: getErrorMessage(error),
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
      setCreateError(getErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section className="rounded-3xl border border-[#e8ebe5] bg-white p-6 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-10">
      <Button
        className="mb-8 h-auto p-0 text-sm font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e]"
        onClick={onBack}
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Zur Gruppenübersicht
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
          <CircleDollarSign aria-hidden="true" className="size-6" />
        </div>
        <div>
          <p className="text-sm text-[#72766f]">Ausgabenlisten</p>
          <h1 className="text-2xl font-semibold tracking-[-0.04em]">
            {group.name}
          </h1>
        </div>
      </div>

      {group.archivedAt && (
        <p
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Diese Gruppe ist archiviert und kann nur noch gelesen werden. Sie wird
          nach sechs Monaten endgültig gelöscht.
        </p>
      )}

      <div className="mt-7 flex items-center gap-3 border-b border-[#eef0eb] pb-4">
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-[#555b53]">
          <Checkbox
            checked={includeCompleted}
            onCheckedChange={(checked) => setIncludeCompleted(checked === true)}
          />
          Erledigte anzeigen
        </label>
        <h2 className="min-w-0 flex-1 font-semibold">
          {includeCompleted ? "Alle Listen" : "Offene Listen"}
        </h2>
        {group.currentUserIsAdmin && !group.archivedAt && (
          <Button
            aria-label="Neue Ausgabenliste hinzufügen"
            className="size-9 shrink-0 rounded-xl bg-[#1f3b2d] p-0 text-white hover:bg-[#294b38]"
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
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
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
                <p className="mt-1 text-sm text-[#72766f]">
                  Vergib einen Namen für die Liste.
                </p>
              </div>
              <Button
                aria-label="Dialog schließen"
                className="size-8 shrink-0 rounded-lg p-0 text-[#555b53]"
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
                className="h-11 rounded-xl border-[#e4e7e1] bg-white px-4 text-sm"
                id="expense-list-name"
                maxLength={80}
                minLength={1}
                onChange={(event) => setListName(event.target.value)}
                placeholder="Name der neuen Liste"
                required
                value={listName}
              />
              {createError && (
                <p className="text-sm text-red-800" role="alert">
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
                  className="rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
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
      {createSuccess && (
        <p
          className="mt-3 rounded-xl border border-[#d9e8d6] bg-[#f0f7ed] px-4 py-3 text-sm text-[#355b3b]"
          role="status"
        >
          {createSuccess}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p
            className="flex items-center justify-center gap-2 py-10 text-sm text-[#72766f]"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Listen werden geladen ...
          </p>
        ) : errorMessage ? (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
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
          lists.map((list) => <ExpenseListCard key={list.id} list={list} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d7ded3] bg-[#fafbf9] px-5 py-10 text-center">
            <p className="font-medium">
              {includeCompleted ? "Noch keine Listen" : "Keine offenen Listen"}
            </p>
            <p className="mt-1 text-sm text-[#72766f]">
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
