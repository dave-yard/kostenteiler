# Kostenteiler

Mobile-first React-Anwendung zum Verwalten gemeinsamer Gruppen und Ausgaben.
Die funktionalen Anforderungen stehen in
[APP_REQUIREMENT.md](./APP_REQUIREMENT.md), die Architekturregeln in
[ARCHITEKTUR.md](./ARCHITEKTUR.md) und die visuellen Vorgaben in
[DESIGN.md](./DESIGN.md).

## Lokal starten

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. `.env` mit Supabase-Projekt-URL und Publishable Key befüllen:

   ```env
   VITE_SUPABASE_URL=https://<projekt-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Der ältere `anon`-Key kann an derselben Stelle als Publishable Key verwendet
   werden. **Niemals** den `service_role`-Key oder einen Secret Key mit
   `VITE_`-Präfix im Frontend hinterlegen.

3. Die SQL-Migration
   [`supabase/migrations/20261023140000_groups_and_members.sql`](./supabase/migrations/20261023140000_groups_and_members.sql)
   im Supabase Dashboard im **SQL Editor** ausführen. Sie legt Gruppen,
   Mitgliedschaften, Rechte, RPC-Funktionen und Row-Level-Security-Policies
   für diesen Funktionsumfang an.

4. Unter **Authentication → URL Configuration** `http://localhost:5173` als
   **Site URL** und lokale Redirect-URL erlauben. E-Mail-Bestätigung muss
   aktiviert sein; Bestätigungs- und Recovery-Links verwenden diese URL. Bei
   einem anderen lokalen Port müssen Site URL und Redirect-URL übereinstimmen.

5. Für die persönliche Gruppensortierung zusätzlich die Migration
   [`supabase/migrations/20261023144500_personal_group_sort_order.sql`](./supabase/migrations/20261023144500_personal_group_sort_order.sql)
   im Supabase SQL Editor ausführen, nachdem die Gruppen-Migration angewendet
   wurde.

6. Für die persönliche Freundesliste und das Hinzufügen von Kontakten zu
   Gruppen zusätzlich die Migration
   [`supabase/migrations/20261023151000_personal_contacts.sql`](./supabase/migrations/20261023151000_personal_contacts.sql)
   im Supabase SQL Editor ausführen.

7. Für zeitlich begrenzte Gruppeneinladungen und die bestätigte Verknüpfung mit
   registrierten Konten danach
   [`supabase/migrations/20261023160000_group_member_invitations.sql`](./supabase/migrations/20261023160000_group_member_invitations.sql)
   ausführen. Der Einladungslink wird in der App erzeugt und muss manuell
   geteilt werden; ein E-Mail-Versand ist nicht konfiguriert.

8. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

## Prüfungen

```bash
npm run typecheck
npm run lint
npm run build
```
