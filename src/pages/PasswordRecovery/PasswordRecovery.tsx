import { useState, type FormEvent } from "react"
import { ArrowRight, Check, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/contexts/AuthContext"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut."
}

function leaveRecoveryPage() {
  window.location.replace(
    `${window.location.pathname}${window.location.search}`
  )
}

export function PasswordRecovery() {
  const { session, isLoading, updatePassword } = useAuth()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (password !== confirmPassword) {
      setErrorMessage("Die Passwörter stimmen nicht überein.")
      return
    }

    setIsSubmitting(true)
    try {
      await updatePassword(password)
      setIsComplete(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f5f6f2] px-4 py-8 text-[#20241f]">
      <section className="w-full max-w-md rounded-3xl border border-[#e8ebe5] bg-white p-6 shadow-[0_24px_72px_-40px_rgba(32,36,31,0.35)] sm:p-9">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#31563e]">
          {isComplete ? (
            <Check aria-hidden="true" className="size-6" />
          ) : (
            <ShieldCheck aria-hidden="true" className="size-6" />
          )}
        </div>
        <p className="mt-5 text-sm font-medium text-[#65806a]">Kostenteiler</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
          {isComplete ? "Passwort geändert" : "Neues Passwort festlegen"}
        </h1>

        {isLoading ? (
          <p className="mt-3 text-sm text-[#72766f]" role="status">
            Recovery-Link wird geprüft ...
          </p>
        ) : isComplete ? (
          <>
            <p className="mt-3 text-sm leading-6 text-[#72766f]" role="status">
              Dein Passwort wurde aktualisiert. Du kannst jetzt mit deinem neuen
              Passwort weitermachen.
            </p>
            <Button
              className="mt-6 h-12 w-full rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
              onClick={leaveRecoveryPage}
              type="button"
            >
              Weiter zur App
              <ArrowRight aria-hidden="true" className="ml-1 size-4" />
            </Button>
          </>
        ) : !session ? (
          <>
            <p className="mt-3 text-sm leading-6 text-[#72766f]">
              Dieser Recovery-Link ist ungültig oder abgelaufen. Bitte fordere
              eine neue E-Mail zum Zurücksetzen deines Passworts an.
            </p>
            <Button
              className="mt-6 h-12 w-full rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
              onClick={leaveRecoveryPage}
              type="button"
            >
              Zur Anmeldung
              <ArrowRight aria-hidden="true" className="ml-1 size-4" />
            </Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-[#72766f]">
              Wähle ein neues Passwort mit mindestens 8 Zeichen.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="new-password">
                  Neues Passwort
                </label>
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className="h-12 rounded-xl border-[#e4e7e1] bg-white pr-12 pl-4 text-sm"
                    id="new-password"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <Button
                    aria-label={
                      showPassword ? "Passwort verbergen" : "Passwort anzeigen"
                    }
                    className="absolute top-1/2 right-2 -translate-y-1/2"
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
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="confirm-password"
                >
                  Passwort wiederholen
                </label>
                <Input
                  autoComplete="new-password"
                  className="h-12 rounded-xl border-[#e4e7e1] bg-white px-4 text-sm"
                  id="confirm-password"
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                />
              </div>

              {errorMessage && (
                <p
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <Button
                className="h-12 w-full rounded-xl bg-[#1f3b2d] text-white hover:bg-[#294b38]"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Wird gespeichert ..." : "Passwort speichern"}
                {!isSubmitting && (
                  <ArrowRight aria-hidden="true" className="ml-1 size-4" />
                )}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
