import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  Check,
  ContactRound,
  Mail,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toast } from "@/components/ui/toast"
import { useAuth } from "@/components/contexts/AuthContext"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import type { PersonalContact } from "@/types/group"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export function PersonalContacts() {
  const {
    getMyContacts,
    createPersonalContact,
    removePersonalContact,
    renamePersonalContact,
    setMyDisplayName,
  } = useGroupOverview()
  const { session } = useAuth()
  const metadataName: unknown = session?.user.user_metadata?.display_name
  const [ownName, setOwnName] = useState(
    typeof metadataName === "string" ? metadataName : ""
  )
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingEmail, setEditingEmail] = useState("")
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
    let trimmedName = contactName.trim()
    const trimmedEmail = contactEmail.trim().toLowerCase()

    // Wenn kein Name, aber eine E-Mail eingegeben wurde -> Name aus E-Mail vor dem '@' bilden
    if (!trimmedName && trimmedEmail) {
      const emailNamePart = trimmedEmail.split("@")[0]
      if (emailNamePart) {
        trimmedName =
          emailNamePart.charAt(0).toUpperCase() + emailNamePart.slice(1)
      }
    }

    if (!trimmedName) {
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

  async function handleSaveOwnName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = ownName.trim()
    if (!trimmedName) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await setMyDisplayName(trimmedName)
      setOwnName(trimmedName)
      setSuccessMessage("Dein Anzeigename wurde gespeichert.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateContact(contact: PersonalContact) {
    let trimmedName = editingName.trim()
    const trimmedEmail = editingEmail.trim().toLowerCase()

    // Wenn kein Name eingegeben wurde, aber eine E-Mail da ist -> Name aus E-Mail bilden
    if (!trimmedName && trimmedEmail) {
      const emailNamePart = trimmedEmail.split("@")[0]
      if (emailNamePart) {
        trimmedName =
          emailNamePart.charAt(0).toUpperCase() + emailNamePart.slice(1)
      }
    }

    // Fallback auf den bestehenden Namen, falls immer noch leer
    if (!trimmedName) {
      trimmedName = contact.displayName
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await renamePersonalContact(contact.id, trimmedName, trimmedEmail)
      setEditingContactId(null)
      if (!(await loadContacts())) {
        return
      }
      setSuccessMessage("Der Kontakt wurde aktualisiert.")
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
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-border bg-card p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-surface text-brand-text">
          <ContactRound aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h1 className="font-semibold">Freundesliste</h1>
          <p className="text-sm text-muted-foreground">
            Deine Kontakte sind privat und nur für dich sichtbar.
          </p>
        </div>
      </div>

      <form
        className="mb-6 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row"
        onSubmit={handleSaveOwnName}
      >
        <label className="sr-only" htmlFor="own-display-name">
          Mein Anzeigename
        </label>
        <Input
          className="h-11 min-w-0 flex-1 rounded-xl px-3.5"
          id="own-display-name"
          maxLength={80}
          onChange={(event) => setOwnName(event.target.value)}
          placeholder="Mein Anzeigename"
          value={ownName}
        />
        <Button
          className="h-11 rounded-xl"
          disabled={isSaving || !ownName.trim()}
          type="submit"
          variant="outline"
        >
          Anzeigenamen speichern
        </Button>
      </form>

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
          placeholder="Name (optional bei E-Mail)"
          value={contactName}
        />
        <label className="sr-only" htmlFor="contact-email">
          E-Mail-Adresse (optional)
        </label>
        <Input
          autoComplete="email"
          className="h-11 min-w-0 rounded-xl px-3.5"
          id="contact-email"
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="E-Mail-Adresse (optional)"
          type="email"
          value={contactEmail}
        />
        <Button
          className="h-11 rounded-xl bg-brand-primary px-4 text-white hover:bg-brand-primary-hover"
          disabled={isSaving || (!contactName.trim() && !contactEmail.trim())}
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
        <p className="mt-5 text-sm text-muted-foreground" role="status">
          Freundesliste wird geladen ...
        </p>
      ) : contacts.length > 0 ? (
        <ul className="mt-4 divide-y divide-border">
          {contacts.map((contact) => (
            <li
              className="flex items-center justify-between gap-3 py-3"
              key={contact.id}
            >
              {editingContactId === contact.id ? (
                <form
                  className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleUpdateContact(contact)
                  }}
                >
                  <Input
                    aria-label="Anzeigename"
                    autoFocus
                    className="h-9 min-w-0 flex-1 rounded-lg px-3 text-sm"
                    maxLength={80}
                    placeholder="Name"
                    onChange={(event) => setEditingName(event.target.value)}
                    value={editingName}
                  />
                  <Input
                    aria-label="E-Mail-Adresse"
                    className="h-9 min-w-0 flex-1 rounded-lg px-3 text-sm"
                    placeholder="E-Mail-Adresse"
                    type="email"
                    onValueChange={setEditingEmail}
                    value={editingEmail}
                  />
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label="Kontakt speichern"
                      className="size-9 shrink-0 rounded-lg"
                      disabled={
                        isSaving ||
                        (!editingName.trim() && !editingEmail.trim())
                      }
                      size="icon"
                      type="submit"
                      variant="ghost"
                    >
                      <Check aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      aria-label="Abbrechen"
                      className="size-9 shrink-0 rounded-lg"
                      onClick={() => setEditingContactId(null)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {contact.displayName}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                      {contact.email
                        ? contact.email
                        : "Keine E-Mail hinterlegt"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label={`${contact.displayName} bearbeiten`}
                      className="size-9 rounded-lg"
                      disabled={isSaving}
                      onClick={() => {
                        setEditingContactId(contact.id)
                        setEditingName(contact.displayName)
                        setEditingEmail(contact.email ?? "")
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      aria-label={`${contact.displayName} aus Freundesliste entfernen`}
                      className="size-9 rounded-lg"
                      disabled={isSaving}
                      onClick={() => void handleRemoveContact(contact)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !hasLoadError && (
          <p className="mt-5 text-sm text-muted-foreground">
            Du hast noch keine Kontakte gespeichert.
          </p>
        )
      )}
    </section>
  )
}
