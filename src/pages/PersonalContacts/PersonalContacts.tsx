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

  async function handleRenameContact(contact: PersonalContact) {
    const trimmedName = editingName.trim()
    if (!trimmedName) {
      return
    }
    if (trimmedName === contact.displayName) {
      setEditingContactId(null)
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSaving(true)
    try {
      await renamePersonalContact(contact.id, trimmedName)
      setEditingContactId(null)
      if (!(await loadContacts())) {
        return
      }
      setSuccessMessage("Der Anzeigename wurde geändert.")
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
        className="mb-6 flex flex-col gap-3 border-b border-[#eef0eb] pb-6 sm:flex-row"
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
              {editingContactId === contact.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleRenameContact(contact)
                  }}
                >
                  <Input
                    aria-label="Anzeigename"
                    autoFocus
                    className="h-9 min-w-0 flex-1 rounded-lg px-3"
                    maxLength={80}
                    onChange={(event) => setEditingName(event.target.value)}
                    value={editingName}
                  />
                  <Button
                    aria-label="Anzeigenamen speichern"
                    className="size-9 shrink-0 rounded-lg"
                    disabled={isSaving || !editingName.trim()}
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
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {contact.displayName}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-[#72766f]">
                      <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                      {contact.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label={`${contact.displayName} umbenennen`}
                      className="size-9 rounded-lg"
                      disabled={isSaving}
                      onClick={() => {
                        setEditingContactId(contact.id)
                        setEditingName(contact.displayName)
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
          <p className="mt-5 text-sm text-[#72766f]">
            Du hast noch keine Kontakte gespeichert.
          </p>
        )
      )}
    </section>
  )
}
