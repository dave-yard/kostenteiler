# Kostenteiler Applikation – Anwendungs-Regelwerk & Spezifikation

**Autor:** David Weber  
**Rechteinhaber:**  
**Version:** 1.0  
**Stand:** 23. Oktober 2026

---

## 1. Vision & Problemstellung (Ideenphase)

### 1.1 Problemstellung

1. **Unübersichtlichkeit:** Die Abrechnung von gemeinsamen Ausgaben, Einkäufen und Bons in WGs, Urlauben oder Freundesgruppen erfolgt oft über unübersichtliche Notizen oder Chat-Verläufe, wodurch man schnell den Überblick darüber verliert, wer welche Beträge bereits ausgelegt hat und welche Kosten noch offen sind.
2. **Komplexe Aufteilung / Virtuelle Nutzer:** Unterschiedliche Aufteilungsmodelle (z. B. ungleiche Prozentanteile, feste Beträge oder die Einbindung von Personen ohne eigenen App-Account) lassen sich mit Standardmitteln nur sehr kompliziert und fehleranfällig abbilden.
3. **Manueller Aufwand bei Fixkosten:** Wiederkehrende Fixkosten (wie Miete und Nebenkosten) müssen jeden Monat manuell neu angelegt und berechnet werden, was zeitaufwändig ist und im Alltag leicht zu Fehlern oder Vergesslichkeit führt.

### 1.2 Lösungsansatz

1. **Zentrales Listen- & Bon-System:** Eine Applikation für Gruppen, die offene und erledigte Ausgaben übersichtlich filtert und per Kassensturz exakt berechnet, wer wem wie viel erstatten muss.
2. **Flexibles Aufteilungs-Pop-up & Virtuelle Konten:** Feingranulare Zuordnung pro Position (Gleichmäßig, Prozentual, Fester Betrag) sowie Verwaltung passwortloser Nutzer inklusive nahtloser Einladungs- und Registrierungsverknüpfung.
3. **Automatisierung:** Automatisierte Generierung von wiederkehrenden Listen in einstellbaren Intervallen mit optionalem automatischen oder manuellen Abschluss.

---

## 2. Funktionale Anforderungen (Functional Requirements)

### 2.1 Benutzer-, Gruppen- und Einladungsmanagement

- **FR-1.1 (Gruppen erstellen):** Registrierte Benutzer können neue Gruppen erstellen. Der Ersteller wird automatisch als Administrator der Gruppe definiert.
- **FR-1.2 (Gruppenübersicht):** Benutzer können eine Übersicht aller Gruppen einsehen, denen sie fest zugeordnet sind.
- **FR-1.3 (Nutzer anlegen):** Admins können Nutzer einer Gruppe zuordnen, auch wenn diese noch nicht registriert sind (virtuelle/passwortlose Nutzer).
- **FR-1.4.1 (Einladungslinks):** Admins können einen personalisierten Einladungslink für einen virtuellen Nutzer versenden. Der Link verwendet ein einmaliges, zeitlich begrenztes Token und nicht eine erratbare Nutzer-ID als Berechtigungsnachweis. Die Einladung muss bestätigt werden, bevor der virtuelle Nutzer mit dem registrierten Account verknüpft wird.
- **FR-1.4.2 (Doppelte Nutzer / Verknüpfung):** Sollte ein Nutzer sich nicht über den Einladungslink registrieren, muss ein Admin den virtuellen Nutzer mit einem registrierten Account verknüpfen können. Die Verknüpfung erfordert eine Bestätigung und überträgt alle zugehörigen Positionen, Aufteilungen und Ausgleichsdaten. Danach wird der virtuelle Nutzer entfernt.

Popup nach click auf [ 🔀 Mit Account verknüpfen ]

```
+---------------------------------------------------+
| 🔀 Nutzerkonten zusammenführen |
+---------------------------------------------------+
| |
| Wähle den passwortlosen (virtuellen) Nutzer und |
| den echten Account aus, um alle Ausgaben und |
| Splits zu übertragen. |
| |
| Virtueller Nutzer (Bisheriger Platzhalter): |
| [ Select: John Wayne v ] |
| |
| Registrierter Ziel-Account: |
| [ Select: john.w@gmail.com (John) v ] |
| |
| ⚠️ **Achtung (Sicherheitshinweis):** |
| Alle bisherigen Einträge, Positionen und |
| Ausgleichszahlungen von "John Wayne" werden |
| unwiderruflich auf "john.w@gmail.com" übertragen. |
| Der virtuelle Nutzer wird danach gelöscht. |
| |
| [ Abbrechen ] [ ⚠️ Zusammenführung bestätigen ]|
+---------------------------------------------------+
```

