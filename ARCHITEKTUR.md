# Architektur-Regelwerk für React-Anwendungen

Dieses Dokument beschreibt die Architektur von **devBoard** und hält die Regeln fest, nach denen neue Funktionen aufgebaut werden sollen. Es ist zugleich als Vorlage für neue Anwendungen mit einem anderen fachlichen Thema gedacht: Das Thema und die Domänenbegriffe ändern sich, die Trennung der Zuständigkeiten, der Datenfluss und die Context-/Provider-Muster bleiben grundsätzlich gleich.

## 1. Architekturziele

- Zuständigkeiten sind klar getrennt: UI, fachlicher Zustand, Datenzugriff und Datenmodell liegen an vorhersehbaren Orten.
- Komponenten beziehen fachliche Daten über typisierte Hooks statt über direkte Datenbankzugriffe.
- Contexts besitzen nur den Zustand, den mehrere Komponenten eines zusammenhängenden Fachbereichs gemeinsam benötigen.
- Änderungen werden zuerst erfolgreich persistiert und danach im lokalen Zustand sichtbar gemacht. Optimistische Updates sind eine bewusste Ausnahme und benötigen eine Fehler-Rücknahme.
- Lade-, Leer- und Fehlerzustände werden sichtbar und ausdrücklich behandelt.
- Datenbankmodelle und UI-Modelle werden an einer klaren Grenze ineinander übersetzt.
- Änderungen sollen mit dem vorhandenen Projektstil konsistent, testbar und für ein anderes Domänenthema übertragbar sein.

## 2. Architektur dieser App im Überblick

### Verzeichnisstruktur

```text
src/
  App.tsx                         # Provider-Komposition und Routen
  Layout.tsx                      # gemeinsamer Navigationsrahmen mit Outlet
  main.tsx                        # React-Einstiegspunkt, StrictMode, CSS
  components/
    contexts/                     # globale und fachbereichsweite Zustände
    dialogs/                      # zusammengesetzte Dialoge/Formulare
    ui/                           # wiederverwendbare UI-Bausteine
    AuthScreen.tsx                # nicht angemeldeter Zustand
    theme-provider.tsx            # Theme-Zustand
  pages/
    BoardOverview/                # Übersichtsroute
    BoardDetail/                  # dynamische Detailroute
    Profile/                      # Profilroute
  services/                       # Supabase-Abfragen und Mutationen
  types/                          # Frontend-Domänen- und DB-Typen
  lib/
    supabase.ts                   # zentraler, einmalig erzeugter Client
    utils.ts                      # technische Hilfsfunktionen
```

### Laufzeit- und Datenfluss

```text
main.tsx
  └─ App
      └─ ThemeProvider
          └─ Tooltip.Provider
              └─ AuthProvider
                  └─ AuthenticatedApp
                      ├─ lädt / prüft Authentifizierung
                      ├─ ohne Session: AuthScreen
                      └─ mit Session:
                          └─ UserContextProvider
                              └─ BoardOverviewProvider
                                  └─ RouterProvider
                                      └─ Layout
                                          ├─ Navigation / Abmeldung
                                          └─ Outlet
                                              ├─ BoardOverview
                                              ├─ Profile
                                              └─ detail/:boardId
                                                  ├─ Route-Loader lädt Columns
                                                  └─ BoardDetailsProvider
                                                      └─ BoardDetail
```

- `main.tsx` mountet die Anwendung und aktiviert `StrictMode`.
- `App.tsx` setzt die Provider zusammen, definiert die Routen und entscheidet anhand der Authentifizierung, ob geschützte Datenkontexte überhaupt gemountet werden.
- `Layout.tsx` stellt gemeinsame Navigation und `Outlet` bereit. Fachseiten bleiben dadurch unabhängig vom globalen Seitenrahmen.
- Der Detail-Loader in `App.tsx` lädt die zum `boardId` gehörenden Spalten und Threads vor dem Rendern der Detailroute. Der `BoardDetailsProvider` verbindet diese Daten mit dem Boardtitel aus der Übersicht.
- Authentifizierung, Nutzerprofile, Boardübersicht und Boarddetail haben getrennte Zustände: `AuthContext`, `UserContext`, `BoardOverviewContext` und `BoardDetailsContext`.
- Fachseiten lesen und verändern Daten über diese Context-Hooks. Datenbankzugriffe liegen in `services/`.

