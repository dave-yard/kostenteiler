import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { useExpenseLists } from "@/components/contexts/ExpenseListContext"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { type ExpenseList } from "@/types/group"
import { ExpenseListDetail } from "./ExpenseListDetail"

export function ExpenseListDetailPage() {
  const { groupId, listId } = useParams<{ groupId: string; listId: string }>()
  const { groups } = useGroupOverview()
  const { getExpenseLists } = useExpenseLists()
  const navigate = useNavigate()

  // Gruppe direkt synchron aus dem Context ableiten (kein setState im Effekt nötig!)
  const group = groups.find((f) => f.id === groupId) ?? null

  const [expenseList, setExpenseList] = useState<ExpenseList | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(
    Boolean(groupId && listId)
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (groupId)
      getExpenseLists(groupId, true)
        .then((nextLists) => {
          if (!isMounted) return
          const foundList = nextLists.find((f) => f.id === listId)
          setExpenseList(foundList || null)
        })
        .catch((err: unknown) => {
          if (!isMounted) return
          setError(
            err instanceof Error ? err.message : "Ein Fehler ist aufgetreten"
          )
        })
        .finally(() => {
          if (!isMounted) return
          setIsLoading(false)
        })

    return () => {
      isMounted = false
    }
  }, [groupId, listId, getExpenseLists])

  if (isLoading) {
    return (
      <p className="p-8 text-center text-sm text-[#72766f]">
        Liste wird geladen ...
      </p>
    )
  }

  if (error) {
    return (
      <p className="p-8 text-center text-sm text-red-600">Fehler: {error}</p>
    )
  }

  if (!groupId || !group || !listId || !expenseList) {
    return (
      <p className="p-8 text-center text-sm text-red-600">
        {!group
          ? "Gruppe nicht gefunden"
          : `Liste nicht gefunden (${groupId}|${listId}).`}
      </p>
    )
  }

  return (
    <ExpenseListDetail
      group={group}
      list={expenseList}
      onBack={() => navigate("/")}
    />
  )
}
