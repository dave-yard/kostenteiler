export function formatCents(amountCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100)
}

/**
 * Wandelt eine Betragseingabe wie "12,50" in ganze Cent um (1250).
 *
 * Geld wird in der App und in der Datenbank (`amount_cents`) immer als ganze
 * Cent-Zahl geführt. Fließkommazahlen können viele Dezimalwerte nicht exakt
 * darstellen, Beispiel: 0.29 * 100 ergibt 28.999999999999996. Würde man das
 * abschneiden, fehlte ein Cent.
 *
 * Gibt `null` zurück, wenn die Eingabe kein gültiger positiver Betrag ist.
 */
export function parseAmountToCents(input: string): number | null {
  let text = input.trim()

  // Punkt und Komma zusammen: Das Komma ist der Dezimaltrenner, der Punkt ein
  // Tausendertrenner (typisch beim Einfügen von "1.234,50"). Die Punkte müssen
  // Dreiergruppen vor dem Komma bilden, sonst ist es vermutlich ein Tippfehler
  // oder US-Schreibweise ("1,234.50") und wird abgelehnt.
  if (text.includes(",") && text.includes(".")) {
    if (!/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) {
      return null
    }
    text = text.replace(/\./g, "")
  } else if (text.includes(".")) {
    // Nur Punkt, ohne Komma:
    //  - Dreiergruppen ("1.234", "1.234.567") sind Tausendertrenner, die
    //    Punkte werden entfernt.
    //  - Ein einzelner Punkt mit 1 oder 2 Ziffern dahinter ("12.5", "12.50")
    //    ist ein Dezimaltrenner und bleibt für die Prüfung unten erhalten.
    //  - Alles andere ist unklar und wird abgelehnt.
    if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, "")
    } else if (!/^\d+\.\d{1,2}$/.test(text)) {
      return null
    }
  }

  // Erst prüfen, dann rechnen. Erlaubt sind 1 bis 7 Ziffern, optional gefolgt
  // von Komma oder Punkt und 1 bis 2 Nachkommastellen. Das schließt aus:
  //  - Text und Sonderfälle, die Number() trotzdem frisst, z. B. "1e5"
  //  - Minuszeichen (negative Beträge)
  //  - mehr als zwei Nachkommastellen, die keine ganzen Cent mehr wären
  // Die Obergrenze von 7 Ziffern hält den Betrag weit unter
  // Number.MAX_SAFE_INTEGER, sodass die Rechnung unten exakt bleibt.
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(text)) {
    return null
  }

  // Komma zu Punkt, weil Number() nur den Punkt als Dezimaltrenner kennt.
  // Das * 100 kann winzige Rundungsfehler erzeugen (siehe oben). Sie liegen
  // bei etwa 1e-14 und damit weit unter 0,5. Math.round holt deshalb immer
  // zuverlässig die richtige ganze Cent-Zahl zurück.
  const cents = Math.round(Number(text.replace(",", ".")) * 100)

  // 0 lehnt auch die Datenbank ab (amount_cents > 0).
  return cents > 0 ? cents : null
}
