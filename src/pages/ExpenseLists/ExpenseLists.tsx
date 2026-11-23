import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ExpenseListStatusBadge } from "@/components/ExpenseListStatusBadge"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { ExpenseListDialog } from "@/components/dialogs/ExpenseListDialog"
import { ConvertExpenseListDialog } from "@/components/dialogs/ConvertExpenseListDialog"
import { Toast } from "@/components/ui/toast"
import { calculateNextPeriodDate } from "@/lib/recurringSchedule"
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
  isAdmin,
  isBusy,
  onOpen,
  onComplete,
  onMarkPaid,
  onConvert,
}: {
  list: ExpenseList
  canClose: boolean
  isAdmin: boolean
  isBusy: boolean
  onOpen: () => void
  onComplete: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMarkPaid: (e: React.MouseEvent<HTMLButtonElement>) => void
  onConvert?: () => void
}) {
  return (
    <article
      className="rounded-3xl border border-border bg-card p-3"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">
            <Button
              className="group inline-flex h-auto max-w-full min-w-0 items-center gap-1 border-b border-transparent p-0 text-left text-xl font-semibold hover:border-current hover:bg-transparent hover:text-brand-text"
              onClick={(event) => {
                event.stopPropagation()
                onOpen()
              }}
              type="button"
              variant="ghost"
            >
              <span className="truncate">{list.name}</span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground group-hover:text-brand-text"
              />
            </Button>
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Erstellt am{" "}
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
              }).format(new Date(list.createdAt))}
            </span>
            {list.listType === "recurring" && list.interval && (
              <span className="inline-flex items-center rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand-text">
                {list.interval === "monthly"
                  ? "Monatlich"
                  : list.interval === "quarterly"
                    ? "Quartalsweise"
                    : "Jährlich"}
                {list.dayOfMonth ? ` · Stichtag: ${list.dayOfMonth}.` : ""}
                {list.autoClose ? " · Auto-Abschluss" : ""}
              </span>
            )}
            {list.completedAt && (
              <span>
                · Abgeschlossen am{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "medium",
                }).format(new Date(list.completedAt))}
              </span>
            )}
          </div>
          {list.listType === "recurring" && list.interval && (
            <p className="mt-1 text-xs text-muted-foreground">
              Folgeperiode wird am{" "}
              <span className="font-medium text-foreground">
                {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
                  calculateNextPeriodDate(
                    list.createdAt,
                    list.interval,
                    list.dayOfMonth
                  )
                )}
              </span>{" "}
              automatisch erzeugt
              {list.autoClose
                ? " (inkl. automatischem Kassenabschluss)"
                : " (manueller Kassenabschluss)"}
              .
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <ExpenseListStatusBadge status={list.status} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {isAdmin && list.status === "open" && onConvert && (
          <Button
            aria-label={`Listentyp umwandeln: ${list.name}`}
            className="rounded-xl text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onConvert()
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Typ umwandeln
          </Button>
        )}
        {canClose && list.status !== "isPaid" && (
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
        )}
      </div>
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
    processRecurringLists,
    completeExpenseList,
    markExpenseListPaid,
    canCloseExpenseLists,
  } = useExpenseLists()
  const [reloadNumber, setReloadNumber] = useState(0)
  const [result, setResult] = useState<ExpenseListsResult | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [convertingList, setConvertingList] = useState<ExpenseList | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyListId, setBusyListId] = useState<string | null>(null)
  const [canClose, setCanClose] = useState(false)
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
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

    // Fällige Folgeperioden wiederkehrender Listen vor dem Laden prüfen & ggf. erzeugen (FR-5.2/FR-5.3)
    const syncRecurring = processRecurringLists
      ? Promise.resolve(processRecurringLists(group.id)).catch(() => null)
      : Promise.resolve(null)

    syncRecurring
      .then(() => getExpenseLists(group.id, includeCompleted))
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
  }, [
    getExpenseLists,
    processRecurringLists,
    group.id,
    includeCompleted,
    reloadNumber,
    requestKey,
  ])

  const isLoading = result?.requestKey !== requestKey
  const errorMessage = isLoading ? null : (result?.errorMessage ?? null)
  const lists = isLoading ? [] : (result?.lists ?? [])

  async function handleStatusChange(list: ExpenseList) {
    const isCompleting = list.status === "open"
    const confirmed = await confirm(
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

  return (
    <section className="flex min-h-0 flex-1 flex-col border border-border bg-card p-3 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-10">
      {confirmDialog}
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
              onClick={() => {
                setIsCreateModalOpen(true)
                setCreateSuccess(null)
              }}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <ExpenseListDialog
        open={
          Boolean(group.currentUserIsAdmin && !group.archivedAt && isCreateModalOpen)
        }
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(message) => {
          setIsCreateModalOpen(false)
          setCreateSuccess(message)
          setIncludeCompleted(false)
          setReloadNumber((current) => current + 1)
        }}
        groupId={group.id}
      />
      {convertingList && (
        <ConvertExpenseListDialog
          open={Boolean(convertingList)}
          onClose={() => setConvertingList(null)}
          onSuccess={() => {
            setConvertingList(null)
            setCreateSuccess("Der Listentyp wurde erfolgreich geändert.")
            setReloadNumber((current) => current + 1)
          }}
          list={convertingList}
          isAdmin={Boolean(group.currentUserIsAdmin && !group.archivedAt)}
        />
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
              isAdmin={Boolean(group.currentUserIsAdmin && !group.archivedAt)}
              isBusy={busyListId === list.id}
              key={list.id}
              list={list}
              onComplete={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                void handleStatusChange(list)
              }}
              onConvert={() => setConvertingList(list)}
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
