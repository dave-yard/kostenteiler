import { useEffect, useState } from "react"
import { Check, Clock3, LoaderCircle, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { GroupInvitation as GroupInvitationDetails } from "@/types/group"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Einladung konnte nicht verarbeitet werden."
}

export function GroupInvitation({
  token,
  onAccepted,
  onCancel,
}: {
  token: string
  onAccepted: () => void
  onCancel: () => void
}) {
  const { getGroupInvitation, acceptGroupInvitation, refreshGroups } =
    useGroupOverview()
  const [invitation, setInvitation] = useState<GroupInvitationDetails | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    getGroupInvitation(token)
      .then((details) => {
        if (isCurrent) {
          setInvitation(details)
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
  }, [getGroupInvitation, token])

  async function handleAcceptInvitation() {
    setErrorMessage(null)
    setIsAccepting(true)
    try {
      await acceptGroupInvitation(token)
      await refreshGroups()
      onAccepted()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl border border-[#e8ebe5] bg-white p-6 shadow-[0_12px_36px_-30px_rgba(32,36,31,0.35)] sm:p-8">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
        <Mail aria-hidden="true" className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        Gruppeneinladung
      </h1>

      {isLoading ? (
        <p
          className="mt-4 flex items-center gap-2 text-sm text-[#72766f]"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Einladung wird geprüft ...
        </p>
      ) : invitation ? (
        <>
          <p className="mt-3 text-sm leading-6 text-[#72766f]">
            Du wurdest als <strong>{invitation.displayName}</strong> in die
            Gruppe <strong>{invitation.groupName}</strong> eingeladen.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#f7faf5] p-3 text-sm leading-5 text-[#405b47]">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Die Einladung wird nur mit dem bestätigten E-Mail-Konto verknüpft,
            an das sie gesendet wurde. Deine Gruppenpositionen und Aufteilungen
            bleiben dabei erhalten.
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-[#72766f]">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Der Link ist einmalig und läuft nach 14 Tagen ab.
          </p>
        </>
      ) : null}

      {errorMessage && (
        <p
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          className="h-10 rounded-xl"
          disabled={isAccepting}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Abbrechen
        </Button>
        {invitation && (
          <Button
            className="h-10 rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
            disabled={isAccepting}
            onClick={() => void handleAcceptInvitation()}
            type="button"
          >
            <Check aria-hidden="true" className="size-4" />
            {isAccepting ? "Wird angenommen ..." : "Einladung annehmen"}
          </Button>
        )}
      </div>
    </section>
  )
}
