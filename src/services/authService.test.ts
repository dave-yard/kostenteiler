import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSupabaseClient } from "@/lib/supabase"
import {
  sendMagicLink,
  sendPasswordRecoveryEmail,
  signUpWithPassword,
  updatePassword,
} from "./authService"

// Ersetzt den echten Supabase-Client, damit kein Test auf ein reales Projekt
// zugreift und keine echte E-Mail verschickt.
vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}))

// Simulierte Supabase-Auth-Funktionen. Anhand ihrer Aufzeichnungen wird geprüft,
// mit welchen Angaben der Service Supabase aufgerufen hätte.
const auth = {
  signInWithOtp: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}

// Setzt vor jedem Test einen bekannten Ausgangszustand und erfolgreiche
// Standardantworten.
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseClient).mockReturnValue({ auth } as never)
  window.history.replaceState({}, "", "/")
  auth.signInWithOtp.mockResolvedValue({ error: null })
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  auth.updateUser.mockResolvedValue({ error: null })
})

describe("authService", () => {
  it("registers the trimmed display name in auth metadata before email confirmation", async () => {
    await expect(
      signUpWithPassword("person@example.com", "password123", "  Alex  ")
    ).resolves.toEqual({ needsEmailConfirmation: true })

    expect(auth.signUp).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "password123",
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: "Alex" },
      },
    })
  })

  it.each(["", "   ", "a".repeat(81)])(
    "rejects an invalid registration display name",
    async (displayName) => {
      await expect(
        signUpWithPassword("person@example.com", "password123", displayName)
      ).rejects.toThrow(
        "Der Anzeigename muss zwischen 1 und 80 Zeichen lang sein."
      )
      expect(auth.signUp).not.toHaveBeenCalled()
    }
  )

  it("reports when signup returns an active session", async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { session: { access_token: "test-token" } },
      error: null,
    })

    await expect(
      signUpWithPassword("person@example.com", "password123", "Alex")
    ).resolves.toEqual({ needsEmailConfirmation: false })
  })

  it("surfaces registration errors", async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: new Error("Registration failed"),
    })

    await expect(
      signUpWithPassword("person@example.com", "password123", "Alex")
    ).rejects.toThrow("Registration failed")
  })

  // Magic-Links führen an die konfigurierte App-Adresse zurück.
  it("requests a magic link with the app redirect URL", async () => {
    await sendMagicLink("person@example.com")

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        shouldCreateUser: false,
      },
    })
  })

  // Beim Recovery-Link muss Supabase als Rücksprungziel die App-Adresse erhalten.
  it("requests password recovery for the app origin", async () => {
    await sendPasswordRecoveryEmail("person@example.com")

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "person@example.com",
      { redirectTo: window.location.origin }
    )
  })

  // Der Service muss das neue Passwort an Supabase zur Aktualisierung übergeben.
  it("updates the authenticated user's password", async () => {
    await updatePassword("new-password-123")

    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "new-password-123",
    })
  })

  // Fehler von Supabase dürfen nicht verschluckt werden: Die aufrufende Oberfläche
  // braucht sie, um dem Nutzer mitzuteilen, dass der Versand fehlgeschlagen ist.
  it("surfaces Supabase errors when a magic link cannot be sent", async () => {
    auth.signInWithOtp.mockResolvedValueOnce({
      error: new Error("Email provider unavailable"),
    })

    await expect(sendMagicLink("person@example.com")).rejects.toThrow(
      "Email provider unavailable"
    )
  })
})
