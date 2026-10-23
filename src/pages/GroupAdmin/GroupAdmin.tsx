import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  Check,
  Crown,
  LoaderCircle,
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
import type { Group, GroupMember, GroupMemberPermissions } from "@/types/group"

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
    renameGroup,
    createVirtualMember,
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingName, setIsSavingName] = useState(false)
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

    return () => {
      isCurrent = false
    }
  }, [applyMembers, getGroupMembers, group.id])

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

  async function handleAddVirtualMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = memberName.trim()
    if (!trimmedName) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsAddingMember(true)

    try {
      await createVirtualMember(group.id, trimmedName)
      setMemberName("")
      await loadMembers()
      await refreshGroups()
      setSuccessMessage(
        `${trimmedName} wurde als virtuelles Mitglied angelegt.`
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsAddingMember(false)
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
                            : "Mitglied"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                              onCheckedChange={() => togglePermission(member.id, key)}
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

      <section className="mt-5 rounded-3xl border border-[#e8ebe5] bg-white p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#d8eb9a] text-[#203a2c]">
            <Plus aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Neues virtuelles Mitglied</h2>
            <p className="text-sm text-[#72766f]">
              Ein Platzhalter für Personen ohne App-Konto hinzufügen.
            </p>
          </div>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={handleAddVirtualMember}
        >
          <label className="sr-only" htmlFor="new-member-name">
            Name des neuen Mitglieds
          </label>
          <Input
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#e4e7e1] px-3.5 text-sm transition outline-none placeholder:text-[#a0a49d] focus:border-[#65806a] focus:ring-4 focus:ring-[#65806a]/10"
            id="new-member-name"
            maxLength={80}
            onChange={(event) => setMemberName(event.target.value)}
            placeholder="z. B. Karl"
            required
            value={memberName}
          />
          <Button
            className="h-11 rounded-xl bg-[#1f3b2d] px-5 text-white hover:bg-[#294b38]"
            disabled={isAddingMember || !memberName.trim()}
            type="submit"
          >
            {isAddingMember ? "Wird hinzugefügt ..." : "Mitglied anlegen"}
          </Button>
        </form>
        <p className="mt-3 text-xs leading-5 text-[#858a81]">
          Einladungslinks und die Verknüpfung registrierter Konten werden in
          einem späteren Schritt ergänzt.
        </p>
      </section>
    </div>
  )
}
