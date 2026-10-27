import { useCallback, useEffect, useState, type FormEvent } from "react"
import { ContactRound, Mail, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { PersonalContact } from "@/types/group"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export function PersonalContacts() {
  const { getMyContacts, createPersonalContact, removePersonalContact } =
    useGroupOverview()
  const [contacts, setContacts] = useState<PersonalContact[]>([])
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [hasLoadError, setHasLoadError] = useState(false)

  const loadContacts = useCallback(async () => {
    setErrorMessage(null)
    try {
      setContacts(await getMyContacts())
      setHasLoadError(false)
      return true
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setHasLoadError(true)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [getMyContacts])

  useEffect(() => {
    let isCurrent = true

    getMyContacts()
      .then((loadedContacts) => {
        if (isCurrent) {
          setContacts(loadedContacts)
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(getErrorMessage(error))
          setHasLoadError(true)
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [getMyContacts])

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = contactName.trim()
    const trimmedEmail = contactEmail.trim().toLowerCase()
    if (!trimmedName || !trimmedEmail) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await createPersonalContact(trimmedName, trimmedEmail)
      setContactName("")
      setContactEmail("")
      if (!(await loadContacts())) {
        return
      }
      setSuccessMessage(
        `${trimmedName} wurde deiner Freundesliste hinzugefügt.`
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveContact(contact: PersonalContact) {
    const confirmed = window.confirm(
      `${contact.displayName} aus deiner persönlichen Freundesliste entfernen? Bereits angelegte Gruppenmitglieder bleiben erhalten.`
    )
    if (!confirmed) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await removePersonalContact(contact.id)
      if (!(await loadContacts())) {
        return
      }
      setSuccessMessage(
        `${contact.displayName} wurde aus deiner Freundesliste entfernt.`
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-[#e8ebe5] bg-white p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#edf3e9] text-[#31563e]">
          <ContactRound aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h1 className="font-semibold">Freundesliste</h1>
          <p className="text-sm text-[#72766f]">
            Deine Kontakte sind privat und nur für dich sichtbar.
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={handleCreateContact}
      >
        <label className="sr-only" htmlFor="contact-name">
          Name
        </label>
        <Input
          autoComplete="name"
          className="h-11 min-w-0 rounded-xl px-3.5"
          id="contact-name"
          maxLength={80}
          onChange={(event) => setContactName(event.target.value)}
          placeholder="Name"
          required
          value={contactName}
        />
        <label className="sr-only" htmlFor="contact-email">
          E-Mail-Adresse
        </label>
        <Input
          autoComplete="email"
          className="h-11 min-w-0 rounded-xl px-3.5"
          id="contact-email"
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="E-Mail-Adresse"
          required
          type="email"
          value={contactEmail}
        />
        <Button
          className="h-11 rounded-xl bg-[#1f3b2d] px-4 text-white hover:bg-[#294b38]"
          disabled={isSaving || !contactName.trim() || !contactEmail.trim()}
          type="submit"
        >
          <Plus aria-hidden="true" className="size-4" />
          {isSaving ? "Wird gespeichert ..." : "Kontakt speichern"}
        </Button>
      </form>

      <Toast
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
        variant="error"
      />
      <Toast message={successMessage} onClose={() => setSuccessMessage(null)} />

      {isLoading ? (
        <p className="mt-5 text-sm text-[#72766f]" role="status">
          Freundesliste wird geladen ...
        </p>
      ) : contacts.length > 0 ? (
        <ul className="mt-4 divide-y divide-[#eef0eb]">
          {contacts.map((contact) => (
            <li
              className="flex items-center justify-between gap-3 py-3"
              key={contact.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {contact.displayName}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-[#72766f]">
                  <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                  {contact.email}
                </p>
              </div>
              <Button
                aria-label={`${contact.displayName} aus Freundesliste entfernen`}
                className="size-9 shrink-0 rounded-lg"
                disabled={isSaving}
                onClick={() => void handleRemoveContact(contact)}
                size="icon"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !hasLoadError && (
          <p className="mt-5 text-sm text-[#72766f]">
            Du hast noch keine Kontakte gespeichert.
          </p>
        )
      )}
    </section>
  )
}
