import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSupabaseClient } from "@/lib/supabase"
import {
  sendMagicLink,
  sendPasswordRecoveryEmail,
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
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  auth.updateUser.mockResolvedValue({ error: null })
})

describe("authService", () => {
  // Magic-Links führen an die konfigurierte App-Adresse zurück.
  it("requests a magic link with the app redirect URL", async () => {
    await sendMagicLink("person@example.com")

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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