### 2.2 Listen- und Statusmanagement

- **FR-2.1 (Listen-Filterung):** Jede Gruppe kann diverse Listen enthalten. Standardmäßig (Default) werden beim Öffnen der Gruppe nur offene Listen geladen; erledigte Listen lassen sich über einen Filter einblenden.
- **FR-2.2 (Admin-Rechte für Listen):** Neue Listen dürfen nur Gruppen-Admins erstellen. Ein Kassenabschluss ist standardmäßig Admins vorbehalten; Admins können diese Berechtigung gemäß FR-2.4 an normale Mitglieder vergeben.
- **FR-2.3 (Listentypen):** Listen müssen beim Erstellen als Typ klassifiziert werden:
  - **Einmalige Listen** (z. B. für spontane Einkäufe oder Urlaube).
  - **Wiederkehrende Listen** (z. B. für monatliche Miete und Nebenkosten, inkl. definierbarer Default-Aufteilungen). Unterstützte Intervalle sind monatlich an einem konfigurierbaren Kalendertag, quartalsweise und jährlich.
- **FR-2.4 (Gruppenverwaltung und Mitgliederrechte):** Nur Gruppen-Admins dürfen Gruppendaten und Gruppenmitglieder verwalten. Neue Gruppen verwenden standardmäßig eine gleichmäßige Aufteilung auf alle Gruppenmitglieder. Admins können für normale Mitglieder separat freigeben, Positionen anzulegen, Positionen zu bearbeiten, Positionen zu löschen, Aufteilungen zu bearbeiten und einen Kassensturz durchzuführen. Nicht ausdrücklich freigegebene Aktionen bleiben Admins vorbehalten; der Kassensturz ist standardmäßig Admins vorbehalten.
- **FR-2.5 (Suche und Betragsfilter):** Nutzer können Positionen nach Bezeichnung durchsuchen und nach Betrag filtern. Suchergebnisse für Unterpositionen zeigen zusätzlich den zugehörigen Bon/Positionsparent, damit die Herkunft der Position erkennbar bleibt.

```
+---------------------------------------------------+
|  [≡] Kostenteiler                          ( 👤 ) | <- Header mit Menü & Profil
+---------------------------------------------------+
|                                                   |
|   Deine Gruppen                                   |
|                                                   |
|   +---------------------------------------------+ |
|   | 🏠 WG Hauptstraße                           | |
|   | 4 Mitglieder · 2 offene Listen              | |
|   | Offen: 120,50 €                             | |
|   | [ Gruppe öffnen > ]                         | |
|   | [ ⚙️ Admin-Settings ]*  [ 👥 Mitglieder ]*   | |
|   +---------------------------------------------+ |
|                                                   |
|   +---------------------------------------------+ |
|   | ✈️ Italien Urlaub 2026                      | |
|   | 3 Mitglieder · 1 offene Liste               | |
|   | Offen: 450,00 €                             | |
|   | [ Gruppe öffnen > ]                         | |
|   | [ ⚙️ Admin-Settings ]*  [ 👥 Mitglieder ]*   | |
|   +---------------------------------------------+ |
|                                                   |
|         [ + Neue Gruppe erstellen ]               |
|                                                   |
+---------------------------------------------------+
|  🏠 Gruppen  |  🔔 Aktiv  |  ⚙️ Settings          | <- Feste untere Navigationsleiste
+---------------------------------------------------+


* Admin-Aktionen: Die Buttons für Administration und Mitgliederverwaltung (⚙️ Admin-Settings, 👥 Mitglieder) werden ausschließlich für Gruppen-Admins auf der Karte eingeblendet. Standard-Mitglieder sehen nur den Button zum Öffnen der Gruppe.
```

Nach click auf Bearbeiten

