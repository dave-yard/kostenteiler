# Umsetzungsstand und offene Aufgaben

Stand: 18. November 2026

Grundlage: [Anwendungs-Regelwerk](./APP_REQUIREMENT.md),
[Architektur](./ARCHITEKTUR.md), [Design](./DESIGN.md),
[README](./README.md) und [CLAUDE.md](./CLAUDE.md).

## Einordnung

- `[x]` bedeutet: Der beschriebene **Teilumfang** ist im Repository erkennbar;
  dies ist keine Bestätigung der gesamten Anforderung einschließlich Backend.
- `[ ]` bedeutet: offen, teilweise umgesetzt oder noch zu überprüfen.
- Die Prüfung erfolgte anhand von Quellcode, Dokumenten und automatisierten
  Prüfungen, nicht anhand eines verbundenen Supabase-Projekts oder eines
  vollständigen manuellen Browser- und Accessibility-Tests.
- „Nice to Have“ ist ausdrücklich kein MVP-Blocker; die übrigen Punkte aus
  FR-1 bis FR-5 gehören laut Anwendungs-Regelwerk zum MVP.

## Bereits erkennbar umgesetzt

### Anmeldung und Gruppen

- [x] Registrierung mit Pflicht-Anzeigenamen, E-Mail/Passwort, Magic Link und
      Passwort-Recovery sind im Frontend und Auth-Service vorhanden.
      ([AuthScreen](./src/components/AuthScreen.tsx),
      [Auth-Service](./src/services/authService.ts),
      [Passwort-Recovery](./src/pages/PasswordRecovery/PasswordRecovery.tsx))
- [x] Gruppenübersicht, Gruppenerstellung, persönliche Sortierung per Drag-and-drop
      einschließlich Tastaturbedienung sowie Speichern über eine RPC sind vorhanden.
      ([Gruppenübersicht](./src/pages/GroupOverview/GroupOverview.tsx),
      [Gruppen-Service](./src/services/groupService.ts))
- [x] Hauptnavigation mit „Gruppen“ und unabhängig erreichbarer Freundesliste,
      Kontaktverwaltung sowie Mitgliederverwaltung mit Kontaktvorschlägen sind
      im Frontend vorhanden.
      ([App](./src/App.tsx), [Kontakte](./src/pages/PersonalContacts/PersonalContacts.tsx),
      [Gruppenverwaltung](./src/pages/GroupAdmin/GroupAdmin.tsx))
- [x] Anbindung für Hinzufügen von Mitgliedern, Verknüpfen ausstehender Mitglieder
      und Annahme bestehender Einladungen ist vorhanden.
      ([Gruppen-Service](./src/services/groupService.ts),
      [Einladung](./src/pages/GroupInvitation/GroupInvitation.tsx))
- [x] UI für Gruppenarchivierung, getrennte Mitgliederrechte und
      Gruppenstandard-Verteilung ist vorhanden.
      ([Gruppenverwaltung](./src/pages/GroupAdmin/GroupAdmin.tsx))

### Listen, Positionen und Abrechnung

- [x] Listen werden standardmäßig mit Filter `open` geladen; erledigte Listen
      können eingeblendet werden. Erstellung und Statusaktionen sind an Services
      und RPCs angebunden.
      ([Listen-Service](./src/services/listService.ts),
      [Listenansicht](./src/pages/ExpenseLists/ExpenseLists.tsx))
- [x] Manuelles Anlegen, Bearbeiten und bestätigtes Löschen von Positionen,
      Zahlerauswahl, Cent-Eingabe und UI-Berechtigungsprüfungen sind vorhanden.
      ([Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx),
      [Betragslogik](./src/lib/money.ts),
      [Positions-Service](./src/services/itemService.ts))
- [x] Bons und Unterpositionen können manuell erfasst und hierarchisch
      angezeigt werden. Die Listensumme zählt die oberste Ebene; der Bon-Rest wird
      separat verrechnet und eine Überschreitung blockiert die Detail-Abrechnung.
      ([Hierarchie](./src/lib/itemHierarchy.ts),
      [Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx))