## 3. Zuständigkeiten der Schichten

### Einstiegspunkt und App-Komposition

`main.tsx` enthält nur den React-Einstiegspunkt, `StrictMode`, das globale Stylesheet und das Mounten von `App`. Fachlogik oder Datenzugriffe gehören nicht hierher.

`App.tsx` ist der **Composition Root**:

- Provider in der richtigen Abhängigkeitsreihenfolge anordnen.
- Routen, Loader und Layouts registrieren.
- Authentifizierungs-Grenzen definieren.
- Keine fachlichen CRUD-Implementierungen in die App-Komponente legen.

Ein Provider, der einen anderen Context verwendet, muss unterhalb des benötigten Providers liegen. Beispielsweise verwendet `UserContextProvider` `useAuth()` und muss deshalb innerhalb von `AuthProvider` liegen. `BoardDetailsProvider` verwendet `useBoardOverview()` und muss innerhalb von `BoardOverviewProvider` liegen.

### Routen und Seiten

- Seiten unter `src/pages/<Feature>/` entsprechen in der Regel einer Route oder einem größeren Routenbereich.
- Seiten verbinden Context-Hooks, Navigation und UI-Komponenten. Sie dürfen UI-Ereignisse orchestrieren, aber enthalten keine Supabase-Abfragen.
- Ein gemeinsamer Seitenrahmen gehört in ein Layout mit `<Outlet />`.
- Routenparameter werden geprüft, bevor sie an Service-Funktionen übergeben werden.
- Route-Loader eignen sich für Daten, die zum Laden einer bestimmten Route erforderlich sind und vor dem Rendern verfügbar sein sollen.
- Ein Loader verwendet Services, nicht direkt den Supabase-Client.

### Komponenten und Dialoge

- Wiederverwendbare, möglichst fachneutrale UI-Bausteine liegen unter `components/ui/`.
- Zusammengesetzte, fachbezogene Dialoge liegen unter `components/dialogs/`.
- Eine Komponente erhält über Props nur die Daten und Callbacks, die sie wirklich benötigt.
- Vor- und Nachbedingungen eines Formulars werden im Formular oder einer zentral verwendeten Validierungsfunktion geprüft.
- Flüchtiger UI-Zustand (z. B. Dialog offen, Eingabedraft, Drag-Zustand, lokale Fehlermeldung) bleibt mit `useState` nahe an der UI, wenn ihn keine anderen Komponenten benötigen.
- Ein Formulardraft ist nicht automatisch der persistierte Datensatz. Erst nach erfolgreichem Speichern wird der gemeinsame Zustand aktualisiert.

### Services und externe Datenquellen

`src/services/` ist die Grenze zur Datenbank bzw. zu externen APIs:

- Ein Service exportiert benannte, fachlich verständliche asynchrone Funktionen wie `getBoards`, `createBoard` oder `updateProfile`.
- Services verwenden den zentralen Client aus `src/lib/`; Komponenten und Contexts erzeugen keine eigenen Datenbankclients.
- Services bauen Abfragen, prüfen Fehler und werfen diese weiter, statt Fehler in scheinbar gültige Erfolgswerte umzuwandeln.
- Services mappen Datenbankfelder und -werte in Frontend-Domänentypen.
- Services enthalten weder React-Hooks noch UI-Logik, Toasts oder Navigation.
- Abfragen wählen gezielt benötigte Felder und Beziehungen aus, statt ohne Grund ganze Tabellen oder große Datensätze zu laden.
- Bei partiellen Updates wird nur das übermittelt, was tatsächlich geändert werden soll.

Der Supabase-Client in `src/lib/supabase.ts` wird einmalig erzeugt und wiederverwendet. Fehlende Konfiguration wird ausdrücklich erkannt; sie darf nicht durch einen ungültigen Client oder einen stillen Fallback kaschiert werden.

### Typen

