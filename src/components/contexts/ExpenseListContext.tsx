import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { useAuth } from "@/components/contexts/AuthContext"
import { getGroupMembers, getGroupSplitDefault } from "@/services/groupService"
import {
  createExpenseItem as createExpenseItemRecord,
  deleteExpenseItem as deleteExpenseItemRecord,
  getExpenseItemSplitRule as getExpenseItemSplitRuleRecord,
  getExpenseItems as getExpenseItemsRecord,
  getExpenseListMemberNames as getExpenseListMemberNamesRecord,
  getExpenseListSplitRules as getExpenseListSplitRulesRecord,
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
import type { ExpenseSplitRule } from "@/lib/expenseSplit"

export interface ExpenseItemAccess {
  members: GroupMember[]
  currentMemberId: string | null
  canCreate: boolean
  canEdit: boolean
  canEditSplits: boolean
  canDelete: boolean
  canCloseLists: boolean
  groupDefaultSplitRule: ExpenseSplitRule
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
  getExpenseItemSplitRule: (itemId: string) => Promise<ExpenseSplitRule>
  getExpenseListSplitRules: (
    listId: string
  ) => Promise<Record<string, ExpenseSplitRule>>
  getItemAccess: (
    group: Group,
    list?: ExpenseList
  ) => Promise<ExpenseItemAccess>
}

const ExpenseListContext = createContext<ExpenseListContextValue | undefined>(
  undefined
)

export function ExpenseListProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const metadataName: unknown = session?.user.user_metadata?.display_name
  const ownName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : null

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

  const getExpenseItemSplitRule = useCallback(
    (itemId: string) => getExpenseItemSplitRuleRecord(itemId),
    []
  )

  const getExpenseListSplitRules = useCallback(
    (listId: string) => getExpenseListSplitRulesRecord(listId),
    []
  )

  const getItemAccess = useCallback(
    async (group: Group, list?: ExpenseList): Promise<ExpenseItemAccess> => {
      // Abgeschlossene Listen zeigen die Namen zum Zeitpunkt des Abschlusses.
      const frozenNames =
        list && list.status !== "open"
          ? getExpenseListMemberNamesRecord(list.id).catch(() => null)
          : Promise.resolve(null)
      const [loadedMembers, groupDefaultSplitRule, names] = await Promise.all([
        getGroupMembers(group.id),
        getGroupSplitDefault(group.id),
        frozenNames,
      ])
      const frozenMembers = names
        ? loadedMembers.map((member) => ({
            ...member,
            displayName: names[member.id] ?? member.displayName,
          }))
        : loadedMembers
      // Den eigenen Anzeigenamen sieht man in offenen Listen immer selbst.
      const members =
        ownName && !names && !group.archivedAt
          ? frozenMembers.map((member) =>
              member.userId === userId
                ? { ...member, displayName: ownName }
                : member
            )
          : frozenMembers
      const me = members.find((member) => member.userId === userId)
      const isAdmin = group.currentUserIsAdmin

      return {
        members,
        currentMemberId: me?.id ?? null,
        canCreate: isAdmin || Boolean(me?.canCreateItems),
        canEdit: isAdmin || Boolean(me?.canEditItems),
        canEditSplits: isAdmin || Boolean(me?.canEditSplits),
        canDelete: isAdmin || Boolean(me?.canDeleteItems),
        canCloseLists: isAdmin || Boolean(me?.canCloseLists),
        groupDefaultSplitRule,
      }
    },
    [userId, ownName]
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
      getExpenseItemSplitRule,
      getExpenseListSplitRules,
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
      getExpenseItemSplitRule,
      getExpenseListSplitRules,
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
