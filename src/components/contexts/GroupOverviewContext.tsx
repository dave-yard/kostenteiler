import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  createGroup as createGroupRecord,
  createPersonalContact as createPersonalContactRecord,
  acceptGroupInvitation as acceptGroupInvitationRecord,
  createGroupInvitation as createGroupInvitationRecord,
  getGroupInvitation as getGroupInvitationRecord,
  getGroupMembers as getGroupMembersRecord,
  getMyGroups,
  getMyContacts as getMyContactsRecord,
  removePersonalContact as removePersonalContactRecord,
  removeGroupMember as removeGroupMemberRecord,
  renameGroup as renameGroupRecord,
  saveMyGroupOrder as saveMyGroupOrderRecord,
  setGroupMemberAdmin as setGroupMemberAdminRecord,
  updateGroupMemberPermissions as updateGroupMemberPermissionsRecord,
} from "@/services/groupService"
import { getExpenseLists as getExpenseListsRecord } from "@/services/listService"
import type {
  Group,
  GroupInvitation,
  ExpenseList,
  GroupMember,
  GroupMemberPermissions,
  PersonalContact,
} from "@/types/group"

interface GroupOverviewContextValue {
  groups: Group[]
  isLoading: boolean
  loadError: string | null
  refreshGroups: () => Promise<void>
  createGroup: (name: string) => Promise<string>
  saveGroupOrder: (groupIds: string[]) => Promise<void>
  getExpenseLists: (
    groupId: string,
    includeCompleted: boolean
  ) => Promise<ExpenseList[]>
  getMyContacts: () => Promise<PersonalContact[]>
  createPersonalContact: (displayName: string, email: string) => Promise<void>
  removePersonalContact: (contactId: string) => Promise<void>
  createGroupInvitation: (groupId: string, contactId: string) => Promise<string>
  getGroupInvitation: (token: string) => Promise<GroupInvitation>
  acceptGroupInvitation: (token: string) => Promise<string>
  renameGroup: (groupId: string, name: string) => Promise<void>
  getGroupMembers: (groupId: string) => Promise<GroupMember[]>
  setGroupMemberAdmin: (memberId: string, isAdmin: boolean) => Promise<void>
  updateGroupMemberPermissions: (
    memberId: string,
    permissions: GroupMemberPermissions
  ) => Promise<void>
  removeGroupMember: (memberId: string) => Promise<void>
}

const GroupOverviewContext = createContext<
  GroupOverviewContextValue | undefined
>(undefined)

export function GroupOverviewProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshGroups = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      setGroups(await getMyGroups())
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Deine Gruppen konnten nicht geladen werden."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    async function loadInitialGroups() {
      try {
        const loadedGroups = await getMyGroups()
        if (isCurrent) {
          setGroups(loadedGroups)
        }
      } catch (error) {
        if (isCurrent) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Deine Gruppen konnten nicht geladen werden."
          )
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialGroups()

    return () => {
      isCurrent = false
    }
  }, [])

  const createGroup = useCallback(async (name: string) => {
    return createGroupRecord(name)
  }, [])

  const getExpenseLists = useCallback(
    (groupId: string, includeCompleted: boolean) =>
      getExpenseListsRecord(groupId, includeCompleted),
    []
  )

  const getMyContacts = useCallback(() => getMyContactsRecord(), [])
  const createPersonalContact = useCallback(
    (displayName: string, email: string) =>
      createPersonalContactRecord(displayName, email),
    []
  )
  const removePersonalContact = useCallback(
    (contactId: string) => removePersonalContactRecord(contactId),
    []
  )
  const createGroupInvitation = useCallback(
    (groupId: string, contactId: string) =>
      createGroupInvitationRecord(groupId, contactId),
    []
  )
  const getGroupInvitation = useCallback(
    (token: string) => getGroupInvitationRecord(token),
    []
  )
  const acceptGroupInvitation = useCallback(
    (token: string) => acceptGroupInvitationRecord(token),
    []
  )

  const saveGroupOrder = useCallback(
    async (groupIds: string[]) => {
      const previousGroups = groups
      const groupsById = new Map(groups.map((group) => [group.id, group]))
      if (
        groupIds.length !== groups.length ||
        new Set(groupIds).size !== groups.length ||
        groupIds.some((groupId) => !groupsById.has(groupId))
      ) {
        throw new Error("Die Gruppenreihenfolge ist ungültig.")
      }

      setGroups(
        groupIds.map((groupId, sortNr) => ({
          ...groupsById.get(groupId)!,
          sortNr,
        }))
      )

      try {
        await saveMyGroupOrderRecord(groupIds)
      } catch (error) {
        setGroups(previousGroups)
        throw error
      }
    },
    [groups]
  )

  const renameGroup = useCallback(
    (groupId: string, name: string) => renameGroupRecord(groupId, name),
    []
  )
  const getGroupMembers = useCallback(
    (groupId: string) => getGroupMembersRecord(groupId),
    []
  )
  const setGroupMemberAdmin = useCallback(
    (memberId: string, isAdmin: boolean) =>
      setGroupMemberAdminRecord(memberId, isAdmin),
    []
  )
  const updateGroupMemberPermissions = useCallback(
    (memberId: string, permissions: GroupMemberPermissions) =>
      updateGroupMemberPermissionsRecord(memberId, permissions),
    []
  )
  const removeGroupMember = useCallback(
    (memberId: string) => removeGroupMemberRecord(memberId),
    []
  )

  const value = useMemo(
    () => ({
      groups,
      isLoading,
      loadError,
      refreshGroups,
      createGroup,
      saveGroupOrder,
      getExpenseLists,
      getMyContacts,
      createPersonalContact,
      removePersonalContact,
      createGroupInvitation,
      getGroupInvitation,
      acceptGroupInvitation,
      renameGroup,
      getGroupMembers,
      setGroupMemberAdmin,
      updateGroupMemberPermissions,
      removeGroupMember,
    }),
    [
      groups,
      isLoading,
      loadError,
      refreshGroups,
      createGroup,
      saveGroupOrder,
      getExpenseLists,
      getMyContacts,
      createPersonalContact,
      removePersonalContact,
      createGroupInvitation,
      getGroupInvitation,
      acceptGroupInvitation,
      renameGroup,
      getGroupMembers,
      setGroupMemberAdmin,
      updateGroupMemberPermissions,
      removeGroupMember,
    ]
  )

  return (
    <GroupOverviewContext.Provider value={value}>
      {children}
    </GroupOverviewContext.Provider>
  )
}

export function useGroupOverview() {
  const context = useContext(GroupOverviewContext)
  if (!context) {
    throw new Error(
      "useGroupOverview muss innerhalb des GroupOverviewProvider verwendet werden."
    )
  }

  return context
}
