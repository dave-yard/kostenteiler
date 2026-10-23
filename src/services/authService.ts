import { getSupabaseClient } from "@/lib/supabase"

export async function signInWithPassword(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
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
      emailRedirectTo: window.location.origin,
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
      emailRedirectTo: window.location.origin,
    },
  })

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
