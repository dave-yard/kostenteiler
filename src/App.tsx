import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
  useNavigate,
} from "react-router-dom"
import { AuthScreen } from "@/components/AuthScreen"
import { useAuth } from "@/components/contexts/AuthContext"
import { ExpenseListProvider } from "@/components/contexts/ExpenseListContext"
import { ExpenseListsPage } from "./pages/ExpenseLists/ExpenseListsPage"
import { GroupOverviewProvider } from "@/components/contexts/GroupOverviewContext"
import { GroupOverview } from "@/pages/GroupOverview/GroupOverview"
import { PasswordRecovery } from "@/pages/PasswordRecovery/PasswordRecovery"
import { PersonalContacts } from "@/pages/PersonalContacts/PersonalContacts"
import { useRef, useState } from "react"
import { CircleDollarSign, ContactRound, Home, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExpenseListDetailPage } from "./pages/ExpenseListDetail/ExpenseListDetailPage"
import { GroupAdminPage } from "./pages/GroupAdmin/GroupAdminPage"

// Geschütztes Layout für eingeloggte Bereiche
function AuthenticatedLayout() {
  const navigate = useNavigate()
  const [isNavigationMenuOpen, setIsNavigationMenuOpen] = useState(false)
  const navigationMenuRef = useRef<HTMLDivElement>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const { session, signOut } = useAuth()
  if (!session) {
    return <Navigate to="/auth" replace />
  }

  function getErrorMessage(error: unknown) {
    return error instanceof Error
      ? error.message
      : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
  }

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)

    try {
      await signOut()
    } catch (error) {
      setSignOutError(getErrorMessage(error))
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <GroupOverviewProvider key={session.user.id}>
      <ExpenseListProvider>
        <main className="flex min-h-dvh flex-col bg-app-bg text-foreground">
          <header className="z-20 shrink-0 border-b border-black/5 bg-brand-primary backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
              <div className="relative" ref={navigationMenuRef}>
                <Button
                  aria-expanded={isNavigationMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Navigation öffnen"
                  className="h-9 gap-2.5 rounded-full border border-white/40 bg-brand-primary px-3 py-1 text-primary-foreground shadow-sm transition-colors hover:bg-brand-primary-hover hover:text-primary-foreground"
                  onClick={() => setIsNavigationMenuOpen((isOpen) => !isOpen)}
                  type="button"
                  variant="ghost"
                >
                  <span className="text-primary-foreground] flex size-6 items-center justify-center rounded-full">
                    <CircleDollarSign aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="font-semibold tracking-tight">
                    Kostenteiler
                  </span>
                </Button>
                {isNavigationMenuOpen && (
                  <nav
                    aria-label="Hauptnavigation"
                    className="absolute top-full left-0 z-30 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl"
                    role="menu"
                  >
                    <Button
                      className="h-11 w-full justify-start gap-3 rounded-xl text-brand-text"
                      onClick={() => {
                        // setSelectedGroup(null)
                        // setAdminGroupId(null)
                        // setIsShowingContacts(false)
                        navigate("/")
                        setIsNavigationMenuOpen(false)
                      }}
                      role="menuitem"
                      type="button"
                      variant="ghost"
                    >
                      <Home aria-hidden="true" className="size-4" />
                      Gruppen
                    </Button>
                    <div
                      aria-hidden="true"
                      className="my-1 border-t border-border"
                    />
                    <Button
                      className="h-11 w-full justify-start gap-3 rounded-xl text-brand-text"
                      onClick={() => {
                        // setSelectedGroup(null)
                        // setAdminGroupId(null)
                        // setIsShowingContacts(true)
                        navigate("/contacts")
                        setIsNavigationMenuOpen(false)
                      }}
                      role="menuitem"
                      type="button"
                      variant="ghost"
                    >
                      <ContactRound aria-hidden="true" className="size-4" />
                      Freundesliste
                    </Button>
                  </nav>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground">
                <span className="hidden max-w-48 truncate sm:inline">
                  {session?.user.email ?? "Angemeldet"}
                </span>
                <Button
                  aria-label="Abmelden"
                  className="ml-1 rounded-xl bg-transparent"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  variant="outline"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Abmelden</span>
                </Button>
              </div>
            </div>
          </header>
          {signOutError && (
            <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
              <p
                className="border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text"
                role="alert"
              >
                {signOutError}
              </p>
            </div>
          )}
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-0 py-0 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>{" "}
      </ExpenseListProvider>
    </GroupOverviewProvider>
  )
}

function PublicAuthRoute() {
  const { session } = useAuth()

  if (session) {
    return <Navigate to="/" replace />
  }

  return <AuthScreen />
}

// Router-Definition mit basename aus vite.config.ts
export const router = createBrowserRouter(
  [
    {
      path: "/auth",
      element: <PublicAuthRoute />,
    },
    {
      path: "/recovery",
      element: <PasswordRecovery />,
    },
    {
      element: <AuthenticatedLayout />,
      children: [
        {
          path: "/",
          element: <GroupOverview />,
        },
        {
          path: "/groups/:groupId/admin",
          element: <GroupAdminPage />, // analog mit useParams
        },
        {
          path: "/groups/:groupId",
          element: <ExpenseListsPage />,
        },
        {
          path: "/groups/:groupId/lists/:listId",
          element: <ExpenseListDetailPage />,
        },
        {
          path: "/contacts",
          element: <PersonalContacts />,
        },
      ],
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
)

export function App() {
  const { isLoading, isPasswordRecovery, configurationError } = useAuth()

  if (configurationError) {
    return <AuthScreen />
  }

  if (isPasswordRecovery) {
    return <PasswordRecovery />
  }

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-app-bg">
        <p className="text-sm text-muted-foreground" role="status">
          Sitzung wird geladen ...
        </p>
      </main>
    )
  }

  return <RouterProvider router={router} />
}

export default App
