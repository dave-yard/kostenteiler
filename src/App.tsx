import { useState } from "react"
import { LogOut, ReceiptText, ShieldCheck } from "lucide-react"
import { AuthScreen } from "@/components/AuthScreen"
import { useAuth } from "@/components/contexts/AuthContext"
import { Button } from "@/components/ui/button"

export function App() {
  const { session, isLoading, configurationError, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)

    try {
      await signOut()
    } catch (error) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : "Das Abmelden ist fehlgeschlagen. Bitte versuche es erneut."
      )
    } finally {
      setIsSigningOut(false)
    }
  }

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
    <main className="flex min-h-svh items-center justify-center bg-[#f5f6f2] px-4 py-10 text-[#20241f]">
      <section className="w-full max-w-xl rounded-[2rem] border border-black/5 bg-white p-7 shadow-[0_32px_100px_-48px_rgba(32,36,31,0.35)] sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1f3b2d] text-white">
              <ReceiptText aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Kostenteiler</p>
              <p className="text-xs text-[#72766f]">Dein Konto</p>
            </div>
          </div>
          <Button
            className="gap-2 rounded-xl"
            disabled={isSigningOut}
            onClick={handleSignOut}
            variant="outline"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Abmelden
          </Button>
        </div>

        <div className="mt-12">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
            Du bist angemeldet.
          </h1>
          <p className="mt-2 text-sm text-[#72766f]">
            Deine Supabase-Anmeldung ist aktiv.
          </p>

          <div className="mt-7 rounded-2xl border border-[#e8ebe5] bg-[#fafbf9] p-4">
            <p className="text-xs font-medium tracking-wide text-[#858a81] uppercase">
              Angemeldet als
            </p>
            <p className="mt-1 break-all text-sm font-medium">
              {session.user.email ?? session.user.id}
            </p>
          </div>

          {signOutError && (
            <p
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {signOutError}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