- [x] Gleichmäßige, vollständige, prozentuale und feste Aufteilungen sowie
      Parent- und Gruppenstandard sind in der Berechnungslogik enthalten;
      Rundung und Validierung sind durch Unit-Tests abgedeckt.
      ([Aufteilungslogik](./src/lib/expenseSplit.ts),
      [Tests](./src/lib/expenseSplit.test.ts))
- [x] Nettosalden und Erstattungsvorschläge werden berechnet und im
      ausklappbaren Abrechnungsbereich angezeigt.
      ([Abrechnung](./src/lib/settlement.ts),
      [Tests](./src/lib/settlement.test.ts),
      [Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx))
- [x] Eine Textsuche durchsucht auch Beträge und Unterpositionen und behält bei
      Unterpositions-Treffern den Parent in der Ergebnisliste.
      ([Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx))

### Technische Grundlage

- [x] React, TypeScript, Vite, Tailwind, zentraler Supabase-Client, fachliche
      Services und Contexts sind vorhanden.
      ([Paketdefinition](./package.json), [App](./src/App.tsx),
      [Supabase-Client](./src/lib/supabase.ts))
- [x] Geist Variable und gemeinsame UI-Bausteine für Button, Input, Checkbox
      und Toast sind eingebunden.
      ([Styles](./src/index.css), [UI-Komponenten](./src/components/ui/))
- [x] Am Prüfdatum bestanden `npm test` (14 Dateien, 132 Tests) und
      `npm run build`. `npm run lint` lief ohne Fehler, aber mit zwei Warnungen.

### Listen und Automatisierung

- [x] Listentyp und Konfiguration für einmalige und wiederkehrende Listen
      ergänzen. Das Listenmodell und die Erstellung enthalten derzeit nur den
      Namen und keinen Wiederholungstyp. (FR-2.3;
      [Typen](./src/types/group.ts), [Listen-Service](./src/services/listService.ts))
- [x] Automatische Periodenerzeugung für monatliche, quartalsweise und jährliche
      Intervalle einschließlich Monatsende/Schaltjahr implementieren; Positionen,
      Beträge und Verteilungen aus der Vorperiode übernehmen und anpassbar halten.
      (FR-5.2)
- [x] Manuellen und automatischen Abschluss für wiederkehrende Listen
      konfigurieren; bei automatischem Abschluss Salden und Vorschläge berechnen,
      ohne Zahlungen vorzeitig als bezahlt zu markieren. (FR-5.3)
- [x] Erstellungs-, Abschluss- und Bezahlzeitpunkt **und handelnden Nutzer**
      dauerhaft speichern und nachweisen. Das Frontend-Listenmodell enthält
      Zeitpunkte, aber keine handelnden Nutzer. (MVP-Umfang)

### Abschluss und Zahlungen

- [x] Erstattungsvorschläge beim Kassenabschluss dauerhaft speichern und für
      jedes Gruppenmitglied anzeigen; einzelnen Zahlungen einen eigenen Status
      geben. Die Vorschläge werden beim Abschluss atomar gespeichert und in der
      Listenabrechnung mit ihrem Zahlungsstatus angezeigt. (FR-5.1/5.4;
      [Listenansicht](./src/pages/ExpenseLists/ExpenseLists.tsx),
      [Listen-Service](./src/services/listService.ts))
- [x] Zahlungsbestätigung auf Empfänger oder Gruppen-Admin begrenzen und die
      Liste erst nach Bestätigung aller Vorschläge bzw. bei null Vorschlägen sofort
      nach Abschluss automatisch auf `isPaid` setzen. Der direkte Listen-Status-
      Button ist dafür entfallen. (FR-5.4)

<!-- - [ ] Abschluss über **alle** Oberflächen gegen ungültige Bon-Summen und
      fehlgeschlagene Abrechnungsdaten absichern und serverseitig prüfen: In der
      Listendetailansicht gibt es eine Abrechnungssperre, die Listenübersicht hat
      einen separaten Abschlussweg. (FR-3.4.1/FR-5.1) -->

## Architektur, Design und Dokumentation

- [x] Auswahlfelder einschließlich Optionslisten, Radio-Gruppe, Dialoge,
      Bestätigungen, Menü, Popover und Kontaktvorschläge auf gemeinsame
      shadcn-/Base-UI-Bausteine umgestellt; Fachseiten verwenden für Buttons
      und Eingabefelder die gemeinsamen Komponenten.
      ([UI-Komponenten](./src/components/ui/),
      [Gruppenverwaltung](./src/pages/GroupAdmin/GroupAdmin.tsx),
      [Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx))
