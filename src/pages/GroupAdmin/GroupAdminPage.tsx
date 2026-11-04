import { useParams, useNavigate } from "react-router-dom"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { GroupAdmin } from "./GroupAdmin"

// ;`/groups/${group.id}/admin`
export function GroupAdminPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const { groups, isLoading } = useGroupOverview()
  const navigate = useNavigate()

  const group = groups.find((g) => g.id === groupId)

  if (isLoading) {
    return (
      <p className="p-8 text-center text-sm text-[#72766f]">
        Gruppe wird geladen ...
      </p>
    )
  }

  if (!group) {
    return (
      <p className="p-8 text-center text-sm text-red-600">
        Gruppe nicht gefunden.
      </p>
    )
  }

  return <GroupAdmin group={group} onBack={() => navigate(`/`)} />
}
