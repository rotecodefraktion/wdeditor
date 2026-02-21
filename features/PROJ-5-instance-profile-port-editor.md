# PROJ-5: Instance Profile Port Editor

## Status: Planned

**Created:** 2026-02-20
**Last Updated:** 2026-02-20 (Update: Port-Löschung mit Rules-Integrity-Check)

## Dependencies

- Requires: PROJ-2 (User Authentication) – Nur eingeloggte, aktive User
- Requires: PROJ-4 (Global Settings) – Dateipfad und GitHub-Verbindung müssen konfiguriert sein
- Requires: PROJ-7 (GitHub Integration) – Laden und Committen der Datei

## Overview

Der Port-Editor verwaltet die `icm/server_port_<n>`-Parameter im SAP Web Dispatcher Instanzprofil.
Diese Parameter definieren auf welchen Ports und Protokollen der ICM (Internet Communication Manager) lauscht.

**Beispiel-Einträge im Instanzprofil:**

```text
icm/server_port_0 = PROT=HTTP,PORT=80,TIMEOUT=60
icm/server_port_1 = PROT=HTTPS,PORT=443,TIMEOUT=60,VCLIENT=1,SSLCONFIG=ssl_config
icm/server_port_2 = PROT=SMTP,PORT=25,TIMEOUT=120
```

Der Editor zeigt nur `icm/server_port_*`-Einträge strukturiert an. Alle anderen Parameter der Datei bleiben unverändert erhalten.

**Wichtig:** Da die konfigurierten Ports als Basis für den Rules-Editor (PROJ-6) dienen (Port-Scoping), löst das Löschen eines Ports einen Integritäts-Check gegen die rules.txt aus.

## User Stories

- Als Admin möchte ich alle konfigurierten Ports aus dem Instanzprofil in einer übersichtlichen Tabelle sehen.
- Als Admin möchte ich einen neuen Port-Eintrag hinzufügen, damit der Web Dispatcher auf einem weiteren Port lauscht.
- Als Admin möchte ich einen bestehenden Port-Eintrag bearbeiten, damit ich Konfigurationsänderungen vornehmen kann.
- Als Admin möchte ich einen Port-Eintrag löschen (mit Bestätigung), damit veraltete Ports entfernt werden.
- Als Admin möchte ich vor dem Löschen eines Ports gewarnt werden wenn noch Rewrite-Rules für diesen Port existieren, damit ich keine inkonsistente Konfiguration erzeuge.
- Als Admin möchte ich bei Eingabe sofort Validierungsfeedback erhalten, damit ich Fehler vor dem Commit behebe.
- Als Admin möchte ich sehen wenn die Datei von einem anderen User gesperrt ist, damit ich weiß wann ich editieren kann.
- Als Admin möchte ich eine Diff-Ansicht meiner Änderungen sehen bevor ich committe, damit ich nichts versehentlich ändere.

## Acceptance Criteria

### Anzeige

- [ ] Beim Öffnen des Editors wird die Instanzprofil-Datei via GitHub API geladen (PROJ-7)
- [ ] Alle `icm/server_port_*`-Einträge werden als strukturierte Tabelle angezeigt mit Spalten: Index (n), PROT, PORT, und weiteren bekannten Parametern
- [ ] Nicht-Port-Parameter der Datei werden in einer read-only "Weitere Parameter"-Sektion angezeigt (nicht editierbar)
- [ ] Anzeige des letzten GitHub-Commit-Hashes und -Zeitstempels der geladenen Datei

### Pessimistic Locking

- [ ] Beim Öffnen des Editors wird ein Lock für die Instanzprofil-Datei in der DB angelegt (User-ID, Timestamp)
- [ ] Lock wird auf 30 Minuten gesetzt und automatisch verlängert solange der User aktiv ist (Heartbeat alle 5 Min)
- [ ] Wenn die Datei bereits gesperrt ist: Nur-Lesen-Modus mit Hinweis "Gesperrt von [Name] seit [Zeit]"
- [ ] Lock wird freigegeben wenn: User speichert, User navigiert weg (beforeunload), Lock-Timeout überschritten
- [ ] Admins können einen abgelaufenen Lock (>30 Min ohne Heartbeat) manuell freigeben

### Port-Eintrag hinzufügen

- [ ] "Neuer Port"-Button öffnet Formular/Modal mit folgenden Feldern:
  - PROT: Dropdown (HTTP, HTTPS, SMTP) – Pflichtfeld
  - PORT: Zahleneingabe 1–65535 – Pflichtfeld
  - TIMEOUT: Zahleneingabe in Sekunden – Optional (Default: 60)
  - HOST: Freitext – Optional
  - Protokoll-spezifische Felder für HTTPS: VCLIENT (0/1), SSLCONFIG (Freitext)
- [ ] Index n wird automatisch als nächste freie Zahl vergeben
- [ ] Port-Eindeutigkeitsprüfung: Fehlermeldung wenn PORT-Wert bereits in einer anderen `icm/server_port_*`-Zeile vorkommt
- [ ] PORT muss numerisch und im Bereich 1–65535 sein
- [ ] Bekannte SAP-WD-Parameter-Schlüssel werden validiert (PROT, PORT, TIMEOUT, HOST, VCLIENT, SSLCONFIG, EXTBIND, NOLISTEN, PROCTIMEOUT)
- [ ] Unbekannte Schlüssel lösen eine Warnung aus (nicht blockierend): "Unbekannter Parameter – bitte prüfen"

### Port-Eintrag bearbeiten