- Frontend-Domänentypen liegen unter `src/types/` und werden von Komponenten, Contexts und Services gemeinsam verwendet.
- Datenbankgenerierte Typen bleiben von vereinfachten UI-/Domänenmodellen unterscheidbar.
- Datenbankwerte werden an der Service-Grenze in das Frontend-Modell überführt (z. B. `first_name` zu `firstName`, Zeitstempel-String zu `Date`).
- Formulardaten und partielle Änderungen sollen eigene Typen erhalten. Zum Beispiel ist `ThreadFormData` nicht identisch zu einem gespeicherten `BoardThread`, und `ThreadChanges` erlaubt gezielte Änderungen.
- Keine `any`-Typen, wenn ein konkreter Typ, eine Union oder ein sinnvoller Guard möglich ist. Type Assertions an externen Grenzen sparsam halten und möglichst durch geprüfte Daten oder generierte Typen ersetzen.

## 4. Context- und Provider-Regeln

### Wann ein Context sinnvoll ist

Ein Context ist für fachlichen Zustand geeignet, wenn mehrere Komponenten innerhalb eines klaren Bereichs dieselben Daten oder Operationen benötigen. Beispiele aus der App:

| Context | Gehört hinein | Beispiel |
| --- | --- | --- |
| `AuthContext` | Session, Auth-Ladezustand, An-/Abmelden | Die App-Grenze und Navigation lesen die Session. |
| `UserContext` | aktuelles Profil, gemeinsam verwendete Profile, Profiloperationen | Profilseite und Zuweisungsauswahl nutzen Profildaten. |
| `BoardOverviewContext` | Liste und Operationen der Boards | Übersichtsseite und Detailbereich benötigen Boardtitel bzw. Umbenennung. |
| `BoardDetailsContext` | aktives Board, Columns/Threads und Detailoperationen | Detailseite und ihre Dialoge bearbeiten dasselbe Board. |

Keinen Context für jeden einzelnen Wert oder ausschließlich für lokale Interaktionen anlegen. Ein Context ist auch kein Sammelplatz für sämtliche Anwendungsdaten: getrennte Domänen erhalten getrennte Contexts und klare Provider-Grenzen.

### Vertragsregeln

Jeder fachliche Context sollte:

1. Einen benannten, konkreten Werttyp deklarieren, der Zustand und erlaubte Operationen beschreibt.
2. Mit `createContext<T | undefined>(undefined)` angelegt werden.
3. Einen benannten Provider exportieren, der `{ children }` entgegennimmt.
4. Einen benannten Hook wie `useBoardOverview()` exportieren.
5. Im Hook einen verständlichen Fehler werfen, wenn der Context außerhalb des Providers benutzt wird.
6. Nur die öffentliche Fach-API verfügbar machen. Komponenten sollen nicht beliebig `dispatch` aufrufen.
7. Laden, Fehler und leere Daten getrennt darstellen, wenn diese Zustände fachlich verschieden sind.

Das folgende generische Muster ist auf eine neue Domäne anzupassen:

```tsx
import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react"
import type { Project, ProjectId } from "@/types/project"
import {
  createProject as createProjectRecord,
  deleteProject as deleteProjectRecord,
} from "@/services/projectService"

type ProjectAction =
  | { type: "SET_PROJECTS"; payload: Project[] }
  | { type: "ADD_PROJECT"; payload: Project }
  | { type: "DELETE_PROJECT"; payload: { projectId: ProjectId } }

interface ProjectContextValue {
  projects: Project[]
  addProject: (name: string) => Promise<Project>
  deleteProject: (projectId: ProjectId) => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined
)

function projectReducer(
  state: Project[],
  action: ProjectAction
): Project[] {
  switch (action.type) {
    case "SET_PROJECTS":
      return action.payload
    case "ADD_PROJECT":
      return [...state, action.payload]
    case "DELETE_PROJECT":
      return state.filter(
        (project) => project.id !== action.payload.projectId
      )
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, dispatch] = useReducer(projectReducer, [])

  async function addProject(name: string) {
    const project = await createProjectRecord(name)
    dispatch({ type: "ADD_PROJECT", payload: project })
    return project
  }

  async function deleteProject(projectId: ProjectId) {
    await deleteProjectRecord(projectId)
    dispatch({ type: "DELETE_PROJECT", payload: { projectId } })
  }

  return (
    <ProjectContext.Provider value={{ projects, addProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProjects muss innerhalb des ProjectProvider laufen")
  }
  return context
}
```

### Zustand und Reducer

