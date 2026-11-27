export interface Group {
  id: string
  name: string
  sortNr: number
  memberCount: number
  currentUserIsAdmin: boolean
  archivedAt: string | null
}

export type ExpenseListType = "one_off" | "recurring"
export type RecurringInterval = "monthly" | "quarterly" | "yearly"

export interface ExpenseList {
  id: string
  groupId: string
  name: string
  status: "open" | "completed" | "isPaid"
  createdAt: string
  createdByUserId?: string | null
  completedAt: string | null
  completedByUserId?: string | null
  paidAt: string | null
  paidByUserId?: string | null
  listType?: ExpenseListType
  interval?: RecurringInterval | null
  dayOfMonth?: number | null
  autoClose?: boolean
}

export interface ExpenseListPayment {
  id: string
  listId: string
  fromMemberId: string
  toMemberId: string
  amountCents: number
  status: "pending" | "paid"
  paidAt: string | null
  paidByUserId: string | null
}

export interface CreateExpenseListParams {
  name: string
  listType?: ExpenseListType
  interval?: RecurringInterval | null
  dayOfMonth?: number | null
  autoClose?: boolean
}

export interface ExpenseItem {
  id: string
  listId: string
  name: string
  amountCents: number
  paidByMemberId: string | null
  isPayerAllocation: boolean
  isReceipt: boolean
  parentItemId: string | null
  item_date: string
  createdAt: string
}

export interface ExpenseItemDatabaseRow {
  id: string
  list_id: string
  name: string
  amount_cents: number
  paid_by_member_id: string | null
  is_payer_allocation: boolean
  is_receipt: boolean
  parent_item_id: string | null
  item_date: string
  created_at: string
}

export interface ExpenseItemTransferPair {
  transferId: string
  sourceItemId: string
  offsetItemId: string
  targetItemId: string
  isRoot: boolean
}

export interface ExpenseItemTransferResult {
  transferId: string
  offsetRootItemId: string
  targetRootItemId: string
}

export interface GroupMemberPermissions {
  canCreateItems: boolean
  canEditItems: boolean
  canDeleteItems: boolean
  canEditSplits: boolean
  canCloseLists: boolean
}

export interface GroupMember extends GroupMemberPermissions {
  id: string
  userId: string | null
  displayName: string
  email: string | null
  role: "admin" | "member"
  membershipStatus: "active" | "pending" | "legacy" | "removed"
}

export interface GroupInvitation {
  groupId: string
  groupName: string
  displayName: string
}

export interface PersonalContact {
  id: string
  displayName: string | null
  email: string | null
}
