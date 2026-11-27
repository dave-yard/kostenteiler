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

  it("übersetzt neue Aufteilungsfehler", () => {
    expect(
      getActionErrorMessage({
        message: "Percentage shares must total exactly 100 percent.",
      })
    ).toBe("Die Prozentanteile müssen zusammen genau 100 % ergeben.")
  })

  it("übersetzt typische Fehler bei Übertragungen", () => {
    expect(
      getActionErrorMessage(
        new Error("Source and target expense lists must be open.")
      )
    ).toBe("Übertragen ist nur zwischen offenen Listen möglich.")
    expect(
      getActionErrorMessage(new Error("This item has already been transferred."))
    ).toBe("Diese Position wurde bereits übertragen.")
    expect(
      getActionErrorMessage(new Error("Receipt is not fully itemized."))
    ).toBe(
      "Der Bon muss vollständig aufgeschlüsselt sein, bevor er übertragen werden kann."
    )
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
