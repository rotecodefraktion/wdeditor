# PROJ-9: Internationalization (i18n) — DE / EN / PT

## Status: In Progress
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

### Overview

i18n wird über die Bibliothek **next-intl** umgesetzt — die empfohlene Lösung für Next.js App Router, die sowohl Server Components als auch Client Components unterstützt. Sprache wird **ohne URL-Präfixe** gesteuert: ein Cookie (`NEXT_LOCALE`) trägt die Locale-Information, die Middleware liest sie serverseitig aus. Eingeloggte User erhalten ihre gespeicherte Sprachpräferenz aus dem User-Profil in der Datenbank, die beim Login automatisch in den Cookie synchronisiert wird.

---

### Component Structure (Visual Tree)

```
Layouts (beide Layouts erhalten den LanguageSwitcher)
├── (app)/layout.tsx  ← Server Component
│   └── Header
│       ├── Navigation
│       ├── ThemeToggle  (bereits vorhanden)
│       ├── LanguageSwitcher  ← NEU (Client Component)
│       └── SignOutButton
├── (auth)/layout.tsx  ← Server Component
│   └── Header
│       ├── ThemeToggle  (bereits vorhanden)
│       └── LanguageSwitcher  ← NEU (Client Component)
│
Provider-Schicht (Root Layout)
└── NextIntlClientProvider  ← NEU (umschließt alle Client Components)
    └── übergibt geladene Übersetzungen an den Client
│
Neue Komponente
└── src/components/language-switcher.tsx
    ├── Dropdown-Button mit aktiver Sprache (DE / EN / PT)
    ├── Klick → setzt Cookie NEXT_LOCALE
    ├── Klick (eingeloggt) → ruft PATCH /api/user/locale auf
    └── Sofort-Reload der Seite (hard reload), um neue Texte anzuzeigen
│
Übersetzungsdateien
├── messages/de.json  ← Deutsch (Fallback / Standard)
├── messages/en.json  ← Englisch
└── messages/pt.json  ← Portugiesisch (Brasilien)
│
Konfiguration
├── i18n/request.ts   ← Server-seitige Locale-Auflösung (liest Cookie)
├── middleware.ts     ← Aktualisiert/setzt NEXT_LOCALE-Cookie pro Request
└── next.config.ts   ← next-intl Plugin eingebunden
```

---

### Locale-Auflösungs-Logik (Prioritäten)

```
Eingeloggter User:
  1. user_profiles.locale aus der Datenbank (höchste Priorität)
  2. Cookie NEXT_LOCALE (Fallback, solange Profil noch nicht geladen)
  3. 'de' (Default)

Nicht-eingeloggter Besucher:
  1. Cookie NEXT_LOCALE
  2. 'de' (Default)

Beim Login:
  → Profil-Sprache wird aus DB gelesen und Cookie wird synchronisiert
```

---

### Data Model

**Neue DB-Spalte (bereits im Spec erwähnt):**

```
Tabelle: user_profiles
Neue Spalte: locale  TEXT  NOT NULL  DEFAULT 'de'
Erlaubte Werte: 'de', 'en', 'pt'
```

**Cookie:**
- Name: `NEXT_LOCALE`
- Werte: `'de'`, `'en'`, `'pt'`
- Lebensdauer: 1 Jahr
- Zugänglichkeit: `HttpOnly: false` (muss vom Client-seitigen LanguageSwitcher gesetzt werden können)

---

### New API Endpoint

```
PATCH /api/user/locale
  → Empfängt: { locale: 'de' | 'en' | 'pt' }
  → Prüft: Auth-Session vorhanden
  → Schreibt: user_profiles.locale für den eingeloggten User
  → Antwortet: 200 OK oder Fehlermeldung
```

---

### Tech Decisions (Begründung)

| Entscheidung | Gewählt | Warum |
|---|---|---|
| i18n-Bibliothek | **next-intl** | Erste Wahl für Next.js App Router; unterstützt Server Components nativ; keine URL-Präfixe erforderlich |
| Locale-Speicherung (Client) | **Cookie** (nicht localStorage) | Serverseitig lesbar → Server Components können sofort die richtige Sprache rendern |
| Locale-Speicherung (User) | **DB-Spalte** | Geräteunabhängig; Profil-Einstellung folgt dem User auf allen Browsern nach Login |
| Sprachumschalter-Strategie | **Hard reload nach Sprachwechsel** | Stellt sicher, dass Server Components mit der neuen Locale neu gerendert werden; einfacher als einen komplexen Client-State zu managen |
| Keine URL-Präfixe | Explizit aus Spec | `/de/`, `/en/` wären unerwünscht; Cookie-basierter Ansatz erfüllt die Anforderung |
| Fallback-Sprache | **Deutsch ('de')** | Primäre Zielgruppe; Standard gemäß Spec |

---

### Dependencies (neue Packages)

| Package | Zweck |
|---|---|
| `next-intl` | i18n-Framework für Next.js App Router (Server + Client) |

---

### Scope der Übersetzungsarbeit

Alle User-sichtbaren Strings in folgenden Komponenten müssen auf i18n-Keys umgestellt werden (ca. 30 Dateien):

**Auth-Bereich:** `login-form`, `registration-form`, `forgot-password-form`, `new-password-form`, `resend-email-button`, `status-banner`, Auth-Layout-Texte

**App-Bereich:** `(app)/layout.tsx` (Navigation-Links, Sign Out), Dashboard, `feature-card`

**Port-Editor:** `port-form`, `port-table`, `lock-status-banner`, `delete-port-dialog`, `readonly-params-section`

**Rules-Editor:** `rule-form`, `rule-card`, `port-section`, `global-rules-section`, `delete-rule-dialog`

**Admin:** `user-table`, `role-select`, `deactivate-dialog`, `reject-dialog`

**GitHub:** `commit-modal`, `diff-viewer`, `conflict-warning`, `github-access-warning`

**Settings:** `settings-form`, `connection-test-results`, `active-lock-warning`, `unconfigured-banner`

**Shared:** Alle Toast-Meldungen in API-Routen und Page-Komponenten; Zod-Validierungsfehler

## QA Test Results
_To be added by /qa_

## Deployment

**Target:** Local (http://localhost:3002)
**Deployed:** 2026-02-28
**Build:** `npm run build` ✅
**Lint:** 0 neue Fehler (10 pre-existing, unverändert)
**Migration:** `add_locale_to_user_profiles` auf Supabase (wdeditor) angewendet
