import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { GroupGeneralSettingsSection } from "./components/GroupGeneralSettingsSection"
import { GroupDefaultSplitSection } from "./components/GroupDefaultSplitSection"
import { GroupMembersSection } from "./components/GroupMembersSection"
import { GroupDangerZoneSection } from "./components/GroupDangerZoneSection"
import { AddGroupMemberSection } from "./components/AddGroupMemberSection"
import type { Group, GroupMember, PersonalContact } from "@/types/group"

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
  const { groups, loadError, getGroupMembers, getMyContacts } =
    useGroupOverview()

  const [members, setMembers] = useState<GroupMember[]>([])
  const [contacts, setContacts] = useState<PersonalContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextMembers = await getGroupMembers(group.id)
      setMembers(
        nextMembers.filter((member) => member.membershipStatus !== "removed")
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [getGroupMembers, group.id])

  useEffect(() => {
    let isCurrent = true

    getGroupMembers(group.id)
      .then((nextMembers) => {
        if (isCurrent) {
          setMembers(
            nextMembers.filter(
              (member) => member.membershipStatus !== "removed"
            )
          )
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
  }, [getGroupMembers, getMyContacts, group.id])

  const currentGroup = groups.find((entry) => entry.id === group.id)
  const displayedName = currentGroup?.name ?? group.name

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

      <GroupGeneralSettingsSection
        groupId={group.id}
        displayedName={displayedName}
        onSuccess={setSuccessMessage}
        onError={setErrorMessage}
      />

      <GroupDefaultSplitSection
        groupId={group.id}
        members={members}
        onSuccess={setSuccessMessage}
        onError={setErrorMessage}
      />

      <GroupMembersSection
        members={members}
        isLoading={isLoading}
        onReload={loadMembers}
        onSuccess={setSuccessMessage}
        onError={setErrorMessage}
      />

      <GroupDangerZoneSection
        groupId={group.id}
        displayedName={displayedName}
        onError={setErrorMessage}
        onArchived={onBack}
      />

      <AddGroupMemberSection
        groupId={group.id}
        members={members}
        contacts={contacts}
        isLoadingContacts={isLoadingContacts}
        onContactsUpdate={setContacts}
        onMemberAdded={() => void loadMembers()}
        onSuccess={setSuccessMessage}
        onError={setErrorMessage}
      />
    </div>
  )
}