- `useReducer` eignet sich für zusammengehörige fachliche Zustandsübergänge, besonders bei verschachtelten Daten oder mehreren Änderungsarten.
- Actions sind als diskriminierte Union typisiert. Jede Action beschreibt eine konkrete Zustandsänderung und führt nur die dafür nötigen Daten mit.
- Reducer sind synchron und rein: keine Netzwerkaufrufe, Seiteneffekte, Mutationen oder React-Hooks im Reducer.
- Arrays und Objekte werden unveränderlich aktualisiert. Andere Felder und Einträge bleiben erhalten.
- `dispatch` bleibt intern im Provider. Der Context bietet verständliche Fachoperationen wie `addThread` statt generischer UI-Aktionen.
- Einfacher Zustand wie `isLoading` oder `loadError` kann mit `useState` gehalten werden, wenn ein Reducer dafür keinen erkennbaren Vorteil bringt.
- Zustand darf nicht redundant in mehreren Contexts oder Komponenten gehalten werden, wenn es eine eindeutige Quelle der Wahrheit geben kann.

### Asynchrone Operationen und Konsistenz

Für persistierte Änderungen gilt standardmäßig:

```text
UI-Ereignis
  → Context-Operation
    → Service / Datenbank
      → Fehler? Promise wird abgelehnt, lokaler Zustand bleibt unverändert
      → Erfolg: typisiertes Ergebnis oder Erfolg bestätigen
    → Context aktualisiert den lokalen Zustand
  → UI zeigt Erfolg oder Fehler
```

Ein Context kann das Muster so umsetzen:

```tsx
async function renameProject(projectId: ProjectId, title: string) {
  const updatedProject = await renameProjectRecord(projectId, title)
  dispatch({ type: "RENAME_PROJECT", payload: updatedProject })
}
```

Wenn der Service `Promise<void>` zurückgibt, kann nach dem erfolgreichen `await` eine passende lokale Action ausgeführt werden. Bei Fehlern darf die lokale UI nicht so aussehen, als wäre die Änderung erfolgreich gespeichert worden. Fehler werden entweder im Context erfasst und als `error`-Zustand angeboten oder an die aufrufende UI weitergeworfen; die Wahl muss pro Operation klar sein.

Optimistische Updates sind nur sinnvoll, wenn die UX sie erfordert und ein Rollback oder eine erneute Synchronisierung definiert ist. Sie sind nicht der Standard.

### Laden und Lebenszyklus

- Ladezustände sollen den tatsächlichen Zustand ausdrücken. Unbekannt, leer, läd und fehlgeschlagen sind nicht dasselbe.
- Ein `refresh...`-Callback erhält `useCallback`, wenn er als Effect-Abhängigkeit dient oder über Context geteilt wird und dadurch sonst unnötige erneute Effects auslösen könnte.
- Effects deklarieren alle verwendeten Abhängigkeiten vollständig.
- Asynchrone Effects behandeln verspätete Ergebnisse bei unmount oder Identitätswechsel. Ergebnisdaten sollen an die User-/Entity-ID gebunden sein, für die sie geladen wurden.
- Keine nicht behandelten Promises in Effects: entweder `await` in einer inneren Funktion mit Fehlerbehandlung oder bewusst `void` nur für eine Operation, deren Fehler intern zuverlässig behandelt wird.
- Context-Zustand wird nicht unnötig beim Rendern aus einem anderen Context kopiert. Falls zwei Datenquellen zusammengesetzt werden, muss die Synchronisationsregel ausdrücklich sein, wie im Detailbereich: Route-Loader liefert Columns, die Boardübersicht liefert Titel und ID.
- Wenn viele unabhängige UI-Teile durch häufig wechselnde Context-Werte unnötig rendern, den Context aufteilen oder `value` stabilisieren. Nicht vorsorglich memoizieren, ohne ein konkretes Problem.

### Provider-Komposition und Scope

