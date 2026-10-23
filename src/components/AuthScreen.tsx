import { useEffect, useState, type FormEvent } from "react"
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Mail,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/contexts/AuthContext"

type AuthMode = "login" | "signup" | "magic-link"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut."
}

function getAuthCallbackError() {
  const queryParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  const params = queryParams.has("error_description")
    ? queryParams
    : hashParams
  const errorDescription = params.get("error_description")

  if (!errorDescription) {
    return null
  }

  if (params.get("error_code") === "otp_expired") {
    return {
      message:
        "Der Bestätigungslink ist abgelaufen oder wurde bereits verwendet. Bitte fordere eine neue Bestätigungsmail an.",
      isExpiredConfirmation: true,
    }
  }

  return {
    message: `Die E-Mail-Bestätigung ist fehlgeschlagen: ${errorDescription}`,
    isExpiredConfirmation: false,
  }
}

export function AuthScreen() {
  const {
    configurationError,
    signInWithPassword,
    signUpWithPassword,
    resendSignupConfirmation,
    sendMagicLink,
  } = useAuth()
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => getAuthCallbackError()?.message ?? null
  )
  const [canResendConfirmation, setCanResendConfirmation] = useState(
    () => getAuthCallbackError()?.isExpiredConfirmation ?? false
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.slice(1))
    const hasQueryError = url.searchParams.has("error_description")
    const hasHashError = hashParams.has("error_description")
    if (!hasQueryError && !hasHashError) {
      return
    }

    const params = hasQueryError ? url.searchParams : hashParams
    params.delete("error")
    params.delete("error_code")
    params.delete("error_description")
    if (hasHashError) {
      url.hash = params.size > 0 ? params.toString() : ""
    }
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setCanResendConfirmation(false)
    setSuccessMessage(null)

    if (configurationError) {
      setErrorMessage(configurationError)
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === "login") {
        await signInWithPassword(email, password)
      } else if (mode === "signup") {
        const result = await signUpWithPassword(email, password)
        if (result.needsEmailConfirmation) {
          setSuccessMessage(
            "Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir gesendet haben."
          )
        }
      } else {
        await sendMagicLink(email)
        setSuccessMessage(
          "Wir haben dir einen Anmeldelink per E-Mail gesendet. Der Link ist nur einmal verwendbar."
        )
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setCanResendConfirmation(
        mode === "login" &&
          error instanceof Error &&
          /email not confirmed/i.test(error.message)
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendConfirmation() {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      await resendSignupConfirmation(email)
      setCanResendConfirmation(false)
      setSuccessMessage(
        "Wir haben eine neue Bestätigungsmail angefordert. Bitte prüfe dein Postfach und verwende den neuesten Link."
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPasswordMode = mode !== "magic-link"
  const submitLabel =
    mode === "login"
      ? "Anmelden"
      : mode === "signup"
        ? "Konto erstellen"
        : "Anmeldelink senden"

  return (
    <main className="relative flex min-h-svh items-start justify-center overflow-x-hidden bg-[#f5f6f2] px-4 py-6 text-[#20241f] sm:items-center sm:px-6 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 size-[28rem] rounded-full bg-[#dce9df] opacity-70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-48 size-[34rem] rounded-full bg-[#f0e6cf] opacity-70 blur-3xl"
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_32px_100px_-48px_rgba(32,36,31,0.35)] lg:grid-cols-[1.02fr_0.98fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#1f3b2d] p-10 text-white lg:flex xl:p-14">
          <div
            aria-hidden="true"
            className="absolute -right-28 -bottom-32 size-96 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -right-12 -bottom-16 size-64 rounded-full border border-white/10"
          />

          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d8eb9a] text-[#203a2c]">
              <ReceiptText aria-hidden="true" className="size-6" />
            </div>
            <p className="mt-5 text-sm font-semibold tracking-[0.18em] text-white/70 uppercase">
              Kostenteiler
            </p>
          </div>

          <div className="relative my-12">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75">
              <span className="size-1.5 rounded-full bg-[#d8eb9a]" />
              Gemeinsam den Überblick behalten
            </p>
            <h1 className="max-w-md text-4xl leading-[1.12] font-semibold tracking-[-0.045em] xl:text-5xl">
              Faire Abrechnungen. Weniger Kopfrechnen.
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-white/70">
              Gemeinsame Ausgaben festhalten, flexibel aufteilen und am Ende
              einfach ausgleichen.
            </p>
          </div>

          <div className="relative grid gap-3 text-sm text-white/85">
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/10">
                <UsersRound aria-hidden="true" className="size-4" />
              </span>
              Gruppen und gemeinsame Listen
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/10">
                <Check aria-hidden="true" className="size-4" />
              </span>
              Aufteilungen, die für euch passen
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-14">
          <div className="w-full max-w-sm">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#1f3b2d] text-white">
                <ReceiptText aria-hidden="true" className="size-5" />
              </div>
              <span className="font-semibold tracking-tight">Kostenteiler</span>
            </div>

            <div className="mb-8">
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </div>
              <p className="text-sm font-medium text-[#65806a]">
                Schön, dass du da bist
              </p>
              <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
                {mode === "signup"
                  ? "Konto erstellen"
                  : mode === "magic-link"
                    ? "Ohne Passwort anmelden"
                    : "Willkommen zurück"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#72766f]">
                {mode === "signup"
                  ? "Erstelle ein Konto, um mit deiner Gruppe loszulegen."
                  : "Melde dich an und behalte eure gemeinsamen Ausgaben im Blick."}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#f4f5f2] p-1">
              <Button
                type="button"
                onClick={() => {
                  setMode("login")
                  setErrorMessage(null)
                  setCanResendConfirmation(false)
                  setSuccessMessage(null)
                }}
                variant="ghost"
                className={`h-auto rounded-lg px-3 py-2 text-sm font-medium transition ${mode !== "signup" ? "bg-white text-[#20241f] shadow-sm" : "text-[#777b74] hover:text-[#20241f]"}`}
              >
                Anmelden
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setMode("signup")
                  setErrorMessage(null)
                  setCanResendConfirmation(false)
                  setSuccessMessage(null)
                }}
                variant="ghost"
                className={`h-auto rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "signup" ? "bg-white text-[#20241f] shadow-sm" : "text-[#777b74] hover:text-[#20241f]"}`}
              >
                Registrieren
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="auth-email"
                >
                  E-Mail-Adresse
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#8a8f87]"
                  />
                  <Input
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-[#e4e7e1] bg-white pr-4 pl-10 text-sm outline-none transition placeholder:text-[#a0a49d] focus:border-[#65806a] focus:ring-4 focus:ring-[#65806a]/10"
                    id="auth-email"
                    name="email"
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setCanResendConfirmation(false)
                    }}
                    placeholder="name@beispiel.de"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </div>

              {isPasswordMode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm font-medium"
                      htmlFor="auth-password"
                    >
                      Passwort
                    </label>
                    {mode === "login" && (
                      <Button
                        className="h-auto p-0 text-xs font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e]"
                        onClick={() => {
                          setMode("magic-link")
                          setErrorMessage(null)
                          setCanResendConfirmation(false)
                          setSuccessMessage(null)
                        }}
                        type="button"
                        variant="ghost"
                      >
                        Mit Anmeldelink anmelden
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      className="h-12 w-full rounded-xl border border-[#e4e7e1] bg-white pr-12 pl-4 text-sm outline-none transition placeholder:text-[#a0a49d] focus:border-[#65806a] focus:ring-4 focus:ring-[#65806a]/10"
                      id="auth-password"
                      minLength={8}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Mindestens 8 Zeichen"
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                    />
                    <Button
                      aria-label={
                        showPassword ? "Passwort verbergen" : "Passwort anzeigen"
                      }
                      className="absolute top-1/2 right-3 size-8 -translate-y-1/2 rounded-lg p-0 text-[#8a8f87] hover:bg-[#f4f5f2] hover:text-[#32372f]"
                      onClick={() => setShowPassword((visible) => !visible)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" className="size-4" />
                      ) : (
                        <Eye aria-hidden="true" className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {configurationError && (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
                  role="alert"
                >
                  <p className="font-semibold">Supabase ist noch nicht verbunden</p>
                  <p>{configurationError}</p>
                </div>
              )}

              {errorMessage && (
                <div className="space-y-2">
                  <p
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                  {canResendConfirmation && (
                    <Button
                      className="h-auto p-0 text-sm font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e] disabled:opacity-50"
                      disabled={isSubmitting || !email}
                      onClick={handleResendConfirmation}
                      type="button"
                      variant="ghost"
                    >
                      Neue Bestätigungsmail anfordern
                    </Button>
                  )}
                </div>
              )}

              {successMessage && (
                <p
                  className="rounded-xl border border-[#d9e8d6] bg-[#f0f7ed] px-4 py-3 text-sm leading-6 text-[#355b3b]"
                  role="status"
                >
                  {successMessage}
                </p>
              )}

              <Button
                className="h-12 w-full rounded-xl bg-[#1f3b2d] text-sm text-white hover:bg-[#294b38]"
                disabled={isSubmitting || Boolean(configurationError)}
                type="submit"
              >
                {isSubmitting ? "Einen Moment ..." : submitLabel}
                {!isSubmitting && (
                  <ArrowRight aria-hidden="true" className="ml-1 size-4" />
                )}
              </Button>
            </form>

            {mode === "magic-link" ? (
              <Button
                className="mt-5 h-auto w-full p-0 text-center text-sm font-medium text-[#54705a] hover:bg-transparent hover:text-[#263f2e]"
                onClick={() => {
                  setMode("login")
                  setErrorMessage(null)
                  setCanResendConfirmation(false)
                  setSuccessMessage(null)
                }}
                type="button"
                variant="ghost"
              >
                Zurück zur Passwort-Anmeldung
              </Button>
            ) : (
              <p className="mt-6 text-center text-xs leading-5 text-[#878b84]">
                Deine Anmeldung wird sicher über Supabase Auth verarbeitet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
