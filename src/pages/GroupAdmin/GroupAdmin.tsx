import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  ArrowLeft,
  Archive,
  Check,
  Copy,
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
import { Toast } from "@/components/ui/toast"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import {
  createEqualPercentageDrafts,
  parseNonNegativeCents,
  parsePercentageToBasisPoints,
  type ExpenseSplitRule,
} from "@/lib/expenseSplit"
import { getActionErrorMessage } from "@/lib/errorMessage"
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
    getGroupSplitDefault,
    getMyContacts,
    createPersonalContact,
    addGroupMember,
    renameGroup,
    archiveGroup,
    setGroupMemberAdmin,
    updateGroupMemberPermissions,
    setGroupSplitDefault,
    removeGroupMember,
    refreshGroups,
  } = useGroupOverview()
  const [groupName, setGroupName] = useState(group.name)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [permissionDrafts, setPermissionDrafts] = useState<
    Record<string, GroupMemberPermissions>
  >({})
  const [memberName, setMemberName] = useState<string | null>("")
  const [memberEmail, setMemberEmail] = useState<string | null>("")
  const [contacts, setContacts] = useState<PersonalContact[]>([])
  const [selectedContactId, setSelectedContactId] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [deleteMode, setDeleteMode] = useState(false)
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isSavingName, setIsSavingName] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [groupSplitMode, setGroupSplitMode] =
    useState<ExpenseSplitRule["mode"]>("equal")
  const [groupSplitMemberId, setGroupSplitMemberId] = useState("")
  const [groupSplitValues, setGroupSplitValues] = useState<
    Record<string, string>
  >({})
  const [isSavingSplitDefault, setIsSavingSplitDefault] = useState(false)

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

    getGroupSplitDefault(group.id)
      .then((rule) => {
        if (!isCurrent) {
          return
        }
        setGroupSplitMode(rule.mode)
        if (rule.mode === "complete") {
          setGroupSplitMemberId(rule.memberId)
        } else if (rule.mode === "percentage") {
          setGroupSplitValues(
            Object.fromEntries(
              rule.shares.map((share) => [
                share.memberId,
                (share.basisPoints / 100).toFixed(2).replace(".", ","),
              ])
            )
          )
        } else if (rule.mode === "fixed") {
          setGroupSplitValues(
            Object.fromEntries(
              rule.shares.map((share) => [
                share.memberId,
                (share.amountCents / 100).toFixed(2).replace(".", ","),
              ])
            )
          )
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(getErrorMessage(error))
        }
      })

    return () => {
      isCurrent = false
    }
  }, [
    applyMembers,
    getGroupMembers,
    getGroupSplitDefault,
    getMyContacts,
    group.id,
  ])

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

  async function handleSaveGroupSplitDefault(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    let rule: ExpenseSplitRule | null = null

    if (groupSplitMode === "complete") {
      if (!members.some((member) => member.id === groupSplitMemberId)) {
        setErrorMessage("Bitte eine Person aus der Gruppe auswählen.")
        return
      }
      rule = { mode: "complete", memberId: groupSplitMemberId }
    } else if (groupSplitMode === "percentage") {
      const shares = members.map((member) => ({
        memberId: member.id,
        basisPoints: parsePercentageToBasisPoints(
          groupSplitValues[member.id] ?? "0,00"
        ),
      }))
      if (shares.some((share) => share.basisPoints === null)) {
        setErrorMessage(
          "Bitte gültige Prozentanteile mit höchstens zwei Nachkommastellen eingeben."
        )
        return
      }
      const validShares = shares.filter(
        (share): share is { memberId: string; basisPoints: number } =>
          share.basisPoints !== null
      )
      if (
        validShares.reduce((sum, share) => sum + share.basisPoints, 0) !==
        10_000
      ) {
        setErrorMessage(
          "Die Prozentanteile müssen zusammen genau 100 % ergeben."
        )
        return
      }
      rule = { mode: "percentage", shares: validShares }
    } else if (groupSplitMode === "fixed") {
      const shares = members.map((member) => ({
        memberId: member.id,
        amountCents: parseNonNegativeCents(
          groupSplitValues[member.id] ?? "0,00"
        ),
      }))
      if (shares.some((share) => share.amountCents === null)) {
        setErrorMessage("Bitte gültige Festbeträge in Euro eingeben.")
        return
      }
      rule = {
        mode: "fixed",
        shares: shares.filter(
          (share): share is { memberId: string; amountCents: number } =>
            share.amountCents !== null
        ),
      }
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSavingSplitDefault(true)
    try {
      await setGroupSplitDefault(group.id, rule)
      setSuccessMessage(
        rule
          ? "Der Gruppenstandard für Verteilungen wurde gespeichert."
          : "Der Gruppenstandard verteilt wieder gleichmäßig."
      )
    } catch (error) {
      setErrorMessage(getActionErrorMessage(error))
    } finally {
      setIsSavingSplitDefault(false)
    }
  }

  function changeGroupSplitMode(mode: ExpenseSplitRule["mode"]) {
    setGroupSplitMode(mode)
    if (mode === "complete") {
      setGroupSplitMemberId((current) => current || members[0]?.id || "")
    } else if (mode === "percentage" && members.length > 0) {
      setGroupSplitValues((current) => ({
        ...current,
        ...createEqualPercentageDrafts(members.map((member) => member.id)),
      }))
    } else if (mode === "fixed") {
      setGroupSplitValues((current) => ({
        ...current,
        ...Object.fromEntries(members.map((member) => [member.id, "0,00"])),
      }))
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

  async function handleAddMember() {
    const trimmedEmail = memberEmail?.trim().toLowerCase() || null
    const enteredName = memberName?.trim() || null

    setErrorMessage(null)
    setSuccessMessage(null)

    // 1. Validierung: Mindestens Name oder E-Mail muss angegeben sein
    const emailName = trimmedEmail ? trimmedEmail.split("@")[0] : null
    const displayName = enteredName || emailName

    if (!displayName) {
      setErrorMessage("Gib bitte einen Namen oder eine E-Mail-Adresse ein.")
      return
    }

    setIsAddingMember(true)

    try {
      // 2. Suche in bestehender Freundesliste (nach E-Mail oder Anzeige-Name)
      let contact = contacts.find((entry) => {
        if (trimmedEmail && entry.email?.toLowerCase() === trimmedEmail) {
          return true
        }
        if (
          enteredName &&
          entry.displayName?.toLowerCase() === enteredName.toLowerCase()
        ) {
          return true
        }
        return false
      })

      // 3. Falls nicht in der Freundesliste: Neu anlegen
      // 3. Falls nicht in der Freundesliste: Neu anlegen
      if (!contact) {
        console.log(
          "Kontakt nicht gefunden. Erstelle neuen Eintrag in Freundesliste..."
        )

        await createPersonalContact(displayName, trimmedEmail)
        const updatedContacts = await getMyContacts()
        setContacts(updatedContacts)

        // Kontakt über E-Mail, Name oder als allerletztes Element der Liste greifen
        contact =
          updatedContacts.find(
            (entry) =>
              (trimmedEmail && entry.email?.toLowerCase() === trimmedEmail) ||
              entry.displayName?.toLowerCase() === displayName.toLowerCase()
          ) ?? updatedContacts[updatedContacts.length - 1]

        if (!contact) {
          throw new Error(
            "Der Kontakt konnte nach der Erstellung nicht abgerufen werden."
          )
        }
      }

      // 4. Zur Gruppe hinzufügen
      await addGroupMember(group.id, contact.id)

      // Formular zurücksetzen & State aktualisieren
      setMemberName("")
      setMemberEmail("")
      setSelectedContactId("")
      await loadMembers()
      await refreshGroups()
      setSuccessMessage(`${contact.displayName} wurde zur Gruppe hinzugefügt.`)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsAddingMember(false)
    }
  }
  async function handleCopyAppAddress() {
    try {
      await navigator.clipboard.writeText(
        "https://dave-yard.github.io/kostenteiler/"
      )
      setSuccessMessage("Die App-Adresse wurde in die Zwischenablage kopiert.")
    } catch (error) {
      setErrorMessage(
        `Die App-Adresse konnte nicht automatisch kopiert werden. ${getErrorMessage(error)}`
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
        (member) => member.email?.toLowerCase() === contact.email?.toLowerCase()
      )
  )
  const contactQuery = memberName?.trim() || memberEmail?.trim()
  const contactSuggestions = contactQuery
    ? availableContacts
        .filter((contact) => {
          const query = contactQuery.toLocaleLowerCase()
          return (
            contact.displayName?.toLocaleLowerCase().includes(query) ||
            contact.email?.toLocaleLowerCase().includes(query)
          )
        })
        .slice(0, 5)
    : []

  const [openPermissionMemberId, setOpenPermissionMemberId] = useState<
    string | null
  >(null)

  return (
    <div className="mx-auto max-w-4xl">
      <Button
        className="mb-5 h-auto gap-2 p-0 text-sm font-medium text-brand-text hover:bg-transparent hover:text-foreground"
        onClick={onBack}
        type="button"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Zur Gruppenübersicht
      </Button>

      <div className="mb-7 flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-white">
          <Shield aria-hidden="true" className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-brand-subtle">
            Administration
          </p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-[-0.04em]">
            {displayedName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gruppendetails und Mitglieder verwalten.
          </p>
        </div>
      </div>

      <Toast
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
        variant="error"
      />
      <Toast message={successMessage} onClose={() => setSuccessMessage(null)} />
      {loadError && (
        <p
          className="mb-5 rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text"
          role="status"
        >
          {loadError}
        </p>
      )}

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-surface text-brand-text">
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Allgemeine Einstellungen</h2>
            <p className="text-sm text-muted-foreground">
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
            className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3.5 text-sm transition outline-none focus:border-ring focus:ring-4 focus:ring-ring/10"
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

      <section className="mt-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-5">
          <h2 className="font-semibold">Standardverteilung der Gruppe</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ohne eigene Einstellung werden Kosten gleichmäßig auf alle
            Gruppenmitglieder verteilt. Einzelne Positionen können einen eigenen
            Schlüssel verwenden.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => void handleSaveGroupSplitDefault(event)}
        >
          <label className="sr-only" htmlFor="group-split-mode">
            Standard-Aufteilungsmodus
          </label>
          <select
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
            id="group-split-mode"
            onChange={(event) =>
              changeGroupSplitMode(
                event.target.value as ExpenseSplitRule["mode"]
              )
            }
            value={groupSplitMode}
          >
            <option value="equal">Gleichmäßig auf alle Mitglieder</option>
            <option value="complete">Komplett für eine Person</option>
            <option value="percentage">Prozentual</option>
            <option value="fixed">Fester Betrag</option>
          </select>

          {groupSplitMode === "complete" && (
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="group-split-member"
              >
                Übernimmt den gesamten Betrag
              </label>
              <select
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
                id="group-split-member"
                onChange={(event) => setGroupSplitMemberId(event.target.value)}
                value={groupSplitMemberId}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(groupSplitMode === "percentage" || groupSplitMode === "fixed") && (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={member.id}
                >
                  <label
                    className="min-w-0 flex-1 truncate text-sm"
                    htmlFor={`group-split-${member.id}`}
                  >
                    {member.displayName}
                  </label>
                  <div className="flex w-36 shrink-0 items-center gap-2">
                    <Input
                      className="h-10 rounded-xl border-border px-3 text-right text-sm"
                      id={`group-split-${member.id}`}
                      inputMode="decimal"
                      onChange={(event) =>
                        setGroupSplitValues((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }))
                      }
                      placeholder="0,00"
                      value={groupSplitValues[member.id] ?? ""}
                    />
                    <span className="text-sm text-muted-foreground">
                      {groupSplitMode === "percentage" ? "%" : "€"}
                    </span>
                  </div>
                </div>
              ))}
              {groupSplitMode === "fixed" && (
                <p className="text-xs text-muted-foreground">
                  Nicht verteilte Restbeträge werden je Position gleichmäßig
                  verteilt.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
              disabled={isSavingSplitDefault || members.length === 0}
              type="submit"
            >
              {isSavingSplitDefault ? "Speichert ..." : "Standard speichern"}
            </Button>
          </div>
        </form>
      </section>

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
              onClick={() => void loadMembers()}
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

      <section className="mt-5 rounded-3xl border border-danger-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-danger-text">
              Gruppe archivieren
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
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

      <section className="mt-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-accent text-brand-accent-text">
            <Plus aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Person hinzufügen</h2>
            <p className="text-sm text-muted-foreground">
              Wähle einen Kontakt aus oder gib Name und E-Mail-Adresse ein. Neue
              Kontakte werden in deiner Freundesliste gespeichert.
              Unregistrierte Personen bleiben ausstehend und werden nach einer
              Registrierung mit bestätigter E-Mail automatisch verknüpft.
            </p>
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleAddMember()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative min-w-0">
              <label className="sr-only" htmlFor="new-member-name">
                Name oder Freundesliste durchsuchen
              </label>
              <Input
                aria-autocomplete="list"
                aria-controls="member-contact-suggestions"
                aria-expanded={
                  !selectedContactId && contactSuggestions.length > 0
                }
                autoComplete="off"
                className="h-11 min-w-0 rounded-xl border border-border px-3.5 text-sm transition outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
                id="new-member-name"
                maxLength={80}
                onChange={(event) => {
                  setMemberName(event.target.value)
                  setSelectedContactId("")
                }}
                placeholder="Name (optional)"
                value={memberName ?? ""}
              />
              {isLoadingContacts &&
                (memberName?.trim() || memberEmail?.trim()) && (
                  <p
                    className="mt-2 text-xs text-muted-foreground"
                    role="status"
                  >
                    Freundesliste wird durchsucht ...
                  </p>
                )}
              {!selectedContactId &&
                !isLoadingContacts &&
                contactSuggestions.length > 0 && (
                  <div
                    className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
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
                          setMemberEmail(contact.email)
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
                          <span className="block truncate text-xs text-muted-foreground">
                            {contact.email}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
            </div>
            <div className="flex min-w-0 gap-2">
              <label className="sr-only" htmlFor="new-member-email">
                E-Mail-Adresse
              </label>
              <Input
                autoComplete="email"
                className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3.5 text-sm transition outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
                id="new-member-email"
                onChange={(event) => {
                  setMemberEmail(event.target.value)
                  setSelectedContactId("")
                }}
                placeholder="E-Mail-Adresse"
                type="email"
                value={memberEmail ?? ""}
              />
              {memberEmail?.trim() && (
                <Button
                  aria-label="App-Adresse kopieren"
                  className="h-11 shrink-0 rounded-xl"
                  onClick={() => void handleCopyAppAddress()}
                  title="App-Adresse kopieren"
                  type="button"
                  variant="outline"
                >
                  <Copy aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">App-Link kopieren</span>
                </Button>
              )}
            </div>
          </div>
          <Button
            className="h-11 rounded-xl bg-brand-primary px-5 text-white hover:bg-brand-primary-hover"
            disabled={
              isAddingMember || (!memberEmail?.trim() && !memberName?.trim())
            }
            type="submit"
          >
            {isAddingMember ? "Wird hinzugefügt ..." : "Person hinzufügen"}
          </Button>
        </form>
      </section>
    </div>
  )
}