- Provider werden so nah wie möglich an den Bereich gesetzt, der sie benötigt, aber hoch genug, damit alle Verbraucher denselben Zustand teilen.
- Globale technische Provider (Theme, Tooltip) umschließen die App.
- Authentifizierte Fachprovider werden nur für angemeldete Nutzer gemountet.
- Route- oder entity-spezifische Provider sitzen an der entsprechenden Route, nicht global, wenn ihr Zustand nur dort gebraucht wird.
- Abhängigkeiten bestimmen die Reihenfolge: Provider A steht außen, wenn Provider B den Hook von A aufruft.
- Keine versteckte Provider-Erwartung: Ein fehlender Provider soll früh und mit Kontextfehler auffallen, statt einen leeren Dummy-Zustand zurückzugeben.

## 5. Datenfluss an einem konkreten Beispiel

Beim Hinzufügen eines Threads in einem Board:

1. `BoardDetail` erhält `addThread` über `useBoardDetails()`.
2. Das Formular/Dialog validiert Benutzereingaben und ruft den Callback auf.
3. `BoardDetailsProvider.addThread` prüft fachliche Vorbedingungen (aktives Board vorhanden).
4. Der Provider ruft `createThread` in `boardService.ts` auf.
5. Der Service schreibt die Daten in Supabase, prüft den Fehler und bildet die Antwort in `BoardThread` um (z. B. Datum-String zu `Date`).
6. Erst nach erfolgreicher Antwort dispatcht der Provider `ADD_THREAD`.
7. Der Reducer ergänzt den Thread unveränderlich in der richtigen Column.
8. Der Context-Verbraucher rendert den aktualisierten Zustand.

Die UI kennt dabei weder Tabellennamen noch Supabase-Abfragesyntax. Der Service kennt keine Dialoge und der Reducer kennt kein Netzwerk.

## 6. Fehlerbehandlung und UI-Zustände

- Datenzugriffsfehler werden im Service nicht verschluckt. Supabase-Fehler werden geworfen oder gezielt in einen dokumentierten, typisierten Ergebniswert übersetzt.
- Der Context kann einen Fehler für gemeinsames Laden in `loadError` halten oder eine Mutation ablehnen lassen. Keine Operation darf gleichzeitig wie ein Erfolg aussehen und den Fehler verstecken.
- Seiten/Formulare fangen Fehler an einer UI-Grenze ab, zeigen eine verständliche Meldung und blockieren während der Speicherung gegebenenfalls doppelte Anfragen.
- Technische Details dürfen geloggt werden, aber die Nutzeroberfläche zeigt eine verständliche Nachricht.
- `finally` setzt Status wie `isLoading` oder `isSaving` zuverlässig zurück.
- Fehlende Daten, leere Listen, Ladezustände und Fehlerzustände werden explizit gerendert.
- Nicht pauschal `catch` verwenden, um einen leeren Array- oder Null-Erfolg zu erzeugen. Ein Fallback ist nur korrekt, wenn „nicht vorhanden“ fachlich ein valider Zustand ist.

## 7. Benennung und Importkonventionen

- Context-Dateien nach Fachbereich benennen: `<Domain>Context.tsx`.
- Provider-Komponenten benennen: `<Domain>Provider` oder gemäß dem bestehenden konkreten Namen (`UserContextProvider`).
- Consumer-Hooks mit `use` benennen: `useAuth`, `useUserContext`, `useBoardDetails`.
- Service-Funktionen mit fachlichen Verben benennen: `get`, `create`, `update`/`rename`, `remove`/`delete`.
- Action-Namen in Reducern als klare Konstanten schreiben, z. B. `ADD_THREAD`, `SET_BOARDS`.
- Frontend-Felder in camelCase, Datenbankfelder entsprechend dem Schema. Mapping geschieht zentral im Service.
- Vor einer neuen Hilfsfunktion oder Abstraktion zuerst prüfen, ob im Projekt bereits ein entsprechendes Muster existiert.
- Den vorhandenen Importstil (Alias `@/` für `src`, relative Imports innerhalb eng verwandter Dateien) beibehalten.

## 8. Neue Funktion in einem anderen Thema ergänzen

Beim Start eines neuen Projekts dieses Regelwerk als Architekturvorgabe verwenden und fachliche Begriffe konsequent austauschen:

