import { describe, expect, it } from "vitest"
import { getActionErrorMessage } from "./errorMessage"

describe("getActionErrorMessage", () => {
  it("übersetzt bekannte Datenbankmeldungen", () => {
    expect(
      getActionErrorMessage({
        message: "Items can only be changed on open expense lists.",
      })
    ).toBe("Positionen können nur bei offenen Ausgabenlisten geändert werden.")
  })

  it("lässt unbekannte Meldungen unverändert durch", () => {
    expect(getActionErrorMessage(new Error("Verbindung fehlgeschlagen"))).toBe(
      "Verbindung fehlgeschlagen"
    )
  })

  it("nutzt einen Standardtext ohne lesbare Meldung", () => {
    expect(getActionErrorMessage(null)).toBe(
      "Die Aktion konnte nicht ausgeführt werden."
    )
  })
})
