import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import {
  createExpenseList as createExpenseListRecord,
  getExpenseLists as getExpenseListsRecord,
} from "@/services/listService"
import type { ExpenseList } from "@/types/group"

interface ExpenseListContextValue {
  getExpenseLists: (
    groupId: string,
    includeCompleted: boolean
  ) => Promise<ExpenseList[]>
  createExpenseList: (groupId: string, name: string) => Promise<string>
}

const ExpenseListContext = createContext<ExpenseListContextValue | undefined>(
  undefined
)

export function ExpenseListProvider({ children }: { children: ReactNode }) {
  const getExpenseLists = useCallback(
    (groupId: string, includeCompleted: boolean) =>
      getExpenseListsRecord(groupId, includeCompleted),
    []
  )

  const createExpenseList = useCallback(
    (groupId: string, name: string) => createExpenseListRecord(groupId, name),
    []
  )

  const value = useMemo(
    () => ({ getExpenseLists, createExpenseList }),
    [getExpenseLists, createExpenseList]
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
