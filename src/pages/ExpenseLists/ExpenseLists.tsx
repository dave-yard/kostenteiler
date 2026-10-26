import { useEffect, useState } from "react"
import { ArrowLeft, CircleDollarSign, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { ExpenseList, Group } from "@/types/group"

interface ExpenseListsResult {
  requestKey: string
  lists: ExpenseList[] | null
  errorMessage: string | null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Listen konnten nicht geladen werden."
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
  const { getExpenseLists } = useGroupOverview()
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ExpenseListsResult | null>(null)
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

      <div className="mt-7 flex items-center justify-between gap-4 border-b border-[#eef0eb] pb-4">
        <h2 className="font-semibold">
          {includeCompleted ? "Alle Listen" : "Offene Listen"}
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#555b53]">
          <Checkbox
            checked={includeCompleted}
            onCheckedChange={(checked) => setIncludeCompleted(checked === true)}
          />
          Erledigte anzeigen
        </label>
      </div>

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