1. **Domänenmodell festlegen:** Welche Hauptentitäten, IDs, Beziehungen und Formulardaten gibt es?
2. **Datenquelle definieren:** Welcher Service liest und schreibt jede Entität? Welche Datenbankfelder müssen in Frontend-Typen gemappt werden?
3. **Zuständigkeit zuordnen:** Ist ein Wert nur lokaler UI-Zustand, route-spezifische Loader-Daten oder geteilter fachlicher Zustand?
4. **Context-Grenzen ziehen:** Pro klar umrissener geteilter Domäne ein Context-Vertrag, Provider und Guard-Hook. Abhängige Provider korrekt schachteln.
5. **Route und UI bauen:** Route-/Loader-Konfiguration in der App, Seiten unter `pages/`, zusammengesetzte UI unter `components/`.
6. **Datenfluss vervollständigen:** UI → Context-Operation → Service → gemapptes Ergebnis → lokaler Reducer-/State-Übergang.
7. **Zustände und Fehler vervollständigen:** Loading, leer, Error, Validierung, Speichern und Erfolg sichtbar behandeln.
8. **Überprüfen:** Typen, Build/Typecheck und Lint ausführen; relevante bestehende Muster und Routen testen.

### Übertragbares Beispiel: Context für eine neue Domäne

Angenommen, ein neues Programm verwaltet Rezepte statt Boards. Begriffe werden ersetzt, die Verantwortungsgrenzen bleiben:

```text
RecipeOverviewProvider
  ├─ recipes: Recipe[]
  ├─ refreshRecipes()
  ├─ createRecipe(input): Promise<Recipe>
  ├─ renameRecipe(id, title): Promise<void>
  └─ deleteRecipe(id): Promise<void>

RecipeDetailProvider (nur an Route recipe/:recipeId)
  ├─ activeRecipe: Recipe | null
  ├─ addIngredient(recipeId, ingredient): Promise<Ingredient>
  ├─ updateIngredient(id, changes): Promise<void>
  └─ removeIngredient(id): Promise<void>
```

`RecipeDetailProvider` sollte nur dann auf `RecipeOverviewProvider` zugreifen, wenn die Detailansicht tatsächlich gemeinsame Übersichtsmetadaten braucht. Andernfalls ist es sauberer, alle nötigen Detaildaten über den Route-Loader zu laden. Keine Provider-Abhängigkeit nur zur Bequemlichkeit einführen.

Beispielhafte Service-Grenze:

```ts
// recipeService.ts: keine React- oder UI-Abhängigkeit
export async function createRecipe(input: RecipeFormData): Promise<Recipe> {
  const { data, error } = await getSupabaseClient()
    .from("Recipe")
    .insert({ title: input.title.trim() })
    .select("id, title")
    .single()

  if (error) throw error

  return {
    id: data.id,
    title: data.title,
    ingredients: [],
  }
}
```

Die konkrete Abfrage und die Typen müssen natürlich zum tatsächlichen Schema der neuen App passen. Das Beispiel soll die Schichtengrenze zeigen, nicht eine bestimmte Datenbankstruktur vorschreiben.

## 9. Qualitätscheck vor Abschluss einer Änderung

- [ ] UI-Komponenten enthalten keine direkten Datenbankabfragen.
- [ ] Neue fachliche Services sind typisiert, prüfen Fehler und mappen externe Daten an einer klaren Stelle.
- [ ] Geteilter Zustand hat genau einen zuständigen Context; rein lokaler UI-Zustand bleibt lokal.
- [ ] Context-Hook wirft außerhalb seines Providers einen hilfreichen Fehler.
- [ ] Provider sind korrekt geschachtelt und nur im notwendigen Scope eingebunden.
- [ ] Reducer-Änderungen sind unveränderlich, synchron und vollständig typisiert.
- [ ] Persistierte Mutationen aktualisieren lokalen Zustand erst nach bestätigtem Erfolg (außer bei ausdrücklich implementierter optimistischer Strategie).
- [ ] Lade-, Fehler-, Leer- und Erfolgszustände sind berücksichtigt.
- [ ] Async-Effects sind gegen verspätete Ergebnisse und Identitätswechsel abgesichert.
- [ ] Bestehende Routen, Nutzerfluss und relevante UI-Verhalten bleiben erhalten.
- [ ] Projektprüfungen sind ausgeführt. Für dieses Repository: `npm run typecheck`, `npm run lint` und bei Bedarf `npm run build`.

## 10. Kostenteiler-spezifische Architekturregeln

