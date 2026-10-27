import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { useAuth } from "@/components/contexts/AuthContext"
import { getGroupMembers } from "@/services/groupService"
import {
  completeExpenseList as completeExpenseListRecord,
  createExpenseList as createExpenseListRecord,
  getExpenseLists as getExpenseListsRecord,
  markExpenseListPaid as markExpenseListPaidRecord,
} from "@/services/listService"
import type { ExpenseList, Group } from "@/types/group"

interface ExpenseListContextValue {
  getExpenseLists: (
    groupId: string,
    includeCompleted: boolean
  ) => Promise<ExpenseList[]>
  createExpenseList: (groupId: string, name: string) => Promise<string>
  completeExpenseList: (listId: string) => Promise<void>
  markExpenseListPaid: (listId: string) => Promise<void>
  canCloseExpenseLists: (group: Group) => Promise<boolean>
}

const ExpenseListContext = createContext<ExpenseListContextValue | undefined>(
  undefined
)

export function ExpenseListProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id

  const getExpenseLists = useCallback(
    (groupId: string, includeCompleted: boolean) =>
      getExpenseListsRecord(groupId, includeCompleted),
    []
  )

  const createExpenseList = useCallback(
    (groupId: string, name: string) => createExpenseListRecord(groupId, name),
    []
  )

  const completeExpenseList = useCallback(
    (listId: string) => completeExpenseListRecord(listId),
    []
  )

  const markExpenseListPaid = useCallback(
    (listId: string) => markExpenseListPaidRecord(listId),
    []
  )

  const canCloseExpenseLists = useCallback(
    async (group: Group) => {
      if (group.currentUserIsAdmin) {
        return true
      }

      const members = await getGroupMembers(group.id)
      return members.some(
        (member) => member.userId === userId && member.canCloseLists
      )
    },
    [userId]
  )

  const value = useMemo(
    () => ({
      getExpenseLists,
      createExpenseList,
      completeExpenseList,
      markExpenseListPaid,
      canCloseExpenseLists,
    }),
    [
      getExpenseLists,
      createExpenseList,
      completeExpenseList,
      markExpenseListPaid,
      canCloseExpenseLists,
    ]
  )

  return (
    <ExpenseListContext.Provider value={value}>
      {children}
    </ExpenseListContext.Provider>
  )
}

export function useExpenseLists() {
  const context = useContext(ExpenseListContext)
  if (!context) {
    throw new Error(
      "useExpenseLists muss innerhalb des ExpenseListProvider verwendet werden."
    )
  }

  return context
}
