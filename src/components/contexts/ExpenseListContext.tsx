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
  createExpenseItem as createExpenseItemRecord,
  deleteExpenseItem as deleteExpenseItemRecord,
  getExpenseItems as getExpenseItemsRecord,
  updateExpenseItem as updateExpenseItemRecord,
  type ExpenseItemInput,
} from "@/services/itemService"
import {
  completeExpenseList as completeExpenseListRecord,
  createExpenseList as createExpenseListRecord,
  getExpenseLists as getExpenseListsRecord,
  markExpenseListPaid as markExpenseListPaidRecord,
} from "@/services/listService"
import type {
  ExpenseItem,
  ExpenseList,
  Group,
  GroupMember,
} from "@/types/group"

export interface ExpenseItemAccess {
  members: GroupMember[]
  currentMemberId: string | null
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

interface ExpenseListContextValue {
  getExpenseLists: (
    groupId: string,
    includeCompleted: boolean
  ) => Promise<ExpenseList[]>
  createExpenseList: (groupId: string, name: string) => Promise<string>
  completeExpenseList: (listId: string) => Promise<void>
  markExpenseListPaid: (listId: string) => Promise<void>
  canCloseExpenseLists: (group: Group) => Promise<boolean>
  getExpenseItems: (listId: string) => Promise<ExpenseItem[]>
  createExpenseItem: (
    listId: string,
    input: ExpenseItemInput
  ) => Promise<string>
  updateExpenseItem: (itemId: string, input: ExpenseItemInput) => Promise<void>
  deleteExpenseItem: (itemId: string) => Promise<void>
  getItemAccess: (group: Group) => Promise<ExpenseItemAccess>
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

  const getExpenseItems = useCallback(
    (listId: string) => getExpenseItemsRecord(listId),
    []
  )

  const createExpenseItem = useCallback(
    (listId: string, input: ExpenseItemInput) =>
      createExpenseItemRecord(listId, input),
    []
  )

  const updateExpenseItem = useCallback(
    (itemId: string, input: ExpenseItemInput) =>
      updateExpenseItemRecord(itemId, input),
    []
  )

  const deleteExpenseItem = useCallback(
    (itemId: string) => deleteExpenseItemRecord(itemId),
    []
  )

  const getItemAccess = useCallback(
    async (group: Group): Promise<ExpenseItemAccess> => {
      const members = await getGroupMembers(group.id)
      const me = members.find((member) => member.userId === userId)
      const isAdmin = group.currentUserIsAdmin

      return {
        members,
        currentMemberId: me?.id ?? null,
        canCreate: isAdmin || Boolean(me?.canCreateItems),
        canEdit: isAdmin || Boolean(me?.canEditItems),
        canDelete: isAdmin || Boolean(me?.canDeleteItems),
      }
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
      getExpenseItems,
      createExpenseItem,
      updateExpenseItem,
      deleteExpenseItem,
      getItemAccess,
    }),
    [
      getExpenseLists,
      createExpenseList,
      completeExpenseList,
      markExpenseListPaid,
      canCloseExpenseLists,
      getExpenseItems,
      createExpenseItem,
      updateExpenseItem,
      deleteExpenseItem,
      getItemAccess,
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
