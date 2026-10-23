import { AuthScreen } from "@/components/AuthScreen"
import { useAuth } from "@/components/contexts/AuthContext"
import { GroupOverviewProvider } from "@/components/contexts/GroupOverviewContext"
import { GroupOverview } from "@/pages/GroupOverview/GroupOverview"

export function App() {
  const { session, isLoading, configurationError } = useAuth()

  if (configurationError) {
    return <AuthScreen />
  }

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f5f6f2]">
        <p className="text-sm text-[#72766f]" role="status">
          Sitzung wird geladen ...
        </p>
      </main>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <GroupOverviewProvider key={session.user.id}>
      <GroupOverview />
    </GroupOverviewProvider>
  )
}

export default App