- [ ] Die tatsächliche Farbpalette mit dem Design-Regelwerk abgleichen:
      `--brand-primary` ist derzeit `#0f766e` statt `#1f3b2d`, der Hintergrund
      `whitesmoke` statt `#f5f6f2` und Karten sind nicht weiß.
      ([Styles](./src/index.css), [Design](./DESIGN.md))
- [ ] Mobile Darstellung, Scrollverhalten, Tastaturbedienung, Dialogfokus,
      zugängliche Namen und Kontrast für relevante Zustände und Themes im Browser
      prüfen. Aus statischem Code und Unit-Tests folgt keine vollständige
      Accessibility- oder Responsive-Abnahme. (NFR-3.1, Design)
- [ ] Fehlerbehandlung an Architekturvorgaben angleichen: Das Laden von
      Aufteilungsregeln für die Sortierung unterdrückt Fehler; die
      Berechtigungsabfrage in der Listenansicht setzt bei Fehler stillschweigend
      `canClose` auf `false`.
      ([Positions-Service](./src/services/itemService.ts),
      [Listenansicht](./src/pages/ExpenseLists/ExpenseLists.tsx))
- [ ] Die Architektur-Dokumentation an die tatsächlichen Kostenteiler-Routen
      und Provider anpassen: Der allgemeine Überblick beschreibt noch devBoard;
      auch der Hinweis auf `selectedList` in der Gruppenübersicht bildet das
      Routing nicht vollständig ab. Allgemeine Regeln und Beispiele als solche
      erhalten. ([Architektur](./ARCHITEKTUR.md), [App](./src/App.tsx))
- [ ] Passwort-Recovery-Weiterleitung unter dem GitHub-Pages-Basispfad
      überprüfen: Der Recovery-Service verwendet `window.location.origin`,
      während andere Auth-Weiterleitungen einen projektspezifischen Pfad
      berücksichtigen. ([Auth-Service](./src/services/authService.ts))
- [ ] Zwei `react-hooks/exhaustive-deps`-Warnungen in
      [Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx) prüfen;
      die Build-Warnung zum über 500 kB großen JavaScript-Chunk auf mögliche
      Aufteilung untersuchen.
- [ ] Weitere UI- und Integrationstests für Gruppenverwaltung, Kontakte,
      Einladungen, Rechte und die noch offenen Abläufe ergänzen.

## Nice to Have

- [x] Benutzeroberfläche zum Übertragen von Positionen in eine andere offene
      Liste derselben Gruppe einschließlich Admin-Erstellung einer Einmalliste,
      Anzeige und Sperre der verknüpften Gegenpositionen über die Datenbank-RPC.
- [x] Frontend-Anbindung für Bon-Upload, Verarbeitung, Abweichungswarnung und
      Bild-/PDF-Vorschau ist vorhanden; Backend und produktiver Ablauf sind damit
      noch nicht nachgewiesen.
      ([Positions-Service](./src/services/itemService.ts),
      [Belegvorschau](./src/pages/ExpenseListDetail/ReceiptPreview.tsx))
- [ ] Dateitypen abstimmen: Die Dateiauswahl akzeptiert PDF, der Upload-Service
      weist Nicht-Bilddateien ab. ([Listendetail](./src/pages/ExpenseListDetail/ExpenseListDetail.tsx),
      [Positions-Service](./src/services/itemService.ts))
- [ ] Ladefehler der Belegvorschau von „keine Datei vorhanden“ unterscheiden;
      der Service gibt derzeit auch bei Fehlern `null` zurück.
      ([Positions-Service](./src/services/itemService.ts),
      [Belegvorschau](./src/pages/ExpenseListDetail/ReceiptPreview.tsx))
- [ ] Verständliche Meldung prüfen/ergänzen, wenn ein Mitglied wegen bestehender
      Positionen nicht entfernt werden kann.
- [ ] Deutsche Datenbankfehlermeldungen für bislang nicht abgedeckte Bereiche
      schrittweise vereinheitlichen. ([Fehlermeldungen](./src/lib/errorMessage.ts))