```
+---------------------------------------------------+
|  [<] Admin: WG Hauptstraße                        |
+---------------------------------------------------+
|                                                   |
|  ⚙️ **Allgemeine Einstellungen**                    |
|  Gruppenname:                                     |
|  [ WG Hauptstraße                               ] |
|  [ Name speichern ]                               |
|                                                   |
|  ------------------------------------------------ |
|                                                   |
|  👥 **Mitgliederverwaltung**                      |
|                                                   |
|  +---------------------------------------------+  |
|  | 👤 Alex (Admin)                             |  |
|  | 📧 alex@wg.de                               |  |
|  | Status: Registriert                         |  |
|  | [ Zum Mitglied machen ]*                    |  |
|  +---------------------------------------------+  |
|                                                   |
|  +---------------------------------------------+  |
|  | 👻 John Wayne                               |  |
|  | Status: Passwortlos (Virtuell)              |  |
|  | [ 🔗 Einladungslink kopieren ]**            |  |
|  | [ 🔀 Mit Account verknüpfen ]**             |  |
|  +---------------------------------------------+  |
|                                                   |
|  ------------------------------------------------ |
|                                                   |
|  ➕ **Neues Mitglied hinzufügen**                 |
|  Name / Name des Nutzers:                         |
|  [ z. B. Karl                                 ] |
|                                                   |
|  (•) Als virtuellen Nutzer anlegen                |
|  ( ) Per E-Mail direkt einladen                   |
|                                                   |
|  [ + Mitglied anlegen ]                           |
|                                                   |
|  ------------------------------------------------ |
+---------------------------------------------------+


* Rollen-Button: Sichtbar für Gruppen-Admins; wird nur bei registrierten Nutzern (mit E-Mail & Passwort) angezeigt, um deren Admin-Status zu verwalten.

** Virtuellen-Aktionen: Die Buttons für den Einladungslink und die Account-Verknüpfung werden ausschließlich bei passwortlosen/virtuellen Nutzern eingeblendet.
```

### 2.3 Positionen, Bons und Hierarchiestruktur

- **FR-3.1 (Einzelpositionen):** Benutzer können manuell Einzelpositionen zu einer Liste hinzufügen. Dabei wird standardmäßig der Ersteller als „Bereits bezahlt von“ eingetragen, was jedoch manuell geändert werden kann. Unterpositionen eines Bons haben jeweils einen eigenen Zahler. Der Zahler des Parent-Bons gilt für den nicht durch Unterpositionen belegten Restbetrag; er wird nicht zusätzlich für die Unterpositionen angerechnet.
- **FR-3.2 (Bon-Upload / Positionsparent):** Ein hochgeladener Kassenbon erzeugt immer einen „Positionsparent“ mit Name des Geschäfts, Datum und Gesamtsumme. Das Originalbild wird im Supabase Storage abgelegt und dem Positionsparent zugeordnet. Beim Einlesen wählt der Nutzer zwischen zwei Modi:
  - **Nur Summe einlesen:** Name des Geschäfts, Datum und Gesamtsumme werden erfasst; der Parent wird als Summen-Bon gekennzeichnet. Es werden keine Unterpositionen angelegt und daher keine Positionssummenprüfung durchgeführt.
  - **Positionen einlesen:** Das System liest die einzelnen Positionen möglichst vollständig aus und ordnet sie dem Positionsparent zu. Der Parent wird als Positions-Bon gekennzeichnet. Der Nutzer muss die erkannten Bezeichnungen und Beträge mit dem Originalbon prüfen und bestätigen. Zusätzlich wird die erkannte Positionssumme mit der Parent-Gesamtsumme verglichen. Bei einer Abweichung wird der Nutzer deutlich gewarnt und aufgefordert, Bon und Einträge zu prüfen und fehlerhafte Erkennungen zu korrigieren. Nach der Warnung darf der Nutzer die abweichende Erfassung ausdrücklich bestätigen.
