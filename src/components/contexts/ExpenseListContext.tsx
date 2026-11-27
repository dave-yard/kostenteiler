import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { useAuth } from "@/components/contexts/AuthContext"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { getGroupMembers, getGroupSplitDefault } from "@/services/groupService"
import {
  createExpenseItem as createExpenseItemRecord,
  deleteExpenseItem as deleteExpenseItemRecord,
  getExpenseItemSplitRule as getExpenseItemSplitRuleRecord,
  getExpenseItemTransferPairs as getExpenseItemTransferPairsRecord,
  getExpenseItems as getExpenseItemsRecord,
  getExpenseListMemberNames as getExpenseListMemberNamesRecord,
  getExpenseListSplitRules as getExpenseListSplitRulesRecord,
  getReceiptImage as getReceiptImageRecord,
  transferExpenseItemToList as transferExpenseItemToListRecord,
  updateExpenseItem as updateExpenseItemRecord,
  uploadAndProcessReceipt as uploadAndProcessReceiptRecord,
  type ExpenseItemInput,
  type ExpenseItemTransferTarget,
  type ReceiptImageResult,
  type UploadAndProcessReceiptResult,
} from "@/services/itemService"
import {
  completeExpenseList as completeExpenseListRecord,
  createExpenseList as createExpenseListRecord,
  getExpenseLists as getExpenseListsRecord,
  getExpenseListPayments as getExpenseListPaymentsRecord,
  markExpenseListPaymentPaid as markExpenseListPaymentPaidRecord,
  updateExpenseListType as updateExpenseListTypeRecord,
  type UpdateExpenseListTypeParams,
} from "@/services/listService"
import {
  processRecurringExpenseLists,
  type RecurringProcessingResult,
} from "@/services/recurringService"
import type {
  CreateExpenseListParams,
  ExpenseItem,
  ExpenseItemTransferPair,
  ExpenseItemTransferResult,
  ExpenseList,
  ExpenseListPayment,
  Group,
  GroupMember,
} from "@/types/group"
import type { ExpenseSplitRule } from "@/lib/expenseSplit"
import type { SettlementTransfer } from "@/lib/settlement"

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
  groupDataRevision: number
  getExpenseLists: (
    groupId: string,
    includePaid: boolean
  ) => Promise<ExpenseList[]>
  createExpenseList: (
    groupId: string,
    params: string | CreateExpenseListParams
  ) => Promise<string>
  updateExpenseListType: (
    listId: string,
    params: UpdateExpenseListTypeParams
  ) => Promise<void>
  processRecurringLists: (groupId: string) => Promise<RecurringProcessingResult>
  completeExpenseList: (
    listId: string,
    payments?: SettlementTransfer[]
  ) => Promise<void>
  getExpenseListPayments: (listId: string) => Promise<ExpenseListPayment[]>
  markExpenseListPaymentPaid: (paymentId: string) => Promise<boolean>
  canCloseExpenseLists: (group: Group) => Promise<boolean>
  getExpenseItems: (listId: string) => Promise<ExpenseItem[]>
  createExpenseItem: (
    listId: string,
    input: ExpenseItemInput
  ) => Promise<string>
  updateExpenseItem: (itemId: string, input: ExpenseItemInput) => Promise<void>
  transferExpenseItemToList: (
    sourceItemId: string,
    target: ExpenseItemTransferTarget
  ) => Promise<ExpenseItemTransferResult>
  getExpenseItemTransferPairs: (
    itemIds: string[]
  ) => Promise<ExpenseItemTransferPair[]>
  uploadAndProcessReceipt: (
    listId: string,
    file: File,
    currentMemberId: string
  ) => Promise<UploadAndProcessReceiptResult>
  deleteExpenseItem: (itemId: string) => Promise<void>
  getExpenseItemSplitRule: (itemId: string) => Promise<ExpenseSplitRule>
  getExpenseListSplitRules: (
    listId: string
  ) => Promise<Record<string, ExpenseSplitRule>>
  getItemAccess: (
    group: Group,
    list?: ExpenseList
  ) => Promise<ExpenseItemAccess>
  getReceiptImage: (
    expenseItemId: string,
    forceRefresh?: boolean
  ) => Promise<ReceiptImageResult | null>
}

const ExpenseListContext = createContext<ExpenseListContextValue | undefined>(
  undefined
)

