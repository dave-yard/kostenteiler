import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronRight,
  GripVertical,
  Plus,
  Settings2,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GroupAdmin } from "@/pages/GroupAdmin/GroupAdmin"
import { GroupInvitation } from "@/pages/GroupInvitation/GroupInvitation"
import { ExpenseListDetail } from "@/pages/ExpenseListDetail/ExpenseListDetail"
import { ExpenseLists } from "@/pages/ExpenseLists/ExpenseLists"
import { PersonalContacts } from "@/pages/PersonalContacts/PersonalContacts"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { ExpenseList, Group } from "@/types/group"
import { useNavigate } from "react-router-dom"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

function SortableGroupCard({
  group,
  onOpen,
  onManage,
  disabled,
}: {
  group: Group
  onOpen: () => void
  onManage: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, disabled })

  return (
    <article
      onClick={onOpen}
      className={`rounded-3xl border border-border bg-card p-5 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-6 ${isDragging ? "z-10 opacity-70 shadow-xl" : ""}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-brand-badge-bg">
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">
              <button
                className="group inline-flex max-w-full min-w-0 items-center gap-1 border-b border-transparent text-left hover:border-current hover:text-brand-text"
                onClick={onOpen}
                type="button"
              >
                <span className="truncate">{group.name}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground group-hover:text-brand-text"
                />
              </button>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.memberCount}{" "}
              {group.memberCount === 1 ? "Mitglied" : "Mitglieder"}
              {group.currentUserIsAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand-text">
                  Admin
                </span>
              )}
              {group.archivedAt && (
                <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Archiviert · nur lesbar
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* <span className="hidden rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
            Listen folgen
          </span> */}
          <Button
            aria-label={`Gruppe verschieben: ${group.name}`}
            className="size-10 cursor-grab touch-none rounded-xl text-muted-foreground hover:text-brand-text active:cursor-grabbing"
            disabled={disabled}
            size="icon"
            variant="ghost"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      {group.currentUserIsAdmin && !group.archivedAt && (
        <div className="mt-5 flex border-t border-border pt-4">
          <Button
            className="h-10 justify-start gap-2 rounded-xl text-brand-text"
            onClick={onManage}
            variant="outline"
          >
            <Settings2 aria-hidden="true" className="size-4" />
            Admin-Einstellungen
          </Button>
        </div>
      )}
    </article>
  )
}

export function GroupOverview() {
  const navigate = useNavigate()
  const {
    groups,
    isLoading,
    loadError,
    refreshGroups,
    createGroup,
    saveGroupOrder,
  } = useGroupOverview()
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedList, setSelectedList] = useState<ExpenseList | null>(null)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [adminGroupId, setAdminGroupId] = useState<string | null>(null)
  const [invitationToken, setInvitationToken] = useState(() =>
    new URLSearchParams(window.location.search).get("invite")
  )
  const [isShowingContacts, setIsShowingContacts] = useState(false)
  const [isNavigationMenuOpen, setIsNavigationMenuOpen] = useState(false)
  const navigationMenuRef = useRef<HTMLDivElement>(null)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSavingGroupOrder, setIsSavingGroupOrder] = useState(false)
  const [groupOrderError, setGroupOrderError] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!isNavigationMenuOpen) {
      return
    }

    function closeMenuOnOutsideClick(event: MouseEvent) {
      if (!navigationMenuRef.current?.contains(event.target as Node)) {
        setIsNavigationMenuOpen(false)
      }
    }

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNavigationMenuOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick)
    document.addEventListener("keydown", closeMenuOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick)
      document.removeEventListener("keydown", closeMenuOnEscape)
    }
  }, [isNavigationMenuOpen])

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setIsCreatingGroup(true)

    try {
      const trimmedName = groupName.trim()
      const groupId = await createGroup(trimmedName)
      await refreshGroups()
      const createdGroup = groups.find((group) => group.id === groupId)
      setGroupName("")
      setSelectedGroup(
        createdGroup ?? {
          id: groupId,
          name: trimmedName,
          sortNr: groups.length,
          memberCount: 1,
          currentUserIsAdmin: true,
          archivedAt: null,
        }
      )
      setAdminGroupId(groupId)
    } catch (error) {
      setCreateError(getErrorMessage(error))
    } finally {
      setIsCreatingGroup(false)
    }
  }

  async function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = groups.findIndex((group) => group.id === active.id)
    const newIndex = groups.findIndex((group) => group.id === over.id)
    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    const reorderedGroups = [...groups]
    const [movedGroup] = reorderedGroups.splice(oldIndex, 1)
    reorderedGroups.splice(newIndex, 0, movedGroup)

    setGroupOrderError(null)
    setIsSavingGroupOrder(true)
    try {
      await saveGroupOrder(reorderedGroups.map((group) => group.id))
    } catch (error) {
      setGroupOrderError(getErrorMessage(error))
    } finally {
      setIsSavingGroupOrder(false)
    }
  }

  function clearInvitationToken() {
    const url = new URL(window.location.href)
    url.searchParams.delete("invite")
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
  }

  function renderContent() {
    if (invitationToken) {
      return (
        <GroupInvitation
          onAccepted={() => {
            clearInvitationToken()
            setInvitationToken(null)
          }}
          onCancel={() => {
            clearInvitationToken()
            setInvitationToken(null)
          }}
          token={invitationToken}
        />
      )
    }

    if (adminGroupId && selectedGroup) {
      return (
        <GroupAdmin
          group={selectedGroup}
          onBack={() => {
            setAdminGroupId(null)
            setSelectedGroup(null)
            setIsShowingContacts(false)
          }}
        />
      )
    }

    if (isShowingContacts) {
      return <PersonalContacts />
    }

    if (selectedGroup && selectedList?.groupId === selectedGroup.id) {
      return (
        <ExpenseListDetail
          group={selectedGroup}
          list={selectedList}
          onBack={() => setSelectedList(null)}
          onListChange={setSelectedList}
        />
      )
    }

    if (selectedGroup) {
      return (
        <ExpenseLists
          group={selectedGroup}
          includeCompleted={includeCompleted}
          onIncludeCompletedChange={setIncludeCompleted}
          onBack={() => {
            setSelectedList(null)
            setSelectedGroup(null)
          }}
          onOpenList={setSelectedList}
        />
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[1fr_auto] md:grid-rows-[auto_1fr] md:gap-x-6 md:gap-y-6">
        <div className="mb-4 flex shrink-0 flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end md:col-start-1 md:row-start-1 md:mb-0 md:self-end">
          <div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Deine Gruppen
              </h1>
              <span className="text-sm text-muted-foreground">
                {groups.length} {groups.length === 1 ? "Gruppe" : "Gruppen"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-y-contain pb-2 md:col-span-2 md:row-start-2">
          {loadError && (
            <div
              className="mb-5 flex flex-col gap-3 rounded-2xl border border-danger-border bg-danger-bg p-4 text-sm text-danger-text sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <span>{loadError}</span>
              <Button
                className="rounded-xl"
                onClick={() => void refreshGroups()}
                variant="outline"
              >
                Erneut versuchen
              </Button>
            </div>
          )}

          {groupOrderError && (
            <p
              className="mb-5 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text"
              role="alert"
            >
              Die Gruppenreihenfolge konnte nicht gespeichert werden:{" "}
              {groupOrderError}
            </p>
          )}

          {isLoading ? (
            <div
              className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
              role="status"
            >
              Gruppen werden geladen ...
            </div>
          ) : groups.length > 0 ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleGroupDragEnd(event)}
              sensors={sensors}
            >
              <SortableContext
                items={groups.map((group) => group.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {groups.map((group) => (
                    <SortableGroupCard
                      disabled={isSavingGroupOrder || groups.length < 2}
                      group={group}
                      key={group.id}
                      onManage={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation()
                        navigate(`/groups/${group.id}/admin`)
                        // setSelectedGroup(group)
                        // setAdminGroupId(group.id)
                      }}
                      onOpen={() => {
                        navigate(`/groups/${group.id}`)

                        // setAdminGroupId(null)
                        // setSelectedList(null)
                        // setIncludeCompleted(false)
                        // setSelectedGroup(group)
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            !loadError && (
              <div className="rounded-3xl border border-dashed border-border bg-card/70 px-6 py-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-surface text-brand-text">
                  <UsersRound aria-hidden="true" className="size-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  Noch keine Gruppe
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Erstelle eine Gruppe für deine WG, Reise oder gemeinsame
                  Haushaltsausgaben.
                </p>
              </div>
            )
          )}
        </div>

        <section className="mt-3 shrink-0 rounded-2xl border border-border bg-card p-3 sm:mt-6 sm:rounded-3xl sm:p-5 md:col-start-2 md:row-start-1 md:mt-0 md:w-80 md:self-end md:p-3.5 lg:w-96">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-accent text-brand-accent-text md:size-6 md:rounded-md">
              <Plus aria-hidden="true" className="size-4 md:size-3" />
            </div>
            <h2 className="text-sm font-semibold sm:text-base md:text-xs">
              Neue Gruppe erstellen
            </h2>
          </div>

          <form className="mt-2.5 flex gap-2" onSubmit={handleCreateGroup}>
            <label className="sr-only" htmlFor="new-group-name">
              Gruppenname
            </label>
            <Input
              className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm transition outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
              id="new-group-name"
              maxLength={80}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="z. B. WG Hauptstraße"
              required
              value={groupName}
            />
            <Button
              className="h-10 shrink-0 rounded-xl bg-brand-primary px-3 text-white hover:bg-brand-primary-hover sm:px-4"
              disabled={isCreatingGroup || !groupName.trim()}
              type="submit"
            >
              {isCreatingGroup ? "Wird erstellt ..." : "Erstellen"}
            </Button>
          </form>

          {createError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {createError}
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-app-bg text-foreground">
      <div
        className={`mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8 ${
          (adminGroupId && selectedGroup) ||
          isShowingContacts ||
          invitationToken
            ? "overflow-y-auto overscroll-y-contain"
            : ""
        }`}
      >
        {renderContent()}
      </div>
    </main>
  )
}
