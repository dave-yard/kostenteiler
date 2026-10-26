import { getSupabaseClient } from "@/lib/supabase"

function getEmailRedirectUrl() {
  const redirectUrl = new URL(window.location.origin)
  const invitationToken = new URLSearchParams(window.location.search).get(
    "invite"
  )
  if (invitationToken) {
    redirectUrl.searchParams.set("invite", invitationToken)
  }

  return redirectUrl.toString()
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

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailRedirectUrl(),
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
