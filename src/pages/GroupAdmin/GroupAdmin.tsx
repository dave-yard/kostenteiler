import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  Archive,
  Check,
  Clock3,
  Copy,
  Crown,
  LoaderCircle,
  MailPlus,
  Plus,
  Shield,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type {
  Group,
  GroupMember,
  GroupMemberPermissions,
  PersonalContact,
} from "@/types/group"

const PERMISSIONS: {
  key: keyof GroupMemberPermissions
  label: string
}[] = [
  { key: "canCreateItems", label: "Positionen anlegen" },
  { key: "canEditItems", label: "Positionen bearbeiten" },
  { key: "canDeleteItems", label: "Positionen löschen" },
  { key: "canEditSplits", label: "Aufteilungen bearbeiten" },
  { key: "canCloseLists", label: "Kassensturz durchführen" },
]

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export function GroupAdmin({
  group,
  onBack,
}: {
  group: Group
  onBack: () => void
}) {
  const {
    groups,
    loadError,
    getGroupMembers,
    getMyContacts,
    createGroupInvitation,
    renameGroup,
    archiveGroup,
    setGroupMemberAdmin,
    updateGroupMemberPermissions,
    removeGroupMember,
    refreshGroups,
  } = useGroupOverview()
  const [groupName, setGroupName] = useState(group.name)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [permissionDrafts, setPermissionDrafts] = useState<
    Record<string, GroupMemberPermissions>
  >({})
  const [memberName, setMemberName] = useState("")
  const [contacts, setContacts] = useState<PersonalContact[]>([])
  const [selectedContactId, setSelectedContactId] = useState("")
  const [invitationLink, setInvitationLink] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isSavingName, setIsSavingName] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const applyMembers = useCallback((nextMembers: GroupMember[]) => {
    setMembers(nextMembers)
    setPermissionDrafts(
      Object.fromEntries(
        nextMembers.map((member) => [
          member.id,
          {
            canCreateItems: member.canCreateItems,
            canEditItems: member.canEditItems,
            canDeleteItems: member.canDeleteItems,
            canEditSplits: member.canEditSplits,
            canCloseLists: member.canCloseLists,
          },
        ])
      )
    )
  }, [])

  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextMembers = await getGroupMembers(group.id)
      applyMembers(nextMembers)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [applyMembers, getGroupMembers, group.id])

  useEffect(() => {
    let isCurrent = true

    getGroupMembers(group.id)
      .then((nextMembers) => {
        if (isCurrent) {
          applyMembers(nextMembers)
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    getMyContacts()
      .then((nextContacts) => {
        if (isCurrent) {
          setContacts(nextContacts)
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingContacts(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [applyMembers, getGroupMembers, getMyContacts, group.id])

  async function handleSaveGroupName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = groupName.trim()
    if (!trimmedName || trimmedName === group.name) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSavingName(true)

    try {
      await renameGroup(group.id, trimmedName)
      await refreshGroups()
      setSuccessMessage("Der Gruppenname wurde gespeichert.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSavingName(false)
    }
  }

  async function handleArchiveGroup() {
    const confirmed = window.confirm(
      `Gruppe „${displayedName}“ für alle Mitglieder archivieren? Sie bleibt sechs Monate lesbar und wird danach endgültig gelöscht.`
    )
    if (!confirmed) {
      return
    }

    setErrorMessage(null)
    setIsArchiving(true)

    let archived = false
    try {
      await archiveGroup(group.id)
      await refreshGroups()
      archived = true
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsArchiving(false)
    }
    if (archived) {
      onBack()
    }
  }

  async function handleCreateInvitation(contactId: string) {
    const selectedContact = contacts.find((contact) => contact.id === contactId)
    if (!selectedContact) {
      setErrorMessage("Wähle einen Kontakt aus deiner Freundesliste aus.")
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setInvitationLink("")
    setIsAddingMember(true)

    try {
      const token = await createGroupInvitation(group.id, selectedContact.id)
      setInvitationLink(
        `${window.location.origin}/?invite=${encodeURIComponent(token)}`
      )
      setMemberName("")
      setSelectedContactId("")
      await loadMembers()
      await refreshGroups()
      setSuccessMessage(
        `Einladung für ${selectedContact.displayName} erstellt. Teile den Link mit der eingeladenen Person.`
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsAddingMember(false)
    }
  }

  async function handleCopyInvitationLink() {
    try {
      await navigator.clipboard.writeText(invitationLink)
      setSuccessMessage("Einladungslink wurde in die Zwischenablage kopiert.")
    } catch (error) {
      setErrorMessage(
        `Der Link konnte nicht automatisch kopiert werden. Kopiere ihn aus dem Feld. ${getErrorMessage(error)}`
      )
    }
  }

  async function handleToggleAdmin(member: GroupMember) {
    const makeAdmin = member.role !== "admin"
    const confirmed = window.confirm(
      makeAdmin
        ? `${member.displayName} zum Gruppen-Admin machen?`
        : `${member.displayName} die Admin-Rechte entziehen?`
    )
    if (!confirmed) {
      return
    }

    setErrorMessage(null)
    setSavingMemberId(member.id)
    try {
      await setGroupMemberAdmin(member.id, makeAdmin)
      await loadMembers()
      await refreshGroups()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSavingMemberId(null)
    }
  }

  async function handleSavePermissions(member: GroupMember) {
    const permissions = permissionDrafts[member.id]
    if (!permissions) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingMemberId(member.id)
    try {
      await updateGroupMemberPermissions(member.id, permissions)
      setSuccessMessage(`Rechte für ${member.displayName} wurden gespeichert.`)
      await loadMembers()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSavingMemberId(null)
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    const confirmed = window.confirm(
      `${member.displayName} wirklich aus der Gruppe entfernen?`
    )
    if (!confirmed) {
      return
    }

    setErrorMessage(null)
    setSavingMemberId(member.id)
    try {
      await removeGroupMember(member.id)
      await loadMembers()
      await refreshGroups()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSavingMemberId(null)
    }
  }

  function togglePermission(
    memberId: string,
    permission: keyof GroupMemberPermissions
  ) {
    setPermissionDrafts((current) => {
      const memberPermissions = current[memberId]
      if (!memberPermissions) {
        return current
      }

      return {
        ...current,
        [memberId]: {
          ...memberPermissions,
          [permission]: !memberPermissions[permission],
        },
      }
    })
  }

  const currentGroup = groups.find((entry) => entry.id === group.id)
  const displayedName = currentGroup?.name ?? group.name
  const availableContacts = contacts.filter(
    (contact) =>
      !members.some(
        (member) => member.email?.toLowerCase() === contact.email.toLowerCase()
      )
  )
  const contactSuggestions = memberName.trim()
    ? availableContacts
        .filter((contact) => {
          const query = memberName.trim().toLocaleLowerCase()
          return (
            contact.displayName.toLocaleLowerCase().includes(query) ||
            contact.email.toLocaleLowerCase().includes(query)
          )
        })
        .slice(0, 5)
    : []

  return (
    <div className="mx-auto max-w-4xl">
      <Button
        className="mb-5 h-auto gap-2 p-0 text-sm font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e]"
        onClick={onBack}
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Zur Gruppenübersicht
      </Button>

      <div className="mb-7 flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#1f3b2d] text-white">
          <Shield aria-hidden="true" className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#65806a]">Administration</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-[-0.04em]">
            {displayedName}
          </h1>
          <p className="mt-1 text-sm text-[#72766f]">
            Gruppendetails und Mitglieder verwalten.
          </p>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#d9e8d6] bg-[#f0f7ed] text-[#355b3b]"
          }`}
          role={errorMessage ? "alert" : "status"}
        >
          {errorMessage ?? successMessage}
        </div>
      )}
      {loadError && (
        <p
          className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {loadError}
        </p>
      )}

      <section className="rounded-3xl border border-[#e8ebe5] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#edf3e9] text-[#31563e]">
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Allgemeine Einstellungen</h2>
            <p className="text-sm text-[#72766f]">
              Nur Gruppen-Admins können diese Angaben bearbeiten.
            </p>
          </div>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={handleSaveGroupName}
        >
          <label className="sr-only" htmlFor="admin-group-name">
            Gruppenname
          </label>
          <Input
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#e4e7e1] px-3.5 text-sm transition outline-none focus:border-[#65806a] focus:ring-4 focus:ring-[#65806a]/10"
            id="admin-group-name"
            maxLength={80}
            onChange={(event) => setGroupName(event.target.value)}
            required
            value={groupName}
          />
          <Button
            className="h-11 rounded-xl"
            disabled={
              isSavingName ||
              !groupName.trim() ||
              groupName.trim() === displayedName
            }
            type="submit"
            variant="outline"
          >
            {isSavingName ? "Speichert ..." : "Name speichern"}
          </Button>
        </form>
      </section>

      <section className="mt-5 rounded-3xl border border-[#e8ebe5] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#edf3e9] text-[#31563e]">
              <UsersRound aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Mitgliederverwaltung</h2>
              <p className="text-sm text-[#72766f]">
                {members.length}{" "}
                {members.length === 1 ? "Mitglied" : "Mitglieder"}
              </p>
            </div>
          </div>
          <Button
            aria-label="Mitgliederliste neu laden"
            className="rounded-xl"
            disabled={isLoading}
            onClick={() => void loadMembers()}
            variant="outline"
          >
            <LoaderCircle
              aria-hidden="true"
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-[#72766f]" role="status">
            Mitglieder werden geladen ...
          </p>
        ) : members.length === 0 ? (
          <p className="rounded-2xl bg-[#fafbf9] px-4 py-6 text-center text-sm text-[#72766f]">
            In dieser Gruppe sind noch keine Mitglieder hinterlegt.
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const draft = permissionDrafts[member.id]
              const permissionsChanged =
                draft &&
                PERMISSIONS.some(({ key }) => draft[key] !== member[key])

              return (
                <article
                  className="rounded-2xl border border-[#e8ebe5] p-4 sm:p-5"
                  key={member.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f1f3ef] text-[#5d6f60]">
                        {member.role === "admin" ? (
                          <Crown aria-hidden="true" className="size-4" />
                        ) : (
                          <UserRound aria-hidden="true" className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{member.displayName}</p>
                        <p className="mt-0.5 text-sm break-all text-[#72766f]">
                          {member.email ??
                            (member.userId
                              ? "Registriertes Mitglied"
                              : "Virtuelles Mitglied")}
                        </p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            member.role === "admin"
                              ? "bg-[#edf3e9] text-[#31563e]"
                              : "bg-[#f2f3f0] text-[#676c64]"
                          }`}
                        >
                          {member.role === "admin"
                            ? "Gruppen-Admin"
                            : member.membershipStatus === "pending"
                              ? "Einladung ausstehend"
                              : member.membershipStatus === "legacy"
                                ? "Altes virtuelles Mitglied"
                                : "Mitglied"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {member.membershipStatus === "pending" &&
                        member.email &&
                        contacts.some(
                          (contact) =>
                            contact.email.toLowerCase() ===
                            member.email?.toLowerCase()
                        ) && (
                          <Button
                            className="h-9 rounded-xl text-xs"
                            disabled={isAddingMember}
                            onClick={() => {
                              const contact = contacts.find(
                                (entry) =>
                                  entry.email.toLowerCase() ===
                                  member.email?.toLowerCase()
                              )
                              if (contact) {
                                void handleCreateInvitation(contact.id)
                              }
                            }}
                            variant="outline"
                          >
                            <MailPlus aria-hidden="true" className="size-4" />
                            Link neu erstellen
                          </Button>
                        )}
                      {member.userId && (
                        <Button
                          className="h-9 rounded-xl text-xs"
                          disabled={savingMemberId === member.id}
                          onClick={() => void handleToggleAdmin(member)}
                          variant="outline"
                        >
                          {member.role === "admin"
                            ? "Admin-Rechte entziehen"
                            : "Zum Admin machen"}
                        </Button>
                      )}
                      <Button
                        aria-label={`${member.displayName} aus Gruppe entfernen`}
                        className="h-9 rounded-xl"
                        disabled={savingMemberId === member.id}
                        onClick={() => void handleRemoveMember(member)}
                        variant="destructive"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {member.role === "member" && draft && (
                    <div className="mt-4 border-t border-[#eef0eb] pt-4">
                      <p className="mb-3 text-xs font-semibold tracking-wide text-[#72766f] uppercase">
                        Freigegebene Rechte
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PERMISSIONS.map(({ key, label }) => (
                          <label
                            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-2 text-sm hover:bg-[#fafbf9]"
                            key={key}
                          >
                            <Checkbox
                              checked={draft[key]}
                              disabled={savingMemberId === member.id}
                              onCheckedChange={() =>
                                togglePermission(member.id, key)
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      {permissionsChanged && (
                        <Button
                          className="mt-3 h-9 rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
                          disabled={savingMemberId === member.id}
                          onClick={() => void handleSavePermissions(member)}
                        >
                          <Check aria-hidden="true" className="size-4" />
                          Rechte speichern
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-3xl border border-red-200 bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-red-900">Gruppe archivieren</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[#72766f]">
              Die Gruppe bleibt für alle Mitglieder sechs Monate lesbar. Danach
              werden die Gruppe und ihre zugehörigen Daten endgültig gelöscht.
            </p>
          </div>
          <Button
            className="shrink-0 rounded-xl"
            disabled={isArchiving}
            onClick={() => void handleArchiveGroup()}
            type="button"
            variant="destructive"
          >
            <Archive aria-hidden="true" className="size-4" />
            {isArchiving ? "Wird archiviert ..." : "Gruppe archivieren"}
          </Button>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-[#e8ebe5] bg-white p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#d8eb9a] text-[#203a2c]">
            <Plus aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Person einladen</h2>
            <p className="text-sm text-[#72766f]">
              Wähle eine Person aus der Freundesliste. Noch nicht registrierte
              Personen erhalten einen zeitlich begrenzten Einladungslink.
            </p>
          </div>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreateInvitation(selectedContactId)
          }}
        >
          <label className="sr-only" htmlFor="new-member-name">
            Person aus der Freundesliste suchen
          </label>
          <div className="relative min-w-0 flex-1">
            <Input
              aria-autocomplete="list"
              aria-controls="member-contact-suggestions"
              aria-expanded={
                !selectedContactId && contactSuggestions.length > 0
              }
              autoComplete="off"
              className="h-11 min-w-0 rounded-xl border border-[#e4e7e1] px-3.5 text-sm transition outline-none placeholder:text-[#a0a49d] focus:border-[#65806a] focus:ring-4 focus:ring-[#65806a]/10"
              id="new-member-name"
              maxLength={80}
              onChange={(event) => {
                setMemberName(event.target.value)
                setSelectedContactId("")
              }}
              placeholder="Name oder E-Mail suchen"
              required
              value={memberName}
            />
            {isLoadingContacts && memberName.trim() && (
              <p className="mt-2 text-xs text-[#72766f]" role="status">
                Freundesliste wird durchsucht ...
              </p>
            )}
            {!selectedContactId &&
              !isLoadingContacts &&
              contactSuggestions.length > 0 && (
                <div
                  className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border border-[#e4e7e1] bg-white p-1 shadow-lg"
                  id="member-contact-suggestions"
                  role="listbox"
                  aria-label="Vorschläge aus deiner Freundesliste"
                >
                  {contactSuggestions.map((contact) => (
                    <Button
                      aria-selected={selectedContactId === contact.id}
                      className="h-auto w-full justify-start rounded-lg px-3 py-2 text-left"
                      key={contact.id}
                      onClick={() => {
                        setMemberName(contact.displayName)
                        setSelectedContactId(contact.id)
                      }}
                      role="option"
                      type="button"
                      variant="ghost"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {contact.displayName}
                        </span>
                        <span className="block truncate text-xs text-[#72766f]">
                          {contact.email}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              )}
          </div>
          <Button
            className="h-11 rounded-xl bg-[#1f3b2d] px-5 text-white hover:bg-[#294b38]"
            disabled={isAddingMember || !selectedContactId}
            type="submit"
          >
            {isAddingMember
              ? "Einladung wird erstellt ..."
              : "Einladung erstellen"}
          </Button>
        </form>
        {contacts.length === 0 && !isLoadingContacts && (
          <p className="mt-3 text-sm text-[#72766f]">
            Füge zuerst Kontakte in deiner Freundesliste hinzu.
          </p>
        )}
        {invitationLink && (
          <div className="mt-4 rounded-2xl border border-[#d9e8d6] bg-[#f7faf5] p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#31563e]">
              <Clock3 aria-hidden="true" className="size-4" />
              Der Link ist 14 Tage gültig und kann einmal angenommen werden.
            </p>
            <p className="mb-3 text-xs leading-5 text-[#72766f]">
              Es wird keine E-Mail automatisch versendet. Teile diesen Link
              selbst mit der eingeladenen Person.
            </p>
            <div className="flex gap-2">
              <Input
                aria-label="Einladungslink"
                className="h-10 min-w-0 flex-1 rounded-xl bg-white text-xs"
                readOnly
                value={invitationLink}
              />
              <Button
                className="h-10 shrink-0 rounded-xl"
                onClick={() => void handleCopyInvitationLink()}
                type="button"
                variant="outline"
              >
                <Copy aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Kopieren</span>
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
