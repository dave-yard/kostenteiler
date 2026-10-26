import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthScreen } from "@/components/AuthScreen"
import { useAuth } from "@/components/contexts/AuthContext"

// Verhindert echte Authentifizierungsaufrufe. Die Tests können so die
// Anmeldeseite bedienen, ohne Supabase zu kontaktieren oder E-Mails zu senden.
vi.mock("@/components/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}))

// Diese Funktionen stehen der Anmeldeseite normalerweise über den Auth-Kontext
// zur Verfügung. Als Test-Doubles merken sie sich, ob und womit sie aufgerufen wurden.
const authActions = {
  session: null,
  isLoading: false,
  isPasswordRecovery: false,
  configurationError: null,
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  sendMagicLink: vi.fn(),
  sendPasswordRecoveryEmail: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
}

// Jeder Test bekommt eine aufgeräumte Seite und frische Funktions-Aufzeichnungen,
// damit ein vorheriger Test das Ergebnis nicht beeinflusst.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Zeigt die echte Anmeldeseite an, versorgt sie aber mit den simulierten
// Authentifizierungsfunktionen von oben.
function renderAuthScreen() {
  vi.mocked(useAuth).mockReturnValue(authActions)
  return render(<AuthScreen />)
}

describe("AuthScreen", () => {
  // Prüft den Weg, den eine Person nimmt, um einen Magic-Link per E-Mail anzufordern.
  it("sends a magic link from the passwordless login form", async () => {
    const user = userEvent.setup()
    renderAuthScreen()

    // Zur passwortlosen Anmeldung wechseln, die E-Mail eintragen und den Link anfordern.
    await user.click(
      screen.getByRole("button", { name: "Mit Anmeldelink anmelden" })
    )
    await user.type(
      screen.getByRole("textbox", { name: "E-Mail-Adresse" }),
      "person@example.com"
    )
    await user.click(screen.getByRole("button", { name: "Anmeldelink senden" }))

    // Die Seite muss den eingegebenen Empfänger an die Authentifizierung weitergeben.
    expect(authActions.sendMagicLink).toHaveBeenCalledWith("person@example.com")
    // Und sie muss nach erfolgreicher Anfrage eine verständliche Bestätigung anzeigen.
    expect(
      await screen.findByText(/Anmeldelink per E-Mail gesendet/)
    ).toBeTruthy()
  })

  // Prüft, dass der Einstieg „Passwort vergessen?“ eine Recovery-Mail anfordert.
  it("sends a password recovery email from the login form", async () => {
    const user = userEvent.setup()
    renderAuthScreen()

    await user.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )
    await user.type(
      screen.getByRole("textbox", { name: "E-Mail-Adresse" }),
      "person@example.com"
    )
    await user.click(
      screen.getByRole("button", { name: "Recovery-E-Mail senden" })
    )

    // Die angegebene E-Mail-Adresse muss an die Recovery-Funktion weitergereicht werden.
    expect(authActions.sendPasswordRecoveryEmail).toHaveBeenCalledWith(
      "person@example.com"
    )
    // Die Rückmeldung verspricht keinen Versand an ein Konto, das es nicht gibt.
    expect(
      await screen.findByText(/Link zum Zurücksetzen deines Passworts/)
    ).toBeTruthy()
  })
})
