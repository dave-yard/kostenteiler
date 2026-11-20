import { useEffect, useState, type FormEvent } from "react"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/ui/select"
import {
  createEqualPercentageDrafts,
  parsePercentageToBasisPoints,
  type ExpenseSplitRule,
} from "@/lib/expenseSplit"
import { getActionErrorMessage } from "@/lib/errorMessage"
import type { GroupMember } from "@/types/group"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export interface GroupDefaultSplitSectionProps {
  groupId: string
  members: GroupMember[]
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export function GroupDefaultSplitSection({
  groupId,
  members,
  onSuccess,
  onError,
}: GroupDefaultSplitSectionProps) {
  const { getGroupSplitDefault, setGroupSplitDefault } = useGroupOverview()
  const [groupSplitMode, setGroupSplitMode] = useState<"equal" | "percentage">("equal")
  const [groupSplitValues, setGroupSplitValues] = useState<Record<string, string>>({})
  const [isSavingSplitDefault, setIsSavingSplitDefault] = useState(false)

  useEffect(() => {
    let isCurrent = true

    getGroupSplitDefault(groupId)
      .then((rule) => {
        if (!isCurrent) {
          return
        }
        if (rule.mode === "percentage") {
          setGroupSplitMode("percentage")
          setGroupSplitValues(
            Object.fromEntries(
              rule.shares.map((share) => [
                share.memberId,
                (share.basisPoints / 100).toFixed(2).replace(".", ","),
              ])
            )
          )
        } else {
          setGroupSplitMode("equal")
          setGroupSplitValues({})
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          onError(getErrorMessage(error))
        }
      })

    return () => {
      isCurrent = false
    }
  }, [getGroupSplitDefault, groupId, onError])

  function changeGroupSplitMode(mode: string) {
    const nextMode = mode === "percentage" ? "percentage" : "equal"
    setGroupSplitMode(nextMode)
    if (nextMode === "percentage" && members.length > 0) {
      setGroupSplitValues((current) => ({
        ...current,
        ...createEqualPercentageDrafts(members.map((member) => member.id)),
      }))
    } else {
      setGroupSplitValues({})
    }
  }

  function handlePercentageChange(memberId: string, rawValue: string) {
    setGroupSplitValues((current) => {
      const next = { ...current, [memberId]: rawValue }
      if (members.length === 2) {
        const otherMember = members.find((m) => m.id !== memberId)
        if (otherMember) {
          const sanitized = rawValue.trim().replace(/[,.]$/, "")
          const bp = parsePercentageToBasisPoints(sanitized)
          if (bp !== null && bp >= 0 && bp <= 10_000) {
            const otherBp = 10_000 - bp
            next[otherMember.id] = (otherBp / 100).toFixed(2).replace(".", ",")
          }
        }
      }
      return next
    })
  }

  const percentageShares = members.map((m) =>
    parsePercentageToBasisPoints(groupSplitValues[m.id] ?? "")
  )
  const isAnyPercentageInvalid = percentageShares.some((bp) => bp === null)
  const totalPercentageBasisPoints = isAnyPercentageInvalid
    ? null
    : percentageShares.reduce((sum, bp) => (sum ?? 0) + (bp ?? 0), 0)
  const isPercentageSumValid = totalPercentageBasisPoints === 10_000

  const isSaveDisabled =
    isSavingSplitDefault ||
    members.length === 0 ||
    (groupSplitMode === "percentage" && !isPercentageSumValid)

  async function handleSaveGroupSplitDefault(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    let rule: ExpenseSplitRule | null = null

    if (groupSplitMode === "percentage") {
      if (!isPercentageSumValid) {
        onError("Die Prozentanteile müssen zusammen genau 100 % ergeben.")
        return
      }

      const shares = members.map((member) => ({
        memberId: member.id,
        basisPoints: parsePercentageToBasisPoints(
          groupSplitValues[member.id] ?? "0,00"
        ),
      }))
      const validShares = shares.filter(
        (share): share is { memberId: string; basisPoints: number } =>
          share.basisPoints !== null
      )
      rule = { mode: "percentage", shares: validShares }
    }

    setIsSavingSplitDefault(true)
    try {
      await setGroupSplitDefault(groupId, rule)
      onSuccess(
        rule
          ? "Der Gruppenstandard für Verteilungen wurde gespeichert."
          : "Der Gruppenstandard verteilt wieder gleichmäßig."
      )
    } catch (error) {
      onError(getActionErrorMessage(error))
    } finally {
      setIsSavingSplitDefault(false)
    }
  }

  return (
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
        <SelectField
          id="group-split-mode"
          onValueChange={changeGroupSplitMode}
          value={groupSplitMode}
          options={[
            { value: "equal", label: "Gleichmäßig auf alle Mitglieder" },
            { value: "percentage", label: "Prozentual" },
          ]}
        />

        {groupSplitMode === "percentage" && (
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
                      handlePercentageChange(member.id, event.target.value)
                    }
                    placeholder="0,00"
                    value={groupSplitValues[member.id] ?? ""}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
            <p
              aria-live="polite"
              className={`text-xs ${
                isPercentageSumValid
                  ? "text-muted-foreground"
                  : "text-danger-text font-medium"
              }`}
              role="status"
            >
              Summe:{" "}
              {totalPercentageBasisPoints !== null
                ? (totalPercentageBasisPoints / 100).toFixed(2).replace(".", ",")
                : "ungültig"}{" "}
              % {!isPercentageSumValid && "(muss genau 100 % ergeben)"}
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            className="rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover"
            disabled={isSaveDisabled}
            type="submit"
          >
            {isSavingSplitDefault ? "Speichert ..." : "Standard speichern"}
          </Button>
        </div>
      </form>
    </section>
  )
}
