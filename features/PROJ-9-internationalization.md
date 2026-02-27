# PROJ-9: Internationalization (i18n) — DE / EN / PT

## Status: Planned
**Created:** 2026-02-27
**Last Updated:** 2026-02-27

## Dependencies
- Requires: PROJ-2 (User Authentication) — User-Profil für gespeicherte Sprachpräferenz
- Requires: PROJ-3 (Admin User Management) — Admin-Seiten müssen ebenfalls übersetzt werden

## Overview

Die App unterstützt drei Sprachen: Deutsch (Standard), Englisch und Portugiesisch (Brasilien). Alle UI-Texte — inklusive Buttons, Labels, Fehlermeldungen, Toasts, Tooltips und komplette Seiten — sind übersetzt. Jeder eingeloggte User kann seine bevorzugte Sprache im eigenen Account speichern. Zusätzlich gibt es einen Sprachumschalter in der Topbar, der die Sprache sofort wechselt.

## Sprachen

| Code | Sprache | Bezeichnung |
|------|---------|-------------|
| `de` | Deutsch | Standard (Fallback) |
| `en` | Englisch | Englisch |
| `pt` | Portugiesisch (Brasilien) | Português |

## User Stories

- Als eingeloggter User möchte ich die Sprache in der Topbar per Klick wechseln, damit ich die App in meiner bevorzugten Sprache bediene.
- Als User möchte ich meine Standard-Sprache in meinem Account-Profil speichern, damit sie bei jedem Login automatisch aktiv ist.
- Als neuer Benutzer wird mir die App auf Deutsch angezeigt, bis ich die Sprache selbst umstelle.
- Als nicht-eingeloggter Besucher (Login-/Registrierungsseite) sehe ich die zuletzt gewählte Sprache (Browser-Cookie).
- Als Admin möchte ich die vollständige Admin-UI (Benutzerverwaltung, Einstellungen) in meiner gewählten Sprache bedienen.
- Als User sehe ich alle Fehlermeldungen, Toast-Benachrichtigungen und Validierungsfehler in meiner gewählten Sprache.

## Acceptance Criteria

### Sprachumschalter (Topbar)
- [ ] In der Topbar ist ein Sprachumschalter sichtbar (z.B. Dropdown oder Flag-Buttons mit Sprachcode: DE / EN / PT)
- [ ] Der Wechsel ist ohne Seitenreload sofort wirksam
- [ ] Die gewählte Sprache wird im Browser persistent gespeichert (Cookie oder localStorage), damit nicht-eingeloggte User die Auswahl behalten
- [ ] Der Umschalter zeigt die aktuell aktive Sprache an
- [ ] Der Umschalter ist auf allen Seiten (App, Auth, Admin) sichtbar

### Sprachpräferenz im User-Profil
- [ ] Im Account-Bereich des Users (Dropdown in der Topbar oder Profilseite) gibt es eine Einstellung "Standardsprache"
- [ ] Die Auswahl ist DE / EN / PT
- [ ] Nach dem Speichern wird die neue Sprache sofort aktiv
- [ ] Nach dem Logout und erneutem Login wird die gespeicherte Sprache automatisch geladen und angewendet
- [ ] Neue User bekommen Deutsch als Standard

### Übersetzungsumfang — Alle Seiten
- [ ] Login-Seite (Formular, Fehlermeldungen, Link "Passwort vergessen")
- [ ] Registrierungsseite (Formular, Validierungsfehler, Bestätigungstext)
- [ ] Passwort-Reset-Seiten
- [ ] Dashboard
- [ ] Port-Editor (Labels, Buttons, Dialoge, Fehlermeldungen, Lock-Banner)
- [ ] Rules-Editor (Labels, Buttons, Dialoge, Fehlermeldungen, Lock-Banner)
- [ ] Admin-Benutzerübersicht
- [ ] Einstellungsseite (GitHub-Konfiguration)
- [ ] Alle Modals und Dialoge (Commit-Modal, Delete-Dialog, Diff-Viewer)
- [ ] Alle Toast-Meldungen (Erfolg, Fehler, Warnung)
- [ ] Alle Validierungsfehler (Zod-Formular-Fehler)

### Fallback-Verhalten
- [ ] Fehlt eine Übersetzung für einen Schlüssel, wird der deutsche Text angezeigt (DE ist Fallback)
- [ ] Unbekannte Locale-Werte im Cookie/Profil fallen auf DE zurück

## Edge Cases

- **User wechselt Sprache mitten in einem offenen Modal/Dialog:** Modal bleibt offen, Texte wechseln sofort ohne Datenverlust im Formular
- **User hat Profil-Sprache PT gesetzt, besucht die App in einem anderen Browser ohne Cookie:** Sprache DE bis zum Login, danach automatisch PT aus dem Profil
- **Nicht-eingeloggter User setzt Sprache auf EN:** Die Auswahl wird im Cookie gespeichert. Nach dem Login wird die Profil-Sprache geladen (Profil-Einstellung hat Vorrang vor Cookie)
- **Admin legt neuen User an:** Neuer User erhält Sprache DE als Standard
- **Langer Text in PT/EN sprengt Button-Layout:** UI muss responsive bleiben — kurze, kontextgerechte Übersetzungen verwenden
- **Portugiesische Sonderzeichen (ã, ç, ê):** UTF-8 durchgängig, keine Encoding-Probleme

## Technical Requirements

- Übersetzungsdateien als JSON (ein File pro Sprache: `de.json`, `en.json`, `pt.json`)
- Neue Datenbankspalte `locale TEXT DEFAULT 'de'` in `user_profiles`
- Server Components und Client Components müssen beide übersetzt werden können
- Keine statischen Texte im Code — alle User-sichtbaren Strings über i18n-Keys
- Kein separates i18n-Routing (keine `/de/`, `/en/` URL-Präfixe) — Sprache per Provider/Context

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
