# PROJ-6: Rules.txt Rewrite Rule Editor

## Status: Planned

**Created:** 2026-02-20
**Last Updated:** 2026-02-20

## Dependencies

- Requires: PROJ-2 (User Authentication) – Nur eingeloggte, aktive User
- Requires: PROJ-4 (Global Settings) – Dateipfad und GitHub-Verbindung müssen konfiguriert sein
- Requires: PROJ-5 (Port Editor) – **Port-Scoping:** Jede neue Regel muss einem Port aus dem Instanzprofil zugeordnet werden; teilt Lock-Infrastruktur
- Requires: PROJ-7 (GitHub Integration) – Laden und Committen der Datei

## Overview

Der Rule-Editor verwaltet die `rules.txt`-Datei des SAP Web Dispatchers. Diese Datei enthält URL-Routing- und Rewrite-Regeln die bestimmen wie Anfragen an Backend-Systeme weitergeleitet werden.

**Kern-Constraint: Port-Scoping**
Jede neue Rewrite-Regel muss einem Port zugeordnet sein, der im Instanzprofil (`icm/server_port_*`) konfiguriert ist. Beim Anlegen einer Regel wählt der Admin den Ziel-Port aus einer Dropdown-Liste der aktuell konfigurierten Ports aus. Die `If %{SERVER_PORT} = <port>`-Bedingung wird automatisch in die Regel eingefügt. Regeln können nicht für nicht-konfigurierte Ports angelegt werden.

**SAP Web Dispatcher rules.txt Syntax:**

```text
# Kommentare mit #

# Port-scoped Weiterleitung (automatisch generiert):
If %{SERVER_PORT} = 443 && %{PATH} = ^/myapp/(.*)$
  Forward https://backend:8443/myapp/$1
End

# Port-scoped Redirect:
If %{SERVER_PORT} = 80 && %{PATH} = ^/old/(.*)$
  Redirect 301 /new/$1
End

# Header setzen für HTTPS-Port:
If %{SERVER_PORT} = 443
  SetHeader X-Forwarded-Proto: https
End
```

**Bekannte Direktiven:** `If`, `ElseIf`, `Else`, `End`, `Forward`, `Redirect`, `Rewrite`, `Deny`, `SetHeader`, `RemoveHeader`, `SetEnvIf`, `Pass`

**Bekannte Variablen:** `%{PATH}`, `%{HOST}`, `%{METHOD}`, `%{QUERY}`, `%{URL}`, `%{SERVER_PORT}`, `%{HTTP_<header>}`, `%{REMOTE_ADDR}`

## User Stories

- Als Admin möchte ich alle Rewrite-Rules gruppiert nach Port sehen, damit ich einen schnellen Überblick habe welche Regeln für welchen Port gelten.
- Als Admin möchte ich beim Anlegen einer Regel den Port aus dem Instanzprofil auswählen, damit sichergestellt ist dass die Regel nur für definierte Ports gilt.
- Als Admin möchte ich zwischen einer strukturierten Ansicht und dem Raw-Text wechseln können, damit ich komplexe Regeln direkt bearbeiten kann.
- Als Admin möchte ich eine neue Regel mit einem Formular hinzufügen, damit ich keine Syntaxfehler mache.
- Als Admin möchte ich eine bestehende Regel bearbeiten, damit ich Anpassungen vornehmen kann.
- Als Admin möchte ich eine Regel löschen (mit Bestätigung), damit veraltete Regeln entfernt werden.
- Als Admin möchte ich Inline-Syntaxfeedback erhalten, damit ich Fehler sofort erkenne.
- Als Admin möchte ich sehen wenn die Datei von einem anderen User gesperrt ist.
- Als Admin möchte ich eine Diff-Ansicht meiner Änderungen vor dem Commit.

## Acceptance Criteria

### Anzeige

