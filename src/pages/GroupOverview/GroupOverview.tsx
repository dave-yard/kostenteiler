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
  ArrowRight,
  Check,
  CircleDollarSign,
  ContactRound,
  GripVertical,
  Home,
  LogOut,
  Plus,
  Settings2,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GroupAdmin } from "@/pages/GroupAdmin/GroupAdmin"
import { GroupInvitation } from "@/pages/GroupInvitation/GroupInvitation"
import { ExpenseLists } from "@/pages/ExpenseLists/ExpenseLists"
import { PersonalContacts } from "@/pages/PersonalContacts/PersonalContacts"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { useAuth } from "@/components/contexts/AuthContext"
import type { Group } from "@/types/group"

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
  onManage: () => void
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
      className={`rounded-3xl border border-[#e8ebe5] bg-white p-5 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-6 ${isDragging ? "z-10 opacity-70 shadow-xl" : ""}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {group.name}
            </h2>
            <p className="mt-1 text-sm text-[#72766f]">
              {group.memberCount}{" "}
              {group.memberCount === 1 ? "Mitglied" : "Mitglieder"}
              {group.currentUserIsAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#edf3e9] px-2 py-0.5 text-xs font-medium text-[#31563e]">
                  Admin
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-[#e8ebe5] px-2.5 py-1 text-xs text-[#72766f] sm:inline-flex">
            Listen folgen
          </span>
          <Button
            aria-label={`Gruppe verschieben: ${group.name}`}
            className="size-10 cursor-grab touch-none rounded-xl text-[#72766f] hover:text-[#31563e] active:cursor-grabbing"
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

      <div className="mt-5 flex flex-col gap-2 border-t border-[#eef0eb] pt-4 sm:flex-row sm:items-center">
        <Button
          className="h-10 justify-between rounded-xl bg-[#1f3b2d] px-4 text-white hover:bg-[#294b38] sm:min-w-40"
          onClick={onOpen}
        >
          Gruppe öffnen
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        {group.currentUserIsAdmin && (
          <Button
            className="h-10 justify-start gap-2 rounded-xl text-[#405b47]"
            onClick={onManage}
            variant="outline"
          >
            <Settings2 aria-hidden="true" className="size-4" />
            Admin-Einstellungen
          </Button>
        )}
      </div>
    </article>
  )
}

export function GroupOverview() {
  const { session, signOut } = useAuth()
  const {
    groups,
    isLoading,
    loadError,
    refreshGroups,
    createGroup,
    saveGroupOrder,
  } = useGroupOverview()
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [adminGroupId, setAdminGroupId] = useState<string | null>(null)
  const [invitationToken, setInvitationToken] = useState(() =>
    new URLSearchParams(window.location.search).get("invite")
  )
  const [isShowingContacts, setIsShowingContacts] = useState(false)
  const [isNavigationMenuOpen, setIsNavigationMenuOpen] = useState(false)
  const navigationMenuRef = useRef<HTMLDivElement>(null)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [signOutError, setSignOutError] = useState<string | null>(null)
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
        }
      )
      setAdminGroupId(groupId)
    } catch (error) {
      setCreateError(getErrorMessage(error))
    } finally {
      setIsCreatingGroup(false)
    }
  }

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)

    try {
      await signOut()
    } catch (error) {
      setSignOutError(getErrorMessage(error))
    } finally {
      setIsSigningOut(false)
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

    if (selectedGroup) {
      return (
        <ExpenseLists
          group={selectedGroup}
          onBack={() => setSelectedGroup(null)}
        />
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex shrink-0 flex-col justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#65806a]">
              Dein gemeinsamer Überblick
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Deine Gruppen
            </h1>
          </div>
          <span className="text-sm text-[#72766f]">
            {groups.length} {groups.length === 1 ? "Gruppe" : "Gruppen"}
          </span>
        </div>

        {loadError && (
          <div
            className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
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
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            Die Gruppenreihenfolge konnte nicht gespeichert werden:{" "}
            {groupOrderError}
          </p>
        )}

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain pb-2">
          {isLoading ? (
            <div
              className="rounded-3xl border border-[#e8ebe5] bg-white p-8 text-center text-sm text-[#72766f]"
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
                      onManage={() => {
                        setSelectedGroup(group)
                        setAdminGroupId(group.id)
                      }}
                      onOpen={() => {
                        setAdminGroupId(null)
                        setSelectedGroup(group)
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            !loadError && (
              <div className="rounded-3xl border border-dashed border-[#d7ded3] bg-white/70 px-6 py-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
                  <UsersRound aria-hidden="true" className="size-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  Noch keine Gruppe
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#72766f]">
                  Erstelle eine Gruppe für deine WG, Reise oder gemeinsame
                  Haushaltsausgaben.
                </p>
              </div>
            )
          )}
        </div>

        <section className="mt-3 shrink-0 rounded-2xl border border-[#e8ebe5] bg-white p-3 sm:mt-6 sm:rounded-3xl sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#d8eb9a] text-[#203a2c]">
              <Plus aria-hidden="true" className="size-4" />
            </div>
            <h2 className="font-semibold">Neue Gruppe erstellen</h2>
          </div>
          <form className="mt-2.5 flex gap-2" onSubmit={handleCreateGroup}>
            <label className="sr-only" htmlFor="new-group-name">
              Gruppenname
            </label>
            <Input
              className="h-10 min-w-0 flex-1 rounded-xl border border-[#e4e7e1] px-3 text-sm transition outline-none placeholder:text-[#a0a49d] focus:border-[#65806a] focus:ring-4 focus:ring-[#65806a]/10"
              id="new-group-name"
              maxLength={80}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="z. B. WG Hauptstraße"
              required
              value={groupName}
            />
            <Button
              className="h-10 shrink-0 rounded-xl bg-[#1f3b2d] px-3 text-white hover:bg-[#294b38] sm:px-4"
              disabled={isCreatingGroup || !groupName.trim()}
              type="submit"
            >
              {isCreatingGroup ? "Wird erstellt ..." : "Erstellen"}
            </Button>
          </form>
          {createError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {createError}
            </p>
          )}
        </section>
      </div>
    )
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#f5f6f2] text-[#20241f]">
      <header className="z-20 shrink-0 border-b border-black/5 bg-[#f5f6f2]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="relative" ref={navigationMenuRef}>
            <Button
              aria-expanded={isNavigationMenuOpen}
              aria-haspopup="menu"
              aria-label="Navigation öffnen"
              className="h-auto gap-3 rounded-xl p-1.5 text-[#20241f] hover:bg-black/5"
              onClick={() => setIsNavigationMenuOpen((isOpen) => !isOpen)}
              type="button"
              variant="ghost"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#1f3b2d] text-white">
                <CircleDollarSign aria-hidden="true" className="size-5" />
              </span>
              <span className="font-semibold tracking-tight">Kostenteiler</span>
            </Button>
            {isNavigationMenuOpen && (
              <nav
                aria-label="Hauptnavigation"
                className="absolute top-full left-0 z-30 mt-2 w-56 rounded-2xl border border-[#e8ebe5] bg-white p-2 shadow-xl"
                role="menu"
              >
                <Button
                  className="h-11 w-full justify-start gap-3 rounded-xl text-[#31563e]"
                  onClick={() => {
                    setSelectedGroup(null)
                    setAdminGroupId(null)
                    setIsShowingContacts(false)
                    setIsNavigationMenuOpen(false)
                  }}
                  role="menuitem"
                  type="button"
                  variant="ghost"
                >
                  <Home aria-hidden="true" className="size-4" />
                  Gruppen
                </Button>
                <div
                  aria-hidden="true"
                  className="my-1 border-t border-[#eef0eb]"
                />
                <Button
                  className="h-11 w-full justify-start gap-3 rounded-xl text-[#405b47]"
                  onClick={() => {
                    setSelectedGroup(null)
                    setAdminGroupId(null)
                    setIsShowingContacts(true)
                    setIsNavigationMenuOpen(false)
                  }}
                  role="menuitem"
                  type="button"
                  variant="ghost"
                >
                  <ContactRound aria-hidden="true" className="size-4" />
                  Freundesliste
                </Button>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#72766f]">
            <span className="hidden max-w-48 truncate sm:inline">
              {session?.user.email ?? "Angemeldet"}
            </span>
            <span
              aria-label="Konto angemeldet"
              className="flex size-9 items-center justify-center rounded-full bg-[#dce9df] font-semibold text-[#31563e]"
            >
              <Check aria-hidden="true" className="size-4" />
            </span>
            <Button
              aria-label="Abmelden"
              className="ml-1 rounded-xl"
              disabled={isSigningOut}
              onClick={handleSignOut}
              variant="outline"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </Button>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8 ${
          selectedGroup || isShowingContacts || invitationToken
            ? "overflow-y-auto overscroll-y-contain"
            : ""
        }`}
      >
        {signOutError && (
          <p
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {signOutError}
          </p>
        )}
        {renderContent()}
      </div>
    </main>
  )
}
