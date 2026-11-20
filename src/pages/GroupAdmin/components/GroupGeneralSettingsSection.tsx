import { useState, type FormEvent } from "react"
import { UsersRound } from "lucide-react"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export interface GroupGeneralSettingsSectionProps {
  groupId: string
  displayedName: string
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export function GroupGeneralSettingsSection({
  groupId,
  displayedName,
  onSuccess,
  onError,
}: GroupGeneralSettingsSectionProps) {
  const { renameGroup, refreshGroups } = useGroupOverview()
  const [groupName, setGroupName] = useState(displayedName)
  const [isSavingName, setIsSavingName] = useState(false)

  async function handleSaveGroupName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = groupName.trim()
    if (!trimmedName || trimmedName === displayedName) {
      return
    }

    setIsSavingName(true)

    try {
      await renameGroup(groupId, trimmedName)
      await refreshGroups()
      onSuccess("Der Gruppenname wurde gespeichert.")
    } catch (error) {
      onError(getErrorMessage(error))
    } finally {
      setIsSavingName(false)
    }
  }

  return (
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
        onSubmit={(e) => void handleSaveGroupName(e)}
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
  )
}