- [ ] Beim Öffnen: rules.txt wird via GitHub API geladen (PROJ-7); gleichzeitig werden die aktuellen Ports aus dem Instanzprofil via GitHub API geladen
- [ ] Strukturierte Ansicht: Regeln werden **gruppiert nach Port** angezeigt – eine Sektion pro konfiguriertem Port (z.B. "HTTP Port 80", "HTTPS Port 443")
- [ ] Jede Port-Sektion zeigt alle ihr zugeordneten Regeln als Karten (Kommentar/Name, Bedingung, Aktion)
- [ ] Bestehende Regeln ohne `%{SERVER_PORT}`-Bedingung erscheinen in einer separaten "Globale Regeln (nicht port-scoped)"-Sektion – read-only im Formular-Modus, editierbar im Raw-Text-Modus
- [ ] Raw-Text-Ansicht: Vollständiger Dateiinhalt in einem Code-Editor (read-only wenn gesperrt durch anderen User)
- [ ] Umschalten zwischen strukturierter Ansicht und Raw-Text jederzeit möglich
- [ ] Anzeige des letzten GitHub-Commit-Hashes und -Zeitstempels

### Pessimistic Locking (teilt Infrastruktur mit PROJ-5)

- [ ] Lock-Mechanismus identisch zu PROJ-5, aber für `file_type = 'rules'`
- [ ] Beim Öffnen: Lock in `file_locks`-Tabelle anlegen (30 Min + Heartbeat)
- [ ] Wenn gesperrt durch anderen: Read-only-Modus + Hinweis "Gesperrt von [Name] seit [Zeit]"
- [ ] Lock-Freigabe bei: Speichern, Navigieren weg, Timeout

### Regel hinzufügen (Formular-Modus)

- [ ] "Neue Regel"-Button öffnet Formular/Modal mit folgenden Feldern:
  - **Port (Pflichtfeld):** Dropdown mit allen konfigurierten Ports aus dem Instanzprofil (Format: "HTTP · 80", "HTTPS · 443"); kein Freitext erlaubt
  - **Optionaler Kommentar/Regelname:** wird als `# Name` über die Regel geschrieben
  - **Zusatzbedingung (Optional):** Freitext für weitere `&&`-Bedingungen (z.B. `%{PATH} = ^/myapp/(.*)$`); wird nach `%{SERVER_PORT} = <port>` per `&&` kombiniert
  - **Aktion (Pflichtfeld):** Dropdown (Forward, Redirect, Rewrite, Deny, SetHeader, RemoveHeader, Pass)
  - **Aktionsparameter:** je nach gewählter Aktion (URL, Status-Code, Header-Name/Wert)
  - Optionale `ElseIf`/`Else`-Blöcke hinzufügbar
- [ ] `If %{SERVER_PORT} = <gewählter_port>`-Bedingung wird automatisch generiert und kann nicht manuell überschrieben werden
- [ ] Validierung der Direktiven-Syntax beim Eingeben:
  - Bekannte Direktiven werden erkannt (grüner Indikator)
  - Unbekannte Direktiven: Warnung (orange) "Unbekannte Direktive – bitte prüfen"
  - Ungültige Variable (unbekanntes `%{...}` Muster): Warnung
- [ ] Alle `If`-Blöcke müssen mit `End` abgeschlossen sein (Validierung)
- [ ] Port-Dropdown zeigt nur Ports aus dem **aktuell geladenen** Instanzprofil; wenn keine Ports konfiguriert sind → Button deaktiviert mit Hinweis "Zuerst Ports im Instanzprofil konfigurieren"

### Regel bearbeiten

- [ ] Klick auf Regel-Karte öffnet dasselbe Formular vorausgefüllt
- [ ] Port-Zuweisung kann beim Bearbeiten geändert werden (nur auf andere konfigurierte Ports)
- [ ] Bei Regeln in der "Globale Regeln"-Sektion: Bearbeitung nur im Raw-Text-Modus möglich

### Regel duplizieren

- [ ] Jede Regel-Karte hat einen "Duplizieren"-Button
- [ ] Klick öffnet das Regel-Formular vorausgefüllt mit allen Parametern der Original-Regel (Port, Kommentar/Name, Zusatzbedingung, Aktion und Aktionsparameter)
- [ ] Der Port bleibt vorausgewählt (User kann ihn auf einen anderen konfigurierten Port ändern)
- [ ] Das Kommentar/Name-Feld wird mit dem Zusatz " (Kopie)" versehen um Verwechslungen zu vermeiden (User kann es überschreiben)
- [ ] Das Duplikat wird direkt **nach der Original-Regel** in der Datei eingefügt
- [ ] Alle Validierungsregeln gelten unverändert (Port muss konfiguriert sein, Syntax-Checks)
- [ ] Globale Regeln (ohne `%{SERVER_PORT}`-Scope) können ebenfalls dupliziert werden – nur über den Raw-Text-Modus