- **FR-3.3 (Unterpositionen & Rekursive Ansicht):** Ein Bon („Positionparent“) kann Unterpositionen (Einzelposten des Bons) beinhalten. Die Benutzeroberfläche stellt dies als aufklappbare, hierarchische Struktur (Accordion / Card-In-Card) dar.
- **FR-3.4.1 (Summen-Kumulierung):** Bei einer vollständig erfassten Positions-Bon-Erkennung wird eine Abweichung zwischen Unterpositionssumme und Parent-Gesamtsumme angezeigt. Liegt die Unterpositionssumme darunter, kann der Nutzer die Abweichung nach Warnung ausdrücklich bestätigen; der positive Restbetrag wird gemäß FR-3.4.2 über den Parent-Aufteilungsschlüssel verrechnet. Liegt die Unterpositionssumme darüber, fragt die App, ob die Parent-Gesamtsumme auf die erkannte Positionssumme erhöht werden soll. Wird dies abgelehnt, bleibt die Abweichung sichtbar und der Kassensturz ist blockiert, bis die Positionen oder die Parent-Summe korrigiert sind. Bei manuell nur teilweise erfassten Unterpositionen wird ein positiver Restbetrag ausgewiesen und gemäß FR-3.4.2 verteilt.
- **FR-3.4.2 (Differenzierung / Manuelle Restwerterfassung):**
  Wird ein Bon mit einer Gesamtsumme erfasst, ohne alle Einzelpositionen aufzulisten, darf der Nutzer nicht gezwungen werden, jede einzelne Position manuell hinzuzufügen. Fügt der Nutzer eine spezifische Position hinzu und stellt deren Verteilungsschlüssel ein, muss der Rest des Bons automatisch nach dem Standard-Schlüssel des „Positionsparents“ verrechnet werden.

  - **Beispiel / Szenario:**
    1. Ein Bon über **50 €** wird als Positionsparent angelegt.
    2. Es wird eine einzelne Unterposition (_„Socken“_) für **5 €** erfasst mit dem Schlüssel: _„Wird komplett von John Wayne bezahlt“_.
    3. **Ergebnis:** **5 €** werden direkt und ausschließlich dem Soll-Konto von John Wayne angerechnet. Die verbleibende Differenz von **45 €** wird automatisch ermittelt und gemäß der Standard-Aufteilung des Positionsparents auf die Gruppe verteilt.

- **FR-3.5 (Einzelpositionen ohne Bon):** Einzelpositionen, die keinem Bon/Positionsparent zugeordnet sind, werden in der Listenansicht unter der aufklappbaren Gruppe „Sonstiges“ zusammengefasst.

```
+---------------------------------------------------+
|  [<] Wocheneinkauf REWE                     (⚙️)   |
+---------------------------------------------------+
| Filter: [ Offene (Standard) v ]                   |
|                                                   |
| [+ Einzelpos]  [+ Bon hochladen]                  |
| ------------------------------------------------- |
|                                                   |
| 📦 **Bon: REWE Einkauf** (21.10.)                  |
| Ziel: 84,50 €  |  Zahler: Alex                    |
| [▶] Unterpositionen anzeigen (2)                  | <- Default zugeklappt (Klick öffnet Accordion)
|                                                   |
|   +-- Bio-Milch (2,50 €)                          |
|       [✏️ Edit]  [👥 Aufteilung]                  |
|                                                   |
|   +-- Socken (5,00 €)                             |
|       [✏️ Edit]  [👥 Aufteilung]                  |
|                                                   |
|   +-- *(Rest: 77,00 € geteilt)*                   |
|                                                   |
|   [ + Unterposition hinzufügen ]                  |
|                                                   |
| ------------------------------------------------- |
| 🧀 **Käse & Brot**                                |
| Betrag: 12,30 €  |  Zahler: Sam                   |
| [✏️ Edit]  [👥 Aufteilung]                        |
| ------------------------------------------------- |
|                                                   |
| **Gesamtsumme:** 96,80 €                          |
|                                                   |
| [ 🎯 Kassensturz durchführen ]*                   | <- *Nur für Admins der Gruppe sichtbar oder berechtige Personen
|                                                   |
+---------------------------------------------------+
|  🏠 Gruppen  |  🔔 Aktiv  |  ⚙️ Settings          |
+---------------------------------------------------+
```

Popup Anpassen , nach click auf [✏️ Edit]

```
+---------------------------------------------------+
| _________________________________                 | <- Griffleiste (Sheet)
| **Position bearbeiten / neu**                     |
+---------------------------------------------------+
|                                                   |
| Bezeichnung / Name:                               |
| [ Bio-Milch                                     ] |
|                                                   |
| Betrag (€):                                       |
| [ 2,50                                          ] |
|                                                   |
| Datum:                                            |
| [ 23.10.2026                                 📅 ] |
|                                                   |
| ------------------------------------------------- |
| Typ:                                              |
| [ Select: Unterposition                         v ] |
| (Auswahl: Unterposition / Bon-Rechnung)           |
|                                                   |
| ------------------------------------------------- |
| *Verhalten bei Unterpositionen:*                  |
| (•) Teil der aktuellen Summe                      |
|     (Der Betrag wird automatisch vom              |
|      Restbetrag des Bons abgezogen)*              |
| ( ) Bon-Summe erhöhen                             |
|                                                   |
| ------------------------------------------------- |
| [ Abbrechen ]              [ 💾 Speichern ]       |
+---------------------------------------------------+

* Radiobutton-Auswahl: Diese Optionen und die dazugehörige Erklärung werden dynamisch nur dann eingeblendet, wenn als Typ Unterposition ausgewählt ist und die Position zu einem übergeordneten Bon gehört.
```