- **Bon und Positionen:** Bonbilder werden über einen Service in Supabase Storage abgelegt und über den Positionsparent referenziert. Datenbankzugriffe und Storage-Operationen bleiben außerhalb von UI-Komponenten. Fehler beim Upload oder beim Speichern der Zuordnung müssen sichtbar behandelt werden; es darf kein erfolgreicher Upload ohne erkennbare Zuordnung zum Parent vorgetäuscht werden.
- **Bon-Erkennung:** Eine Edge Function oder ein angebundener Erkennungsdienst liefert typisierte Erkennungsvorschläge. Die App vergleicht die Summe der erkannten Positionen mit der Parent-Gesamtsumme und zeigt Abweichungen zur Prüfung und Korrektur an. Eine Unterpositionssumme unterhalb des Parent-Betrags kann nach ausdrücklicher Bestätigung übernommen werden; der Rest wird nach dem Parent-Aufteilungsschlüssel verteilt. Liegt die Unterpositionssumme über dem Parent-Betrag, fragt die App, ob die Parent-Summe erhöht werden soll. Bleibt die Abweichung bestehen, muss der Kassensturz blockiert werden, bis sie durch Korrektur der Positionen oder der Parent-Summe behoben ist. Beim Modus „Nur Summe einlesen“ werden keine Positionen erkannt oder summiert.
- **Aufteilungsvalidierung:** Prozentanteile müssen zusammen genau 100 % ergeben. Feste Beträge dürfen den Positionsbetrag nicht überschreiten; nicht zugewiesene Beträge werden über den Parent- oder Gruppenstandard verteilt.
- **Parent-Abrechnung, Zahler und Verteilungsschlüssel:** Ein Bon/Positionsparent ist ein Summen-Container und darf nicht zusätzlich zu seinen Unterpositionen als Kostenposition zählen. Der Parent-eigene Aufteilungsschlüssel und Parent-Zahler werden ausschließlich auf den Restbetrag angewandt, der nach Abzug der Unterpositionen übrig bleibt. Unterpositionen verwenden jeweils ihren eigenen Zahler. Einzelpositionen ohne Parent verwenden den Gruppenstandard-Aufteilungsschlüssel; bei neu erstellten Gruppen ist dieser standardmäßig eine gleichmäßige Aufteilung auf alle Mitglieder.
- **Listenansicht und Suche:** Positionen ohne Parent werden in der aufklappbaren UI-Gruppe „Sonstiges“ dargestellt. Suche und Betragsfilter müssen Positionen über Services/typisierte Fachzustände auffindbar machen; Treffer von Unterpositionen enthalten den Parent-Bezug, damit die Bon-Herkunft sichtbar bleibt.
- **Ausgleichsberechnung:** Die Ermittlung von Nettosalden und konsolidierten Erstattungszahlungen gehört in eine UI-unabhängige, testbare Fachfunktion. Sie erhält geleistete Zahlungen und die über `item_split` ermittelten Kostenanteile, liefert nachvollziehbare Nettosalden und möglichst wenige Zahlungsvorschläge zurück. Der Status einer vorgeschlagenen oder geleisteten Zahlung bleibt von der Berechnung selbst getrennt und darf nur von der empfangenden Person oder einem Gruppen-Admin bestätigt werden.
- **Wiederkehrende Listen:** Eine neu erzeugte Periode übernimmt Positionen, Beträge und Aufteilungsschlüssel der letzten Periode als bearbeitbare Ausgangswerte. Der automatische Abschluss einer Periode berechnet Zahlungsvorschläge, setzt aber keine tatsächlichen Erstattungen als bezahlt. Die Zahlungsbestätigung bleibt ein separater, berechtigungsgeprüfter Vorgang.
- **Berechtigungen:** UI-Steuerelemente werden passend zur Gruppenrolle und den konfigurierten Rechten angezeigt. Admins können Anlegen, Bearbeiten, Löschen, Aufteilungsänderungen und Kassensturz für normale Mitglieder separat freigeben; nicht freigegebene Aktionen bleiben Admins vorbehalten. Die tatsächliche Durchsetzung erfolgt zusätzlich server- bzw. datenbankseitig, insbesondere durch Supabase RLS und geprüfte Rollen-/Rechtebedingungen; ausgeblendete UI-Elemente allein sind keine Zugriffskontrolle.
