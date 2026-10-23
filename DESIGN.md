# Design-Regelwerk

Dieses Dokument beschreibt das visuelle Design der Kostenteiler-Anwendung.
Es ergänzt [APP_REQUIREMENT.md](./APP_REQUIREMENT.md) um Gestaltungsregeln und
[ARCHITEKTUR.md](./ARCHITEKTUR.md) um UI-Konventionen. Fachliche Abläufe und
Berechtigungen richten sich weiterhin nach dem Anwendungs-Regelwerk.

## 1. Gestaltungsziele

- Ruhiges, freundliches und vertrauenswürdiges Erscheinungsbild für eine App
  rund um gemeinsame Ausgaben.
- Mobile Nutzung hat Vorrang: Inhalte bleiben auf kleinen Displays lesbar,
  bedienbar und vertikal erreichbar.
- Klare visuelle Hierarchie statt unnötiger Dekoration.
- Ein konsistentes Erscheinungsbild für Login, Gruppen, Listen, Formulare und
  Dialoge.
- Status, Fehler und nächste Schritte werden verständlich und barrierearm
  vermittelt.

## 2. Visuelle Sprache

- Heller, leicht warmer Hintergrund mit dunklem Waldgrün als primärer
  Markenfarbe.
- Dezente Salbei- und Sandtöne setzen Akzente, ohne Informationen zu
  überdecken.
- Weiße Karten, feine Rahmen und weiche Schatten trennen Inhaltsbereiche.
- Abgerundete Ecken und sparsame Linien vermitteln eine zugängliche, moderne
  Anmutung.
- Icons ergänzen beschriftete Bedienelemente; sie ersetzen keine wichtigen
  Beschriftungen.

## 3. Farbpalette

| Verwendung | Farbe | Wert |
| --- | --- | --- |
| Seitenhintergrund | Warmes Off-White | `#f5f6f2` |
| Flächen und Karten | Weiß | `#ffffff` |
| Haupttext | Dunkles Anthrazitgrün | `#20241f` |
| Primärfarbe / Hauptaktionen | Waldgrün | `#1f3b2d` |
| Primärfarbe Hover | Helleres Waldgrün | `#294b38` |
| Sekundärer Text | Gedämpftes Grau | `#72766f` |
| Salbei-Akzent | Helles Salbei | `#edf3e9` |
| Heller Markenakzent | Sanftes Limettengrün | `#d8eb9a` |
| Rahmen | Helles Neutralgrau | `#e4e7e1` |
| Erfolgsfläche | Sehr helles Grün | `#f0f7ed` |
| Warnfläche | Helles Amber | `#fffbeb` |
| Fehlerfläche | Helles Rot | `#fef2f2` |

Farben mit semantischer Bedeutung (Erfolg, Warnung, Fehler) müssen zusätzlich
durch Text, Icon oder Statuslabel erkennbar sein und dürfen sich nicht allein
durch ihre Farbe unterscheiden.

## 4. Typografie und Abstände

- Die Anwendung verwendet **Geist Variable** als Schriftfamilie.
- Überschriften sind kräftig, kompakt und klar vom Fließtext abgesetzt.
- Fließtext soll auf Mobilgeräten gut lesbar sein; wichtige Hinweise nicht als
  sehr kleine Fußnoten verstecken.
- Beschriftungen stehen direkt bei den Eingabefeldern.
- Abstände folgen einem konsistenten 4-Pixel-Raster; größere Gruppen werden
  durch zusätzliche vertikale Abstände voneinander getrennt.

## 5. Komponenten und Interaktionen

- Primäre Aktionen verwenden Waldgrün und eine eindeutige Beschriftung.
- Sekundäre Aktionen verwenden zurückhaltende Flächen oder Umrandungen.
- Destruktive Aktionen benötigen eine klare Kennzeichnung und, falls
  unwiderruflich, eine Bestätigung.
- Eingabefelder haben sichtbare Labels, ausreichende Höhe und einen deutlich
  erkennbaren Tastatur-Fokus.
- Interaktive Controls verwenden die shadcn/ui-Komponenten des Projekts.
  Benötigte, noch fehlende Controls werden nach dem vorhandenen shadcn/ui-
  Muster ergänzt; native Buttons, Eingabefelder, Auswahlfelder und Checkboxen
  werden nicht direkt in Fachseiten eingesetzt.
- Ladezustände deaktivieren doppelte Absendungen und zeigen den laufenden
  Vorgang an.
- Fehler erscheinen nahe an der betroffenen Aktion und erklären, was als
  Nächstes getan werden kann.
- Erfolgszustände bestätigen die Aktion, ohne Inhalte oder Ergebnisse
  vorzutäuschen.
- Dialoge und Bottom Sheets folgen den shadcn/ui- und Tailwind-Mustern des
  Projekts und müssen auf schmalen Displays vollständig erreichbar bleiben.

## 6. Responsive Verhalten und Scrollen

- Mobile ist der Ausgangspunkt; Desktop erweitert Layout und Inhaltsbreite,
  statt die mobile Ansicht lediglich zu verkleinern.
- Auf kleinen Displays wird der Login-Inhalt oben ausgerichtet, sobald er
  höher als der Viewport ist. Die Seite muss dann normal vertikal scrollbar
  bleiben.
- `100svh` kann als Mindesthöhe dienen, darf aber nicht mit `overflow-hidden`
  das Dokument oder den Login-Inhalt abschneiden.
- In der Gruppenübersicht bleiben Kopfbereich und Formular zum Erstellen
  einer Gruppe sichtbar. Ausschließlich die Gruppenliste scrollt innerhalb
  des verfügbaren Bereichs. Detail- und Adminansichten scrollen unabhängig
  davon in ihrem Inhaltsbereich.
- Horizontales Überlaufen wird vermieden; vertikales Scrollen bleibt für
  Seiteninhalte und Tastatur geöffnet.
- Interaktive Flächen müssen bequem mit Touch bedienbar sein.
- Sortierbare Listen bieten einen klar erkennbaren Drag-Handle, der mit Touch
  und Tastatur bedienbar ist; Änderungen der Reihenfolge werden dauerhaft
  gespeichert und Fehler sichtbar gemeldet.
- Auf größeren Bildschirmen kann das Login als zweispaltige Karte erscheinen;
  die ergänzende Marken-/Illustrationsfläche entfällt auf Mobilgeräten.

## 7. Barrierefreiheit

- Semantische Überschriften, Formulare, Buttons und Labels verwenden.
- Alle Funktionen per Tastatur bedienbar halten und Fokuszustände sichtbar
  machen.
- Fehler und dynamische Statusmeldungen mit passenden ARIA-Rollen ausgeben.
- Bedienelemente erhalten verständliche zugängliche Namen.
- Ausreichender Kontrast und verständliche Statuskommunikation sind für alle
  Theme- und Zustandsvarianten zu berücksichtigen.

## 8. Login als Referenz

Der Login ist die erste Referenz für die visuelle Sprache der Anwendung:

- Heller Hintergrund, zentraler weißer Card-Bereich und waldgrüne
  Markenfläche auf großen Bildschirmen.
- Auf Mobilgeräten eine einspaltige, oben beginnende und scrollbar bleibende
  Formularansicht mit kompakter Wortmarke.
- Anmeldung, Registrierung und Magic-Link-Anmeldung teilen sich ein
  konsistentes Formularmuster.
- Supabase-Konfigurationsfehler, Authentifizierungsfehler und Bestätigungen
  werden sichtbar im Formularbereich ausgegeben.
