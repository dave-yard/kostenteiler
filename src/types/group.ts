export interface Group {
  id: string
  name: string
  sortNr: number
  memberCount: number
  currentUserIsAdmin: boolean
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
  membershipStatus: "active" | "pending" | "legacy"
}

export interface GroupInvitation {
  groupId: string
  groupName: string
  displayName: string
}

export interface PersonalContact {
  id: string
  displayName: string
  email: string
}
