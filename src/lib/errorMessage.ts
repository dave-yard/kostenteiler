const databaseMessages: Record<string, string> = {
  "You are not allowed to perform this action on items.":
    "Dazu hast du bei Positionen keine Berechtigung.",
  "Archived groups are read-only.":
    "Archivierte Gruppen sind nur lesbar und können nicht geändert werden.",
  "Items can only be changed on open expense lists.":
    "Positionen können nur bei offenen Ausgabenlisten geändert werden.",
  "Item name must contain between 1 and 120 characters.":
    "Die Bezeichnung muss zwischen 1 und 120 Zeichen lang sein.",
  "The amount must be greater than zero.": "Der Betrag muss größer als 0 sein.",
  "The payer must be a member of this group.":
    "Die zahlende Person muss Mitglied dieser Gruppe sein.",
  "The payer must be a non-removed member of this group.":
    "Die zahlende Person muss ein nicht entferntes Mitglied dieser Gruppe sein.",
  "Cannot replace a payer without remaining group members.":
    "Der Zahler kann nicht entfernt werden, weil keine anderen Gruppenmitglieder verbleiben.",
  "Cannot convert a negative item or an overfilled receipt.":
    "Das Mitglied kann nicht entfernt werden: Eine betroffene Position ist negativ oder ein Bon enthält zu hohe Unterpositionen.",
  "The existing item allocation is invalid.":
    "Das Mitglied kann nicht entfernt werden, weil eine bestehende Aufteilung ungültig ist.",
  "The converted item allocation is invalid.":
    "Das Mitglied kann nicht entfernt werden, weil die Aufteilung nicht vollständig übertragen werden konnte.",
  "The selected person must be a member of this group.":
    "Die ausgewählte Person muss Mitglied dieser Gruppe sein.",
  "You are not a member of this group.": "Du bist kein Mitglied dieser Gruppe.",
  "You are not allowed to edit item splits.":
    "Du darfst die Verteilung dieser Position nicht bearbeiten.",
  "Only group admins can change the group split default.":
    "Nur Gruppen-Admins dürfen den Verteilungsstandard der Gruppe ändern.",
  "The split rule is invalid.": "Die Verteilungseinstellungen sind ungültig.",
  "The split mode is invalid.":
    "Bitte einen gültigen Verteilungsmodus auswählen.",
  "The split shares are invalid.":
    "Die eingetragenen Verteilungswerte sind ungültig.",
  "The split contains an unknown or duplicate group member.":
    "Die Verteilung enthält ein unbekanntes oder doppeltes Gruppenmitglied.",
  "Percentage shares must total exactly 100 percent.":
    "Die Prozentanteile müssen zusammen genau 100 % ergeben.",
  "Fixed split amounts cannot exceed the item amount.":
    "Die festen Beträge dürfen den Positionsbetrag nicht überschreiten.",
  "The expense list does not exist.": "Die Ausgabenliste gibt es nicht mehr.",
  "The item does not exist.": "Die Position gibt es nicht mehr.",
  "You are not allowed to mark this expense list as paid.":
    "Du darfst diese Ausgabenliste nicht als bezahlt markieren.",
  "Only completed expense lists can be marked as paid.":
    "Nur erledigte Ausgabenlisten können als bezahlt markiert werden.",
  "The expense list is already marked as paid.":
    "Die Ausgabenliste ist bereits als bezahlt markiert.",
  "The settlement payments are invalid.":
    "Die Erstattungsvorschläge sind ungültig.",
  "The settlement contains an unknown group member.":
    "Die Erstattung enthält eine unbekannte Person.",
  "The expense list payment does not exist.":
    "Die Erstattung gibt es nicht mehr.",
  "The expense list payment is already paid.":
    "Die Erstattung wurde bereits bestätigt.",
  "Only the recipient or a group admin can confirm this payment.":
    "Nur die empfangende Person oder ein Gruppen-Admin kann diese Zahlung bestätigen.",
  "The settlement payments do not match the list calculation.":
    "Die Erstattungen entsprechen nicht mehr der aktuellen Abrechnung.",
  "The sub-items exceed the total amount of a receipt.":
    "Die Unterpositionen übersteigen die Bon-Summe.",
  "Only group admins can create lists.":
    "Nur Gruppen-Admins dürfen Listen erstellen.",
  "List name must contain between 1 and 80 characters.":
    "Der Listenname muss zwischen 1 und 80 Zeichen lang sein.",
}

function readMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return null
}

export function getActionErrorMessage(error: unknown) {
  const message = readMessage(error)
  if (!message) {
    return "Die Aktion konnte nicht ausgeführt werden."
  }

  if (databaseMessages[message]) {
    return databaseMessages[message]
  }

  const normalizedMessage = message.toLowerCase()
  if (
    normalizedMessage.includes("transfer") &&
    (normalizedMessage.includes("permission") ||
      normalizedMessage.includes("allowed"))
  ) {
    return "Du hast keine Berechtigung, diese Position zu übertragen."
  }
  if (
    normalizedMessage.includes("transfer") &&
    normalizedMessage.includes("already")
  ) {
    return "Diese Position wurde bereits übertragen."
  }
  if (
    normalizedMessage.includes("group") &&
    (normalizedMessage.includes("same") ||
      normalizedMessage.includes("different"))
  ) {
    return "Quell- und Zielliste müssen zur selben Gruppe gehören."
  }
  if (
    normalizedMessage.includes("list") &&
    (normalizedMessage.includes("open") ||
      normalizedMessage.includes("closed"))
  ) {
    return "Übertragen ist nur zwischen offenen Listen möglich."
  }
  if (
    normalizedMessage.includes("receipt") &&
    (normalizedMessage.includes("incomplete") ||
      normalizedMessage.includes("itemized") ||
      normalizedMessage.includes("remainder") ||
      normalizedMessage.includes("unitemized"))
  ) {
    return "Der Bon muss vollständig aufgeschlüsselt sein, bevor er übertragen werden kann."
  }

  return message
}
