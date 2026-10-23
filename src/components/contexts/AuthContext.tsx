import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import {
  resendSignupConfirmation as resendSignupConfirmationRequest,
  sendMagicLink as sendMagicLinkRequest,
  signInWithPassword as signInWithPasswordRequest,
  signOut as signOutRequest,
  signUpWithPassword as signUpWithPasswordRequest,
} from "@/services/authService"
import { getSupabaseClient, getSupabaseConfigurationError } from "@/lib/supabase"

interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  configurationError: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>
  resendSignupConfirmation: (email: string) => Promise<void>
  sendMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configurationError = getSupabaseConfigurationError()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(configurationError === null)

  useEffect(() => {
    if (configurationError) {
      return
    }

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [configurationError])

  const signIn = useCallback((email: string, password: string) => {
    return signInWithPasswordRequest(email, password)
  }, [])

  const signUp = useCallback((email: string, password: string) => {
    return signUpWithPasswordRequest(email, password)
  }, [])

  const resendSignupConfirmation = useCallback((email: string) => {
    return resendSignupConfirmationRequest(email)
  }, [])

  const sendMagicLink = useCallback((email: string) => {
    return sendMagicLinkRequest(email)
  }, [])

  const signOut = useCallback(() => signOutRequest(), [])

  const value = useMemo(
    () => ({
      session,
      isLoading,
      configurationError,
      signInWithPassword: signIn,
      signUpWithPassword: signUp,
      resendSignupConfirmation,
      sendMagicLink,
      signOut,
    }),
    [
      session,
      isLoading,
      configurationError,
      signIn,
      signUp,
      resendSignupConfirmation,
      sendMagicLink,
      signOut,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth muss innerhalb des AuthProvider verwendet werden.")
  }

  return context
}