### 2.4 Flexible Kostenzuordnung (Aufteilungs-Pop-up)

- **FR-4.1 (Pop-up-Trigger):** Durch das Auswählen einer Position öffnet sich ein modaler Dialog (Pop-up / Bottom-Sheet) zur detaillierten Kosteneinstellung.
- **FR-4.2 (Zahlungsquelle):** Das Pop-up enthält ein Select-Feld („Bereits bezahlt von“), um den tatsächlichen Zahler anzupassen.
- **FR-4.3 (Aufteilungsmodi):** Für die Schuldenverteilung stehen drei flexible Modi zur Verfügung:
  - **Komplett:** Ein ausgewählter Nutzer übernimmt den gesamten Betrag der Position; alle anderen Nutzer tragen 0 € bei.
  - **Prozentual:** Manuelle Anpassung von Prozentwerten pro Person. Die Anteile müssen zusammen genau 100 % ergeben.
  - **Fester Betrag:** Zuweisung fester Euro-Beträge an Personen. Die Summe der zugewiesenen Beträge darf den Positionsbetrag nicht überschreiten; ein verbleibender Rest wird entsprechend dem geltenden Standard-Aufteilungsschlüssel verteilt.
- **FR-4.4 (Zuordnungstabelle `item_split`):** Jede Position speichert die individuellen Anteile und die Aufteilungsart in einer separaten Zuordnungstabelle in der Datenbank.
- **FR-4.5 (Standard-Aufteilungsschlüssel):** Jede Gruppe besitzt einen konfigurierbaren Standard-Aufteilungsschlüssel für Einzelpositionen ohne Parent. Ein Bon/Positionsparent kann einen eigenen Schlüssel festlegen. Dieser Parent-Schlüssel wird ausschließlich auf den nicht durch Unterpositionen belegten Restbetrag angewandt; der Parent selbst wird nicht zusätzlich als Kostenposition abgerechnet.

Popup nach click auf [ [👥 Aufteilung] ]

```
+---------------------------------------------------+
| _________________________________                 | <- Griffleiste (Sheet)
| **Position anpassen: Socken**                     |
| Betrag: 5,00 €                                    |
|                                                   |
| Bereits bezahlt von:                              |
| [ John Wayne                                  v ] |
|                                                   |
| Aufteilungsmodus:                                 |
| (•) Fester Betrag                                 |
| ( ) Prozentual                                    |
| ( ) Komplett        [ John Wayne v ]              | <-- Auswahl muss nullable sein
| Zuweisung:                                        |
| 👤 Alex                                           |
|    [  0,00  ] €                                   |
| 👤 Sam                                            |
|    [  0,00  ] €                                   |
| 👤 John Wayne                                     |
|    [  5,00  ] €                                   |
|                                                   |
| Rest: 0,00 €                                      |
|                                                   |
| [ Abbrechen ]              [ 💾 Speichern ]       |
+---------------------------------------------------+

Zahlungsquelle (paid_by): Legt fest, wer den Betrag ursprünglich ausgelegt bzw. bezahlt hat (wichtig für die spätere Kassensturz-Berechnung).

Aufteilungsmodus (split_mode):

Fester Betrag: Direkte Euro-Zuweisung pro Person (wie im obigen Beispiel).

Prozentual: Eingabe von Prozentwerten (Summe ergibt 100%).

Komplett: Gleichmäßige Aufteilung auf alle oder ausgewählte Gruppenmitglieder.

Rest-Kontrolle: Die Live-Anzeige des Restbetrags stellt sicher, dass die Summe der individuellen Zuweisungen exakt mit dem Positionsbetrag übereinstimmt, bevor der Speichern-Button aktiv wird.

```

### 2.5 Kassensturz und Automatisierung

