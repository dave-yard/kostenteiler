import { getSupabaseClient } from "@/lib/supabase"

function getEmailRedirectUrl() {
  if (window.location.hostname === "dave-yard.github.io") {
    return "https://dave-yard.github.io/kostenteiler/"
  }

  // Lokalentwicklung: verwendet den aktuellen localhost-Port
  return `${window.location.origin}/`
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string
) {
  const trimmedName = displayName.trim()
  if (!trimmedName || trimmedName.length > 80) {
    throw new Error("Der Anzeigename muss zwischen 1 und 80 Zeichen lang sein.")
  }

  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailRedirectUrl(),
      data: { display_name: trimmedName },
    },
  })

  if (error) {
    throw error
  }

  return { needsEmailConfirmation: data.session === null }
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await getSupabaseClient().auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: getEmailRedirectUrl(),
    },
  })

  if (error) {
    throw error
  }
}

export async function sendMagicLink(email: string) {
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getEmailRedirectUrl(),
      shouldCreateUser: false,
    },
  })

  if (error) {
    throw error
  }
}

export async function sendPasswordRecoveryEmail(email: string) {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin,
    }
  )

  if (error) {
    throw error
  }
}

export async function updatePassword(password: string) {
  const { error } = await getSupabaseClient().auth.updateUser({ password })

  if (error) {
    throw error
  }
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut()

  if (error) {
    throw error
  }
}
