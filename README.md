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

3. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

## Prüfungen

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