- [ ] Klick auf Port-Zeile öffnet dasselbe Formular vorausgefüllt
- [ ] Speichern validiert erneut Port-Eindeutigkeit (außer dem eigenen Eintrag)
- [ ] Wenn der PORT-Wert geändert wird und Rewrite-Rules für den alten Port existieren: Warnung "Es existieren [n] Regeln in rules.txt für Port [alter_wert]. Diese werden nach dem Commit nicht mehr automatisch auf den neuen Port angepasst."

### Port-Eintrag duplizieren

- [ ] Jede Port-Zeile hat einen "Duplizieren"-Button (z.B. als Icon in der Zeilen-Aktionsleiste)
- [ ] Klick öffnet das Port-Formular vorausgefüllt mit allen Parametern des Originals (PROT, TIMEOUT, HOST, etc.)
- [ ] Das PORT-Feld ist dabei **leer** (nicht vorausgefüllt) – der User muss einen neuen, eindeutigen Port eingeben, da Port-Werte nicht doppelt vergeben werden dürfen
- [ ] Index n wird automatisch als nächste freie Zahl vergeben (kein manuelles Anpassen nötig)
- [ ] Alle Validierungsregeln des Hinzufügen-Formulars gelten unverändert (Port-Eindeutigkeit, Bereich 1–65535, Parameter-Schlüssel)

### Port-Eintrag löschen (mit Rules-Integrity-Check)

- [ ] Vor dem Löschen wird die rules.txt via GitHub API geladen und auf Regeln mit `%{SERVER_PORT} = <port>` geprüft
- [ ] Wenn **keine** Rules für diesen Port existieren: Standard-Bestätigungs-Dialog "Port [n] (PROT=X, PORT=Y) wirklich löschen?"
- [ ] Wenn **Rules für diesen Port existieren**: Erweiterter Bestätigungs-Dialog mit:
  - Warnung: "Achtung: Es existieren [n] Rewrite-Rules in rules.txt die Port [Y] referenzieren."
  - Liste der betroffenen Regeln (Kommentar/Name der Regel)
  - Zwei Optionen: "Nur Port löschen (Rules bleiben – inkonsistent)" oder "Abbrechen"
  - Keine Option zum automatischen Löschen der Rules (das erfolgt bewusst manuell im PROJ-6-Editor)
- [ ] Nach Löschen werden die Indizes nicht neu nummeriert (Lücken in der Nummerierung sind erlaubt)

### Commit

- [ ] "Änderungen speichern"-Button zeigt zuerst eine Diff-Ansicht (vorher/nachher der Datei)
- [ ] Commit-Modal ermöglicht Eingabe einer kurzen Commit-Message (Pflichtfeld, max. 200 Zeichen)
- [ ] Standard-Commit-Message vorausgefüllt: `feat: Update icm/server_port configuration [YYYY-MM-DD HH:MM]`
- [ ] Commit geht ausschließlich in den konfigurierten Dev-Branch
- [ ] Nach erfolgreichem Commit: Lock freigeben, Erfolgsmeldung, Editor zeigt aktuellen Stand
- [ ] Wenn die Datei auf GitHub seit dem Laden geändert wurde: Warnung vor Commit (PROJ-7-Konflikt-Handling)

## Edge Cases

- **Datei existiert nicht im Repository:** Fehlermeldung mit Option eine leere Datei anzulegen
- **Instanzprofil enthält unbekanntes Format in `icm/server_port_*`-Zeilen:** Eintrag wird als raw-Text angezeigt, nicht strukturiert bearbeitbar; Warnung anzeigen
- **Lock-Holder schließt Browser abrupt (kein beforeunload):** Lock-Timeout nach 30 Minuten; andere User können danach editieren
- **Zwei Admins öffnen gleichzeitig (Race Condition bei Lock-Erstellung):** Datenbankebene löst per `unique constraint` oder `SELECT FOR UPDATE`; Zweiter erhält Nur-Lesen-Modus
- **Port 0 oder Port > 65535 eingegeben:** Validierungsfehler "Ungültiger Port-Bereich"
- **Alle `icm/server_port_*`-Einträge gelöscht:** Warnung "Alle Ports gelöscht – der Web Dispatcher wird nach diesem Commit nicht mehr erreichbar sein"
- **GitHub-Commit schlägt fehl nach Diff-Anzeige:** Fehlermeldung, Lock bleibt erhalten, User kann erneut versuchen
- **rules.txt nicht ladbar beim Rules-Integrity-Check (z.B. Netzwerkfehler):** Port-Löschung wird mit Warnung erlaubt "Rules-Integritätsprüfung nicht möglich – bitte rules.txt manuell prüfen"; kein Blockieren der Löschung
- **rules.txt existiert nicht:** Rules-Integrity-Check ergibt 0 Treffer; normaler Lösch-Dialog ohne Warnung

## Technical Requirements

- Port-Parsing: Regex-basiertes Parsing von `icm/server_port_<n> = KEY=VALUE,KEY=VALUE,...`
- Nicht-Port-Zeilen der Datei bleiben byte-identisch erhalten (kein Reformatting)
- Rules-Integrity-Check: Client-seitiges Parsen der rules.txt nach `%{SERVER_PORT}\s*=\s*<port>` beim Auslösen der Lösch-Aktion (keine separate DB-Abfrage – direkt gegen GitHub-Datei)
- Lock-Tabelle: `file_locks` mit `file_type` (enum: `instance_profile`, `rules`), `locked_by`, `locked_at`, `heartbeat_at`
- Bekannte Parameter-Schlüssel: `PROT`, `PORT`, `TIMEOUT`, `HOST`, `VCLIENT`, `SSLCONFIG`, `EXTBIND`, `NOLISTEN`, `PROCTIMEOUT`, `KEEPALIVE`

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

_To be added by /architecture_

## QA Test Results

_To be added by /qa_

## Deployment

_To be added by /deploy_
