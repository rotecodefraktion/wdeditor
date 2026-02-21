# PROJ-4: Global Settings Configuration

## Status: Planned
**Created:** 2026-02-20
**Last Updated:** 2026-02-20

## Dependencies
- Requires: PROJ-2 (User Authentication) – Settings nur für eingeloggte Admins
- Requires: PROJ-3 (Admin User Management) – Nur Admins dürfen Settings ändern

## User Stories

- Als Admin möchte ich das GitHub-Repository konfigurieren, damit die App weiß welche Repo sie lesen und beschreiben soll.
- Als Admin möchte ich einen GitHub Personal Access Token (PAT) hinterlegen, damit die App im Namen der App auf GitHub zugreifen kann.
- Als Admin möchte ich den Namen des Dev-Branches konfigurieren, damit Commits nur in den richtigen Branch gehen.
- Als Admin möchte ich den Pfad zur Instanzprofil-Datei im Repository konfigurieren, damit der Port-Editor die richtige Datei lädt.
- Als Admin möchte ich den Pfad zur rules.txt-Datei im Repository konfigurieren, damit der Rule-Editor die richtige Datei lädt.
- Als Admin möchte ich die GitHub-Verbindung testen können, damit ich sicherstellen kann dass die Konfiguration korrekt ist.
- Als Admin möchte ich sehen ob der konfigurierte Dev-Branch existiert, damit ich weiß ob Commits möglich sind.

## Acceptance Criteria

- [ ] Settings-Seite ist nur für Admins und Super-Admins erreichbar (sonst 403/Redirect)
- [ ] Formular enthält folgende Felder:
  - GitHub Repository URL (Format: `https://github.com/owner/repo` oder `owner/repo`)
  - GitHub Personal Access Token (PAT) – Pflichtfeld, gespeichert verschlüsselt
  - Dev-Branch-Name (Default: `dev`)
  - Pfad zur Instanzprofil-Datei im Repo (z.B. `config/instance_profile`)
  - Pfad zur rules.txt-Datei im Repo (z.B. `config/rules.txt`)
- [ ] PAT wird im UI maskiert angezeigt (nur letzte 4 Zeichen sichtbar); vollständiger Token nie im Frontend gerendert
- [ ] "Verbindung testen"-Button prüft:
  - GitHub API erreichbar
  - PAT gültig und hat Zugriff auf das Repository (mind. `contents: read` und `contents: write`)
  - Konfigurierter Dev-Branch existiert
  - Konfigurierte Dateipfade existieren im Repository
- [ ] Test-Ergebnis zeigt detaillierten Status jeder Prüfung (Checkmark / Warnung / Fehler)
- [ ] Settings werden global gespeichert (alle User nutzen dieselbe Konfiguration)
- [ ] Beim Speichern: Validierung aller Felder (nicht leer, URL-Format korrekt)
- [ ] Erfolgs-Toast nach erfolgreichem Speichern
- [ ] Wenn Settings noch nicht konfiguriert sind: Alle Nicht-Admin-User sehen Hinweismeldung "Die App ist noch nicht konfiguriert"
- [ ] Änderung der Settings während eine Datei gesperrt ist: Warnung "Eine Datei ist gerade in Bearbeitung – Änderungen können zu Problemen führen"

## Edge Cases

- **PAT hat unzureichende Berechtigungen:** Test schlägt fehl mit Hinweis auf benötigte Scopes (`repo` oder `contents: write`)
- **Dev-Branch existiert nicht:** Test-Warnung "Branch existiert nicht – Commits werden fehlschlagen"; Option zum Erstellen des Branches
- **Dateipfade existieren nicht im Repo:** Test-Warnung (kein Fehler – Datei könnte noch angelegt werden)
- **Settings werden während Datei-Bearbeitung geändert (andere Datei-Pfade):** Offene Locks werden nach 60 Sekunden automatisch freigegeben
- **PAT läuft ab:** GitHub-Operationen schlagen fehl mit sprechender Fehlermeldung "GitHub-Token abgelaufen – bitte Settings aktualisieren"
- **Repository wird auf privat gestellt nach Konfiguration:** GitHub-API-Fehler wird als "Kein Zugriff auf Repository" angezeigt
- **Settings noch nicht konfiguriert, Nicht-Admin versucht Editor zu öffnen:** Redirect zur Startseite mit Hinweis

## Technical Requirements

- PAT wird verschlüsselt in Supabase gespeichert (nicht im Klartext)
- Settings-Tabelle: Einzel-Zeilen-Tabelle `app_settings` mit RLS (nur Admins können lesen/schreiben)
- GitHub-Verbindungstest: Via Supabase Edge Function (PAT verlässt nie den Server zum Client)
- Alle GitHub-API-Aufrufe laufen serverseitig (Edge Function / API Route), nie direkt vom Browser
- Browser: Nur verschlüsselter/maskierter PAT-Indikator; echte Token-Werte nur serverseitig

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