export function resolveExpenseListMembers(
  currentMembers: GroupMember[],
  namesSnapshot: Record<string, string> | null
): GroupMember[] {
  if (!namesSnapshot) {
    return currentMembers.filter(
      (member) => member.membershipStatus !== "removed"
    )
  }

  const currentById = new Map(
    currentMembers.map((member) => [member.id, member])
  )
  return Object.entries(namesSnapshot).map(([memberId, displayName]) => {
    const member = currentById.get(memberId)
    if (member) {
      return { ...member, displayName }
    }

    return {
      id: memberId,
      userId: null,
      displayName,
      email: null,
      role: "member",
      membershipStatus: "removed",
      canCreateItems: false,
      canEditItems: false,
      canDeleteItems: false,
      canEditSplits: false,
      canCloseLists: false,
    }
  })
}

export function ExpenseListProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { groupDataRevision } = useGroupOverview()
  const userId = session?.user.id
  const metadataName: unknown = session?.user.user_metadata?.display_name
  const ownName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : null

  const getExpenseLists = useCallback(
    (groupId: string, includePaid: boolean) =>
      getExpenseListsRecord(groupId, includePaid),
    []
  )

  const createExpenseList = useCallback(
    (groupId: string, params: string | CreateExpenseListParams) =>
      createExpenseListRecord(groupId, params),
    []
  )

  const updateExpenseListType = useCallback(
    (listId: string, params: UpdateExpenseListTypeParams) =>
      updateExpenseListTypeRecord(listId, params),
    []
  )

  const processRecurringLists = useCallback(
    (groupId: string) => processRecurringExpenseLists(groupId),
    []
  )

  const completeExpenseList = useCallback(
    (listId: string, payments?: SettlementTransfer[]) =>
      completeExpenseListRecord(listId, payments),
    []
  )

  const getExpenseListPayments = useCallback(
    (listId: string) => getExpenseListPaymentsRecord(listId),
    []
  )

  const markExpenseListPaymentPaid = useCallback(
    (paymentId: string) => markExpenseListPaymentPaidRecord(paymentId),
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

  const transferExpenseItemToList = useCallback(
    (sourceItemId: string, target: ExpenseItemTransferTarget) =>
      transferExpenseItemToListRecord(sourceItemId, target),
    []
  )

  const getExpenseItemTransferPairs = useCallback(
    (itemIds: string[]) => getExpenseItemTransferPairsRecord(itemIds),
    []
  )

  const uploadAndProcessReceipt = useCallback(
    (listId: string, file: File, currentMemberId: string) =>
      uploadAndProcessReceiptRecord(listId, file, currentMemberId),
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

  const getReceiptImage = useCallback(
    (expenseItemId: string, forceRefresh?: boolean) =>
      getReceiptImageRecord(expenseItemId, forceRefresh),
    []
  )

  const getItemAccess = useCallback(
    async (group: Group, list?: ExpenseList): Promise<ExpenseItemAccess> => {
      const frozenNames =
        list && list.status !== "open"
          ? getExpenseListMemberNamesRecord(list.id)
          : Promise.resolve(null)
      const [loadedMembers, groupDefaultSplitRule, names] = await Promise.all([
        getGroupMembers(group.id),
        getGroupSplitDefault(group.id),
        frozenNames,
      ])
      const frozenMembers = resolveExpenseListMembers(loadedMembers, names)
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
      groupDataRevision,
      getExpenseLists,
      createExpenseList,
      updateExpenseListType,
      processRecurringLists,
      completeExpenseList,
      getExpenseListPayments,
      markExpenseListPaymentPaid,
      canCloseExpenseLists,
      getExpenseItems,
      createExpenseItem,
      updateExpenseItem,
      transferExpenseItemToList,
      getExpenseItemTransferPairs,
      uploadAndProcessReceipt,
      deleteExpenseItem,
      getExpenseItemSplitRule,
      getExpenseListSplitRules,
      getItemAccess,
      getReceiptImage,
    }),
    [
      groupDataRevision,
      getExpenseLists,
      createExpenseList,
      updateExpenseListType,
      processRecurringLists,
      completeExpenseList,
      getExpenseListPayments,
      markExpenseListPaymentPaid,
      canCloseExpenseLists,
      getExpenseItems,
      createExpenseItem,
      updateExpenseItem,
      transferExpenseItemToList,
      getExpenseItemTransferPairs,
      uploadAndProcessReceipt,
      deleteExpenseItem,
      getExpenseItemSplitRule,
      getExpenseListSplitRules,
      getItemAccess,
      getReceiptImage,
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