### Regel löschen

- [ ] Löschen-Button an jeder Regel-Karte mit Bestätigungs-Dialog
- [ ] Regel wird vollständig aus der Datei entfernt (inkl. zugehöriger Kommentarzeile)

### Commit

- [ ] "Änderungen speichern"-Button zeigt Diff-Ansicht (vorher/nachher)
- [ ] Commit-Message eingeben (Pflichtfeld, max. 200 Zeichen)
- [ ] Standard-Commit-Message: `feat: Update rules.txt [YYYY-MM-DD HH:MM]`
- [ ] Nur Commit in konfigurierten Dev-Branch möglich
- [ ] Nach Commit: Lock freigeben, Erfolgsmeldung
- [ ] Konflikt-Handling wenn Datei auf GitHub geändert (via PROJ-7)

## Edge Cases

- **Instanzprofil hat keine Ports:** "Neue Regel"-Button ist deaktiviert; Hinweis "Bitte zuerst Ports im Instanzprofil konfigurieren"
- **Port wurde im Instanzprofil gelöscht während Rules-Editor offen ist:** Beim nächsten Reload oder Öffnen des Regel-Formulars werden nicht mehr existierende Ports als "(gelöscht)" markiert und sind nicht mehr wählbar; bestehende Regeln für diesen Port bleiben in der Datei erhalten aber erscheinen mit Warnung-Badge "Port nicht mehr konfiguriert"
- **rules.txt ist leer:** Editor zeigt leere Port-Sektionen (eine pro konfiguriertem Port) mit "Erste Regel für diesen Port hinzufügen"-Hinweis
- **rules.txt existiert nicht im Repository:** Option zum Anlegen einer leeren Datei
- **Bestehende rules.txt enthält Regeln ohne `%{SERVER_PORT}`:** Diese landen in der "Globale Regeln"-Sektion – sichtbar und editierbar im Raw-Text-Modus, nicht im Formular-Modus
- **Komplexe verschachtelte If/ElseIf/Else-Strukturen:** Strukturierte Ansicht zeigt diese als "komplexen Block" mit Option in Raw-Text zu wechseln
- **Syntaxfehler in bestehender Datei (z.B. `If` ohne `End`):** Datei wird geladen, Validierungsfehler werden angezeigt; Commit blockiert bis Fehler behoben
- **Lock-Timeout während Raw-Text-Bearbeitung:** Warnung "Deine Session ist abgelaufen"; nicht gespeicherte Änderungen bleiben im Editor erhalten für manuelles Kopieren
- **Sehr große rules.txt (>500 Regeln):** Paginierung oder virtuelle Liste für Performance
- **Regel-Reihenfolge innerhalb eines Ports:** Reihenfolge ist semantisch relevant (SAP WD evaluiert von oben nach unten); Drag-and-Drop zum Umsortieren innerhalb einer Port-Sektion (P1)

## Technical Requirements

- Parser: Zeilen-basiertes Parsen der rules.txt nach SAP-WD-Syntax
- Port-Scoping: Parser extrahiert `%{SERVER_PORT} = <n>` aus `If`-Bedingungen zur Gruppierung
- Instanzprofil-Port-Liste wird beim Öffnen des Editors **parallel** zur rules.txt geladen (beide via PROJ-7 GitHub API)
- Bekannte Direktiven: `If`, `ElseIf`, `Else`, `End`, `Forward`, `Redirect`, `Rewrite`, `Deny`, `SetHeader`, `RemoveHeader`, `SetEnvIf`, `Pass`
- Bekannte Variablen: `%{PATH}`, `%{HOST}`, `%{METHOD}`, `%{QUERY}`, `%{URL}`, `%{SERVER_PORT}`, `%{REMOTE_ADDR}`, `%{HTTP_<name>}`
- Code-Editor-Komponente: CodeMirror oder Monaco Editor für Raw-Text-Ansicht
- Lock-Infrastruktur: Identisch zu PROJ-5 (`file_locks`-Tabelle)

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

_To be added by /architecture_

## QA Test Results

_To be added by /qa_

## Deployment

_To be added by /deploy_
