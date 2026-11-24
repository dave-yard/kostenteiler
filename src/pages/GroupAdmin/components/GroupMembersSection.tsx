import { useEffect, useState } from "react"
import {
  Check,
  Crown,
  LoaderCircle,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { getActionErrorMessage } from "@/lib/errorMessage"
import type { GroupMember, GroupMemberPermissions } from "@/types/group"

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

export interface GroupMembersSectionProps {
  members: GroupMember[]
  isLoading: boolean
  onReload: () => Promise<void>
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export function GroupMembersSection({
  members,
  isLoading,
  onReload,
  onSuccess,
  onError,
}: GroupMembersSectionProps) {
  const {
    setGroupMemberAdmin,
    updateGroupMemberPermissions,
    removeGroupMember,
    refreshGroups,
  } = useGroupOverview()

  const [deleteMode, setDeleteMode] = useState(false)
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)
  const [openPermissionMemberId, setOpenPermissionMemberId] = useState<
    string | null
  >(null)
  const [permissionDrafts, setPermissionDrafts] = useState<
    Record<string, GroupMemberPermissions>
  >({})
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  useEffect(() => {
    setPermissionDrafts(
      Object.fromEntries(
        members.map((member) => [
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
  }, [members])

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

  async function handleToggleAdmin(member: GroupMember) {
    const makeAdmin = member.role !== "admin"
    const confirmed = await confirm(
      makeAdmin
        ? `${member.displayName} zum Gruppen-Admin machen?`
        : `${member.displayName} die Admin-Rechte entziehen?`
    )
    if (!confirmed) {
      return
    }

    setSavingMemberId(member.id)
    try {
      await setGroupMemberAdmin(member.id, makeAdmin)
      await onReload()
      await refreshGroups()
    } catch (error) {
      onError(getErrorMessage(error))
    } finally {
      setSavingMemberId(null)
    }
  }

  async function handleSavePermissions(member: GroupMember) {
    const permissions = permissionDrafts[member.id]
    if (!permissions) {
      return
    }

    setSavingMemberId(member.id)
    try {
      await updateGroupMemberPermissions(member.id, permissions)
      onSuccess(`Rechte für ${member.displayName} wurden gespeichert.`)
      await onReload()
    } catch (error) {
      onError(getErrorMessage(error))
    } finally {
      setSavingMemberId(null)
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    const confirmed = await confirm(
      `${member.displayName} wirklich aus der Gruppe entfernen?`
    )
    if (!confirmed) {
      return
    }

    setSavingMemberId(member.id)
    try {
      await removeGroupMember(member.id)
      await onReload()
      await refreshGroups()
    } catch (error) {
      onError(getActionErrorMessage(error))
    } finally {
      setSavingMemberId(null)
    }
  }

  return (
    <>
      {confirmDialog}
      <section className="mt-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-surface text-brand-text">
              <UsersRound aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Mitgliederverwaltung</h2>
              <p className="text-sm text-muted-foreground">
                {members.length}{" "}
                {members.length === 1 ? "Mitglied" : "Mitglieder"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {members.length > 0 && (
              <Button
                aria-label="Löschen aktivieren"
                aria-pressed={deleteMode}
                className={`rounded-xl ${deleteMode ? "bg-destructive text-white hover:bg-destructive/90" : "text-destructive"}`}
                onClick={() => setDeleteMode((current) => !current)}
                variant={deleteMode ? "default" : "outline"}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            )}
            <Button
              aria-label="Mitgliederliste neu laden"
              className="rounded-xl"
              disabled={isLoading}
              onClick={onReload}
              variant="outline"
            >
              <LoaderCircle
                aria-hidden="true"
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p
            className="py-6 text-center text-sm text-muted-foreground"
            role="status"
          >
            Mitglieder werden geladen ...
          </p>
        ) : members.length === 0 ? (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
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
                  className="relative rounded-2xl border border-border p-4 sm:p-5"
                  key={member.id}
                >
                  <div
                    className={`flex flex-wrap items-start justify-between gap-3 ${deleteMode ? "pr-10" : ""}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {member.role === "admin" ? (
                          <Crown aria-hidden="true" className="size-4" />
                        ) : (
                          <UserRound aria-hidden="true" className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{member.displayName}</p>
                        <p className="mt-0.5 text-sm break-all text-muted-foreground">
                          {member.email ??
                            (member.userId
                              ? "Registriertes Mitglied"
                              : "Virtuelles Mitglied")}
                        </p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            member.role === "admin"
                              ? "bg-brand-surface text-brand-text"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {member.role === "admin"
                            ? "Gruppen-Admin"
                            : member.membershipStatus === "pending"
                              ? "Registrierung ausstehend"
                              : member.membershipStatus === "legacy"
                                ? "Altes virtuelles Mitglied"
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
                      {deleteMode && (
                        <Button
                          aria-label={`${member.displayName} aus Gruppe entfernen`}
                          className="absolute top-3 right-3 size-8 rounded-xl p-0"
                          disabled={savingMemberId === member.id}
                          onClick={() => void handleRemoveMember(member)}
                          variant="destructive"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {member.role === "member" && draft && (
                    <div className="mt-4 border-t border-border pt-4">
                      <Button
                        aria-expanded={openPermissionMemberId === member.id}
                        className="h-9 w-full justify-between rounded-xl px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:bg-muted"
                        onClick={() =>
                          setOpenPermissionMemberId((current) =>
                            current === member.id ? null : member.id
                          )
                        }
                        type="button"
                        variant="ghost"
                      >
                        <span>Freigegebene Rechte</span>
                        <span className="text-xs lowercase">
                          {openPermissionMemberId === member.id
                            ? "einklappen ▲"
                            : "ausklappen ▼"}
                        </span>
                      </Button>

                      {openPermissionMemberId === member.id && (
                        <div className="mt-3 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {PERMISSIONS.map(({ key, label }) => (
                              <label
                                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-2 text-sm hover:bg-muted"
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
                              className="mt-3 h-9 rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
                              disabled={savingMemberId === member.id}
                              onClick={() => void handleSavePermissions(member)}
                            >
                              <Check aria-hidden="true" className="size-4" />
                              Rechte speichern
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
