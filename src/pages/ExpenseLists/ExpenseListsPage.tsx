import { useParams, useNavigate } from "react-router-dom"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { ExpenseLists } from "@/pages/ExpenseLists/ExpenseLists"
import { useState } from "react"

export function ExpenseListsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const { groups, isLoading } = useGroupOverview()
  const navigate = useNavigate()
  const [includeCompleted, setIncludeCompleted] = useState(false)

  const group = groups.find((g) => g.id === groupId)

  if (isLoading) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Gruppe wird geladen ...
      </p>
    )
  }

  if (!group) {
    return (
      <p className="p-8 text-center text-sm text-destructive">
        Gruppe nicht gefunden.
      </p>
    )
  }

  return (
    <ExpenseLists
      group={group}
      includeCompleted={includeCompleted}
      onIncludeCompletedChange={setIncludeCompleted}
      onBack={() => navigate(`/`)}
      onOpenList={(list) => navigate(`/groups/${group.id}/lists/${list.id}`)}
    />
  )
}
