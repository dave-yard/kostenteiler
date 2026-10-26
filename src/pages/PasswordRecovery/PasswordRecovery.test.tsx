import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Session } from "@supabase/supabase-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAuth } from "@/components/contexts/AuthContext"
import { PasswordRecovery } from "./PasswordRecovery"

// Der Auth-Kontext wird ersetzt, damit die Seite ohne echtes Supabase-Konto
// und ohne Netzwerkzugriff getestet werden kann.
vi.mock("@/components/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}))

// Zeichnet auf, ob die Seite tatsächlich versucht hat, das Passwort zu ändern.
const updatePassword = vi.fn()

// Entfernt nach jedem Test die gerenderte Seite und löscht aufgezeichnete Aufrufe.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Stellt die Recovery-Seite so dar, als sei ein gültiger Recovery-Link geöffnet
// worden und der Nutzer bereits durch diesen Link angemeldet.
function renderPasswordRecovery() {
  vi.mocked(useAuth).mockReturnValue({
    session: { user: { id: "user-id" } } as Session,
    isLoading: false,
    isPasswordRecovery: true,
    configurationError: null,
    signInWithPassword: vi.fn(),
    signUpWithPassword: vi.fn(),
    resendSignupConfirmation: vi.fn(),
    sendMagicLink: vi.fn(),
    sendPasswordRecoveryEmail: vi.fn(),
    updatePassword,
    signOut: vi.fn(),
  })

  return render(<PasswordRecovery />)
}

describe("PasswordRecovery", () => {
  // Unterschiedliche Einträge dürfen nicht an die Passwortänderung weitergegeben werden.
  it("rejects mismatched passwords without updating the account", async () => {
    const user = userEvent.setup()
    renderPasswordRecovery()

    await user.type(screen.getByLabelText("Neues Passwort"), "new-password-123")
    await user.type(
      screen.getByLabelText("Passwort wiederholen"),
      "different-password"
    )
    await user.click(screen.getByRole("button", { name: "Passwort speichern" }))

    // Die Seite erklärt, warum sie das Formular nicht akzeptiert.
    expect(
      await screen.findByText("Die Passwörter stimmen nicht überein.")
    ).toBeTruthy()
    // Vor allem darf der gespeicherte Account dabei unverändert bleiben.
    expect(updatePassword).not.toHaveBeenCalled()
  })

  // Gleiche Passwörter dürfen gespeichert werden; danach zeigt die Seite Erfolg an.
  it("updates the password after both entries match", async () => {
    const user = userEvent.setup()
    renderPasswordRecovery()

    await user.type(screen.getByLabelText("Neues Passwort"), "new-password-123")
    await user.type(
      screen.getByLabelText("Passwort wiederholen"),
      "new-password-123"
    )
    await user.click(screen.getByRole("button", { name: "Passwort speichern" }))

    // Das neue Passwort wird an die Authentifizierungsfunktion übergeben.
    expect(updatePassword).toHaveBeenCalledWith("new-password-123")
    // Die Erfolgsmeldung bestätigt, dass die Seite den Speichervorgang akzeptiert hat.
    expect(
      await screen.findByRole("heading", { name: "Passwort geändert" })
    ).toBeTruthy()
  })
})
