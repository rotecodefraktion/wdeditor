# PROJ-7: GitHub Repository Integration

## Status: Planned
**Created:** 2026-02-20
**Last Updated:** 2026-02-20

## Dependencies
- Requires: PROJ-4 (Global Settings) – Repository-URL, PAT, Branch und Dateipfade müssen konfiguriert sein

## Overview

Dieses Feature stellt alle GitHub-Operationen als interne Service-Schicht bereit. Die Editoren (PROJ-5, PROJ-6) nutzen diese Schicht um Dateien zu lesen und Commits zu erstellen. Alle GitHub-API-Aufrufe laufen **serverseitig** (API Route / Edge Function) – der Browser erhält niemals das PAT.

## User Stories

- Als Editor (PROJ-5/6) möchte ich den aktuellen Dateiinhalt aus dem GitHub-Repository laden, damit der User die aktuelle Version bearbeitet.
- Als Editor möchte ich den aktuellen SHA der Datei kennen, damit ich Konflikte erkennen kann bevor ich committe.
- Als Admin möchte ich meine Änderungen mit einer Commit-Message in den Dev-Branch committen, damit die Änderungen versioniert sind.
- Als Admin möchte ich vor dem Commit sehen ob die Datei auf GitHub seit meinem Laden geändert wurde, damit ich keinen fremden Commit überschreibe.
- Als Admin möchte ich einen Diff meiner Änderungen sehen (vorher vs. nachher), damit ich meine Änderungen überprüfen kann.
- Als Admin möchte ich dass mein GitHub-Username in der Commit-Attribution erscheint, damit Änderungen eindeutig zugeordnet werden können.

## Acceptance Criteria

### Datei lesen
- [ ] API-Route `GET /api/github/file?type=instance_profile|rules` liest Dateiinhalt via GitHub Contents API
- [ ] Rückgabe: Dateiinhalt (dekodiert von Base64), aktueller SHA, letzter Commit-Hash, letzter Commit-Zeitstempel, letzter Commit-Author
- [ ] Nur für eingeloggte, aktive User (Auth-Check in API-Route)
- [ ] Fehlerbehandlung: Repository nicht erreichbar, Datei existiert nicht, PAT ungültig → sprechende Fehlermeldungen

### Konflikt-Erkennung
- [ ] Vor jedem Commit wird der aktuelle SHA der Datei auf GitHub abgefragt
- [ ] Wenn der SHA nicht mehr dem SHA beim Laden entspricht: Konflikts-Warnung "Die Datei wurde von [Author, Zeit] geändert seit du sie geöffnet hast"
- [ ] User kann Konflikt bestätigen und dennoch committen (Überschreiben) oder abbrechen
- [ ] Bei Überschreiben: Im Commit-Message-Hinweis dass Remote-Änderung überschrieben wurde

### Datei committen
- [ ] API-Route `POST /api/github/commit` nimmt entgegen: neuen Dateiinhalt, Commit-Message, file_type, aktueller SHA
- [ ] Commit geht **ausschließlich** in den konfigurierten Dev-Branch (Branch-Name aus Settings)
- [ ] Commit-Author wird gesetzt auf: App-Name + App-E-Mail (konfigurierbar); Committer wird der PAT-Owner
- [ ] Commit-Message enthält automatisch: User-E-Mail und GitHub-Username als Co-Author oder Trailer
  - Beispiel: `feat: Update icm/server_port config\n\nChanged by: admin@company.com (github: username)`
- [ ] Erfolgreiche Antwort enthält: neuer Commit-SHA, Commit-URL auf GitHub, neuer Datei-SHA
- [ ] Commits nie auf main/master Branch möglich (serverseitige Prüfung gegen konfiguriertem Branch)

### Diff-Ansicht
- [ ] Client-seitige Diff-Berechnung (Original-Inhalt beim Laden vs. aktueller Inhalt)
- [ ] Diff-Anzeige als unified diff (hinzugefügte Zeilen grün, gelöschte Zeilen rot)
- [ ] Diff wird im Commit-Modal angezeigt vor dem eigentlichen Commit

### User-GitHub-Validierung
- [ ] Bei Login/Session-Start wird geprüft ob der hinterlegte GitHub-Username des Users Lesezugriff auf das Repository hat
- [ ] Prüfung via GitHub API: `GET /repos/{owner}/{repo}/collaborators/{username}` oder Membership-Check
- [ ] Wenn kein Zugriff: Warnung im Dashboard "Dein GitHub-Account hat keinen Zugriff auf das Repository – bitte den Admin kontaktieren"
- [ ] Prüfung ist nicht-blockierend (User kann App trotzdem öffnen, aber bei GitHub-Operationen klare Fehlermeldung)

## Edge Cases

- **GitHub API Rate Limit erreicht:** Fehlermeldung mit verbleibender Wartezeit; kein Retry-Loop
- **PAT hat nur `read`-Rechte:** Lesen funktioniert, Commit schlägt fehl mit Fehlermeldung "Unzureichende Berechtigungen"
- **Dev-Branch wurde gelöscht zwischen Konfiguration und Commit-Versuch:** Fehlermeldung "Branch existiert nicht"; Admin muss Settings aktualisieren
- **Netzwerktimeout bei GitHub API:** Timeout nach 10 Sekunden; Fehlermeldung mit Retry-Option
- **Datei wurde auf GitHub gelöscht seit dem Laden:** Konflikts-Fehler; Option zum Neu-Anlegen
- **Commit-SHA-Mismatch:** Wenn zwischen Konflikt-Check und Commit die Datei nochmals geändert wird → GitHub API gibt 409; Fehlermeldung und erneuter Check
- **PAT-Owner hat keinen Push-Zugriff auf Dev-Branch (Branch-Protection-Rules):** GitHub API gibt 403; klare Fehlermeldung
- **Repository ist ein Fork:** Unterstützt (keine Einschränkung auf ursprüngliche Repos)

## Technical Requirements

- GitHub API Version: `api.github.com` v3 (REST), Content-Type: `application/vnd.github+json`
- Auth: PAT via `Authorization: Bearer <token>` Header (serverseitig, nie im Browser)
- Endpunkte:
  - Lesen: `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`
  - Committen: `PUT /repos/{owner}/{repo}/contents/{path}` mit SHA für Updates
  - Branch-Check: `GET /repos/{owner}/{repo}/branches/{branch}`
  - User-Zugriff: `GET /repos/{owner}/{repo}/collaborators/{username}` oder Topics-Check
- Serverseitige Implementierung: Next.js API Routes (nicht Edge Functions wegen PAT-Sicherheit)
- PAT-Entschlüsselung erfolgt nur serverseitig beim Lesen aus `app_settings`
- Timeout: 10 Sekunden pro GitHub-API-Aufruf

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
