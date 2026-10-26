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
  sendPasswordRecoveryEmail as sendPasswordRecoveryEmailRequest,
  signInWithPassword as signInWithPasswordRequest,
  signOut as signOutRequest,
  signUpWithPassword as signUpWithPasswordRequest,
  updatePassword as updatePasswordRequest,
} from "@/services/authService"
import {
  getSupabaseClient,
  getSupabaseConfigurationError,
} from "@/lib/supabase"

interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  isPasswordRecovery: boolean
  configurationError: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>
  resendSignupConfirmation: (email: string) => Promise<void>
  sendMagicLink: (email: string) => Promise<void>
  sendPasswordRecoveryEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configurationError = getSupabaseConfigurationError()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(configurationError === null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    if (configurationError) {
      return
    }

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true)
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false)
      }
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

  const sendPasswordRecoveryEmail = useCallback((email: string) => {
    return sendPasswordRecoveryEmailRequest(email)
  }, [])

  const updatePassword = useCallback((password: string) => {
    return updatePasswordRequest(password)
  }, [])

  const signOut = useCallback(() => signOutRequest(), [])

  const value = useMemo(
    () => ({
      session,
      isLoading,
      isPasswordRecovery,
      configurationError,
      signInWithPassword: signIn,
      signUpWithPassword: signUp,
      resendSignupConfirmation,
      sendMagicLink,
      sendPasswordRecoveryEmail,
      updatePassword,
      signOut,
    }),
    [
      session,
      isLoading,
      isPasswordRecovery,
      configurationError,
      signIn,
      signUp,
      resendSignupConfirmation,
      sendMagicLink,
      sendPasswordRecoveryEmail,
      updatePassword,
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