- **FR-5.1 (Kassenabschluss und Ausgleich):** Ein Kassenabschluss („Kassensturz“) darf von Admins und von Mitgliedern mit der dafür freigegebenen Berechtigung durchgeführt werden. Das System berechnet pro Mitglied den Nettosaldo aus geleisteten Zahlungen und dem persönlichen Kostenanteil. Anschließend werden die Salden so miteinander verrechnet, dass die Anzahl der nötigen Erstattungszahlungen möglichst gering ist. Beispiel: A hat 100 € und B 30 € für eine gleichmäßig zwischen zwei Personen geteilte Liste bezahlt. Bei 65 € Kostenanteil pro Person hat A einen Nettosaldo von +35 €, B von -35 €; B erstattet A 35 €. Die daraus resultierenden Zahlungen („wer zahlt wem wie viel“) sind für alle Gruppenmitglieder ersichtlich.
- **FR-5.2 (Wiederkehrende Automatisierung):** Wiederkehrende Listen werden monatlich an einem konfigurierbaren Tag, quartalsweise (alle drei Monate) oder jährlich (alle zwölf Monate) automatisch neu generiert. Quartals- und Jahresintervalle orientieren sich am Startdatum der wiederkehrenden Liste. Fällt ein Stichtag im Zielmonat weg (z. B. der 31. oder bei einem Jahresintervall der 29. Februar), wird die Liste am letzten Kalendertag dieses Monats erzeugt. Eine neue Periode übernimmt die Positionen, Beträge und Aufteilungsschlüssel der letzten Periode als Ausgangswerte; die Inhalte können vor dem Abschluss angepasst werden. Die Abrechnung verwendet dieselbe Nettosaldo- und Zahlungskonsolidierung wie bei einmaligen Listen.
- **FR-5.3 (Abschluss-Modus für Intervalle):** Für wiederkehrende Listen kann konfiguriert werden, ob ein Zeitraum automatisch oder manuell abgeschlossen wird. Beim automatischen Abschluss werden Nettosalden und Erstattungsvorschläge automatisch berechnet; die tatsächlichen Erstattungen bleiben offen, bis sie gemäß FR-5.4 bestätigt werden. Für den manuellen Kassensturz gelten zusätzlich die in FR-2.4 konfigurierten Mitgliederrechte.

- **FR-5.4 (Erstattungen nach dem Kassensturz):** Die empfangende Person oder ein Gruppen-Admin kann eine vorgeschlagene Erstattungszahlung als bezahlt markieren. Die App führt den Zahlungsstatus jeder Ausgleichszahlung. Sobald alle vorgeschlagenen Erstattungen einer Liste als bezahlt markiert sind, wird die Liste automatisch zusätzlich als vollständig bezahlt gekennzeichnet. Gibt es keine Erstattungszahlungen, wird sie nach dem Kassenabschluss unmittelbar als vollständig bezahlt gekennzeichnet.

---

## 3. Nicht-funktionale Anforderungen (Non-Functional Requirements)

### 3.1 Technologie-Stack & Architektur

- **NFR-1.1 (Frontend):** Entwicklung als moderne Single-Page-Application (SPA) mit **React**, **TypeScript** und **Vite** für schnelle Ladezeiten und optimale Entwicklungs-DX. Mobile-First.
- **NFR-1.2 (Styling & UI):** Verwendung von **Tailwind CSS** in Kombination mit **shadcn/ui** für ein einheitliches, modernes und barrierearmes Design (Modals, Bottom Sheets, Accordions).
- **NFR-1.3 (Backend & Database):** Nutzung von **Supabase** als Backend-as-a-Service (PostgreSQL-Datenbank, Authentifizierung, Storage für Bon-Bilder, Edge Functions für Bon-Verarbeitung).

### 3.2 Sicherheit und Datenintegrität

- **NFR-2.1 (Row Level Security - RLS):** Sämtliche gruppenbezogenen Datenbanktabellen, einschließlich Gruppen, Mitgliedschaften und Rollen/Rechten, Listen, Positionen, Aufteilungen, Ausgleichszahlungen, Einladungen und Gruppeneinstellungen, müssen in Supabase über Row Level Security (RLS) abgesichert sein. Lese- und Schreibzugriffe richten sich nach Gruppenmitgliedschaft, Rolle und den konfigurierten Rechten. Bon-Dateien im Supabase Storage müssen durch passende Storage-Richtlinien denselben Gruppenzugriffsschutz erhalten.
- **NFR-2.2 (Authentifizierung):** Sichere Nutzerauthentifizierung über Supabase Auth (E-Mail/Passwort, Magic Links).

### 3.3 Usability und Performance

- **NFR-3.1 (Mobile First / Responsive Design):** Da die Anwendung direkt vor Ort (z. B. beim Einkaufen oder im Restaurant auf dem Smartphone) bedient wird, müssen alle Ansichten, insbesondere Listen, Eingabemasken und Pop-ups/Sheets, kompromisslos für mobile Endgeräte optimiert sein.
- **NFR-3.2 (Initial Load):** Durch das standardmäßige Laden ausschließlich offener Listen wird die Datenmenge beim Aufrufen einer Gruppe gering gehalten, was die Performance spürbar verbessert.
