import { useState } from "react"
import { Archive } from "lucide-react"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export interface GroupDangerZoneSectionProps {
  groupId: string
  displayedName: string
  onError: (message: string) => void
  onArchived: () => void
}

export function GroupDangerZoneSection({
  groupId,
  displayedName,
  onError,
  onArchived,
}: GroupDangerZoneSectionProps) {
  const { archiveGroup, refreshGroups } = useGroupOverview()
  const [isArchiving, setIsArchiving] = useState(false)
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  async function handleArchiveGroup() {
    const confirmed = await confirm(
      `Gruppe „${displayedName}“ für alle Mitglieder archivieren? Sie bleibt sechs Monate lesbar und wird danach endgültig gelöscht.`
    )
    if (!confirmed) {
      return
    }

    setIsArchiving(true)

    let archived = false
    try {
      await archiveGroup(groupId)
      await refreshGroups()
      archived = true
    } catch (error) {
      onError(getErrorMessage(error))
    } finally {
      setIsArchiving(false)
    }
    if (archived) {
      onArchived()
    }
  }

  return (
    <>
      {confirmDialog}
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
    </>
  )
}
