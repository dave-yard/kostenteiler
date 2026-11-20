import { useState } from "react"
import { Copy, Plus } from "lucide-react"
import { useGroupOverview } from "@/components/contexts/GroupOverviewContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete"
import type { GroupMember, PersonalContact } from "@/types/group"

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Die Aktion ist fehlgeschlagen. Bitte versuche es erneut."
}

export interface AddGroupMemberSectionProps {
  groupId: string
  members: GroupMember[]
  contacts: PersonalContact[]
  isLoadingContacts: boolean
  onContactsUpdate: (contacts: PersonalContact[]) => void
  onMemberAdded: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export function AddGroupMemberSection({
  groupId,
  members,
  contacts,
  isLoadingContacts,
  onContactsUpdate,
  onMemberAdded,
  onSuccess,
  onError,
}: AddGroupMemberSectionProps) {
  const {
    getMyContacts,
    createPersonalContact,
    addGroupMember,
    refreshGroups,
  } = useGroupOverview()

  const [memberName, setMemberName] = useState<string | null>("")
  const [memberEmail, setMemberEmail] = useState<string | null>("")
  const [selectedContactId, setSelectedContactId] = useState("")
  const [isAddingMember, setIsAddingMember] = useState(false)

  const availableContacts = contacts.filter(
    (contact) =>
      !members.some(
        (member) => member.email?.toLowerCase() === contact.email?.toLowerCase()
      )
  )
  const contactQuery = memberName?.trim() || memberEmail?.trim()
  const contactSuggestions = contactQuery
    ? availableContacts
        .filter((contact) => {
          const query = contactQuery.toLocaleLowerCase()
          return (
            contact.displayName?.toLocaleLowerCase().includes(query) ||
            contact.email?.toLocaleLowerCase().includes(query)
          )
        })
        .slice(0, 5)
    : []

  async function handleAddMember() {
    const trimmedEmail = memberEmail?.trim().toLowerCase() || null
    const enteredName = memberName?.trim() || null

    const emailName = trimmedEmail ? trimmedEmail.split("@")[0] : null
    const displayName = enteredName || emailName

    if (!displayName) {
      onError("Gib bitte einen Namen oder eine E-Mail-Adresse ein.")
      return
    }

    setIsAddingMember(true)

    try {
      let contact = contacts.find((entry) => {
        if (trimmedEmail && entry.email?.toLowerCase() === trimmedEmail) {
          return true
        }
        if (
          enteredName &&
          entry.displayName?.toLowerCase() === enteredName.toLowerCase()
        ) {
          return true
        }
        return false
      })

      if (!contact) {
        await createPersonalContact(displayName, trimmedEmail)
        const updatedContacts = await getMyContacts()
        onContactsUpdate(updatedContacts)

        contact =
          updatedContacts.find(
            (entry) =>
              (trimmedEmail && entry.email?.toLowerCase() === trimmedEmail) ||
              entry.displayName?.toLowerCase() === displayName.toLowerCase()
          ) ?? updatedContacts[updatedContacts.length - 1]

        if (!contact) {
          throw new Error(
            "Der Kontakt konnte nach der Erstellung nicht abgerufen werden."
          )
        }
      }

      await addGroupMember(groupId, contact.id)

      setMemberName("")
      setMemberEmail("")
      setSelectedContactId("")
      onMemberAdded()
      await refreshGroups()
      onSuccess(`${contact.displayName} wurde zur Gruppe hinzugefügt.`)
    } catch (error) {
      onError(getErrorMessage(error))
    } finally {
      setIsAddingMember(false)
    }
  }

  async function handleCopyAppAddress() {
    try {
      await navigator.clipboard.writeText(
        "https://dave-yard.github.io/kostenteiler/"
      )
      onSuccess("Die App-Adresse wurde in die Zwischenablage kopiert.")
    } catch (error) {
      onError(
        `Die App-Adresse konnte nicht automatisch kopiert werden. ${getErrorMessage(error)}`
      )
    }
  }

  return (
    <section className="mt-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-accent text-brand-accent-text">
          <Plus aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">Person hinzufügen</h2>
          <p className="text-sm text-muted-foreground">
            Wähle einen Kontakt aus oder gib Name und E-Mail-Adresse ein. Neue
            Kontakte werden in deiner Freundesliste gespeichert.
            Unregistrierte Personen bleiben ausstehend und werden nach einer
            Registrierung mit bestätigter E-Mail automatisch verknüpft.
          </p>
        </div>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void handleAddMember()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative min-w-0">
            <label className="sr-only" htmlFor="new-member-name">
              Name oder Freundesliste durchsuchen
            </label>
            <Autocomplete
              inline
              open={
                !selectedContactId &&
                !isLoadingContacts &&
                contactSuggestions.length > 0
              }
              items={contactSuggestions}
              mode="none"
              itemToStringValue={(contact: PersonalContact) =>
                contact.displayName ?? ""
              }
              onValueChange={(value) => {
                setMemberName(value)
                setSelectedContactId("")
              }}
              value={memberName ?? ""}
            >
              <AutocompleteInput
                autoComplete="off"
                className="h-11 min-w-0 rounded-xl border border-border px-3.5 text-sm transition outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
                id="new-member-name"
                maxLength={80}
                placeholder="Name (optional)"
                render={<Input />}
              />
              {isLoadingContacts &&
                (memberName?.trim() || memberEmail?.trim()) && (
                  <p
                    className="mt-2 text-xs text-muted-foreground"
                    role="status"
                  >
                    Freundesliste wird durchsucht ...
                  </p>
                )}
              {!selectedContactId &&
                !isLoadingContacts &&
                contactSuggestions.length > 0 && (
                  <AutocompleteList aria-label="Vorschläge aus deiner Freundesliste">
                    {contactSuggestions.map((contact) => (
                      <AutocompleteItem
                        key={contact.id}
                        value={contact}
                        onClick={() => {
                          setMemberName(contact.displayName)
                          setMemberEmail(contact.email)
                          setSelectedContactId(contact.id)
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {contact.displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {contact.email}
                          </span>
                        </span>
                      </AutocompleteItem>
                    ))}
                  </AutocompleteList>
                )}
            </Autocomplete>
          </div>
          <div className="flex min-w-0 gap-2">
            <label className="sr-only" htmlFor="new-member-email">
              E-Mail-Adresse
            </label>
            <Input
              autoComplete="email"
              className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3.5 text-sm transition outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/10"
              id="new-member-email"
              onChange={(event) => {
                setMemberEmail(event.target.value)
                setSelectedContactId("")
              }}
              placeholder="E-Mail-Adresse"
              type="email"
              value={memberEmail ?? ""}
            />
            {memberEmail?.trim() && (
              <Button
                aria-label="App-Adresse kopieren"
                className="h-11 shrink-0 rounded-xl"
                onClick={() => void handleCopyAppAddress()}
                title="App-Adresse kopieren"
                type="button"
                variant="outline"
              >
                <Copy aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">App-Link kopieren</span>
              </Button>
            )}
          </div>
        </div>
        <Button
          className="h-11 rounded-xl bg-brand-primary px-5 text-white hover:bg-brand-primary-hover"
          disabled={
            isAddingMember || (!memberEmail?.trim() && !memberName?.trim())
          }
          type="submit"
        >
          {isAddingMember ? "Wird hinzugefügt ..." : "Person hinzufügen"}
        </Button>
      </form>
    </section>
  )
}
