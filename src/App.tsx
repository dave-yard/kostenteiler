import { AuthScreen } from "@/components/AuthScreen"
import { useAuth } from "@/components/contexts/AuthContext"
import { GroupOverviewProvider } from "@/components/contexts/GroupOverviewContext"
import { GroupOverview } from "@/pages/GroupOverview/GroupOverview"
import { PasswordRecovery } from "@/pages/PasswordRecovery/PasswordRecovery"

function isPasswordRecoveryCallback() {
  return (
    new URLSearchParams(window.location.hash.slice(1)).get("type") ===
    "recovery"
  )
}

export function App() {
  const { session, isLoading, isPasswordRecovery, configurationError } =
    useAuth()

  if (configurationError) {
    return <AuthScreen />
  }

  if (isPasswordRecovery || isPasswordRecoveryCallback()) {
    return <PasswordRecovery />
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
