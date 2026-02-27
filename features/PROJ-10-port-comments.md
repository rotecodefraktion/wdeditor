# PROJ-10: Port-Kommentare im Instance Profile Editor

## Status: Planned
**Created:** 2026-02-27
**Last Updated:** 2026-02-27

## Dependencies
- Requires: PROJ-5 (Instance Profile Port Editor) — baut direkt auf dem bestehenden Port-Editor auf

## Overview

Im Port-Editor kann zu jedem `icm/server_port_<n>`-Eintrag ein optionaler Kommentartext hinterlegt werden, der erklärt, wofür dieser Port vorgesehen ist (z.B. "Externer HTTP-Eingang", "Interner HTTPS-Loadbalancer"). Der Kommentar wird als `#`-Zeile direkt vor dem Parameter in der Instanzprofil-Datei gespeichert — analog zu Kommentaren im Rules-Editor — und ist damit vollständig in Git versioniert.

**Beispiel (Instanzprofil-Datei nach Änderung):**
```
# Externer HTTP-Eingang fuer Load Balancer
icm/server_port_0 = PROT=HTTP,PORT=8080
# Interner HTTPS Admin-Port
icm/server_port_1 = PROT=HTTPS,PORT=4443,VCLIENT=1
icm/server_port_2 = PROT=HTTP,PORT=8000
```

## User Stories

- Als Admin möchte ich beim Hinzufügen eines Ports einen optionalen Kommentartext eingeben, damit das Team sofort sieht, wofür der Port bestimmt ist.
- Als Admin möchte ich den Kommentar eines bestehenden Ports bearbeiten, ohne die Port-Parameter zu ändern.
- Als Admin sehe ich die Kommentare in der Port-Tabelle direkt unter dem Port-Eintrag, damit ich die Liste ohne Öffnen des Formulars verstehe.
- Als Admin möchte ich beim Duplizieren eines Ports den Kommentar mitkopieren (als Ausgangsbasis), damit ich ihn anschließend anpassen kann.
- Als Admin möchte ich einen Kommentar auch nachträglich löschen (Feld leerlassen), damit keine veralteten Beschreibungen in der Datei stehen.

## Acceptance Criteria

### Port-Formular (Hinzufügen / Bearbeiten)
- [ ] Das Port-Formular hat ein neues optionales Feld "Kommentar" (Freitext, einzeilig, max. 200 Zeichen)
- [ ] Das Feld akzeptiert keine Zeilenumbrüche (Newlines werden entfernt/abgelehnt)
- [ ] Das Feld ist nicht verpflichtend — ein Port kann ohne Kommentar gespeichert werden
- [ ] Beim Bearbeiten eines vorhandenen Ports wird der existierende Kommentar vorausgefüllt
- [ ] Beim Duplizieren wird der Kommentar des Originals vorausgefüllt (User kann ihn anpassen)

### Anzeige in der Port-Tabelle
- [ ] Hat ein Port einen Kommentar, wird dieser in der Port-Tabelle sichtbar angezeigt (z.B. als graue Unterzeile oder eigene Spalte unterhalb der Port-Parameter)
- [ ] Ports ohne Kommentar zeigen keine leere Kommentarspalte — der Platz entfällt
- [ ] Der Kommentar wird nicht abgeschnitten (kein Truncation bei kurzen Kommentaren), bei sehr langen Texten optional Ellipsis

### Speicherung in der Datei
- [ ] Ein gesetzter Kommentar wird als `# <Kommentartext>` direkt vor der `icm/server_port_<n> = ...` Zeile in die Datei geschrieben
- [ ] Ist kein Kommentar gesetzt, wird keine `#`-Zeile geschrieben
- [ ] Beim Löschen eines Ports wird auch die zugehörige `#`-Kommentarzeile aus der Datei entfernt
- [ ] Beim Bearbeiten eines Ports mit Kommentar wird die `#`-Zeile aktualisiert (nicht verdoppelt)
- [ ] Beim Leeren des Kommentarfelds wird die `#`-Zeile aus der Datei entfernt

### Parser-Erweiterung
- [ ] Der Parser erkennt eine `#`-Zeile unmittelbar vor einer `icm/server_port_<n>`-Zeile als Kommentar dieses Ports
- [ ] Eine `#`-Zeile, die nicht direkt vor einer `icm/server_port_<n>`-Zeile steht, wird als unbekannte Raw-Zeile behandelt (kein Datenverlust)
- [ ] Mehrere aufeinanderfolgende `#`-Zeilen vor einem Port-Parameter: nur die letzte Zeile direkt vor dem Parameter gilt als Port-Kommentar; die anderen werden als Raw-Zeilen behandelt

### Commit & Diff
- [ ] Die Änderung (neue, geänderte oder gelöschte `#`-Zeile) erscheint im Diff-Viewer beim Commit korrekt
- [ ] Der Default-Commit-Nachricht-Text spiegelt die Kommentaränderung sinnvoll wider (z.B. "Update comment for port 8080")

## Edge Cases

- **Benutzer gibt `#` im Kommentarfeld ein:** Das Zeichen `#` am Anfang wird beim Schreiben nicht doppelt geschrieben (intern wird der User-Text ohne führendes `#` gespeichert; das `#`-Präfix fügt der Serializer automatisch hinzu)
- **Kommentar enthält Sonderzeichen wie `=`, `,`, `:`:** Erlaubt — die Zeile beginnt mit `#`, daher kein Parsing-Konflikt mit Port-Parametern
- **Bestehende Datei hat `#`-Zeilen, die keine Port-Kommentare sind (z.B. Abschnittsüberschriften):** Werden als Raw-Zeilen durchgereicht — kein Datenverlust, keine Interpretation als Port-Kommentar (da sie nicht direkt vor einem `icm/server_port_<n>`-Eintrag stehen)
- **Port-Index wird beim Neuordnen nach Lücken-Filling geändert:** Kommentar folgt dem Port-Eintrag — der Kommentar bleibt dem richtigen Port zugeordnet, unabhängig vom Index
- **Leerer Kommentar nach Trim (z.B. nur Leerzeichen):** Wird wie kein Kommentar behandelt — keine `#`-Zeile in der Datei
- **Sehr langer Kommentar (> 200 Zeichen):** Formular blockiert die Eingabe ab Zeichenlimit; bestehende längere Kommentare in der Datei (von direkter Dateibearbeitung) werden beim Laden ohne Kürzung angezeigt, aber beim Speichern auf 200 Zeichen beschränkt

## Technical Requirements

- Keine neue Datenbanktabelle oder -spalte erforderlich — Speicherung ausschließlich in der Profil-Datei
- `src/lib/port-parser.ts` muss `comment?: string` im Port-Objekt unterstützen
- Serializer schreibt `# <comment>\n` nur wenn `comment` nicht leer
- `src/components/port-editor/port-form.tsx` erhält neues optionales Feld
- `src/components/port-editor/port-table.tsx` zeigt Kommentar unterhalb der Port-Parameter an

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

Rein frontend-seitige Erweiterung. Keine neue Datenbank-Tabelle, kein neuer API-Endpunkt. Alle Änderungen betreffen drei existierende Dateien plus ein Datenmodell-Interface.

```
src/lib/port-parser.ts          ← Datenmodell + Parser + Serializer erweitern
src/components/port-editor/
  port-form.tsx                 ← Neues Kommentar-Eingabefeld
  port-table.tsx                ← Kommentar-Anzeige in der Tabelle
```

---

### Datenmodell — PortEntry Interface

Die `PortEntry`-Struktur (derzeit in `port-parser.ts`) erhält ein neues optionales Feld:

```
PortEntry {
  index, prot, port, timeout, host, vclient, sslconfig,
  extraParams, unknownKeys, rawLine, id,
  comment?: string   ← NEU (optional, leer = kein # in der Datei)
}
```

Kein Datenbankschema-Change. Der Kommentar lebt ausschließlich in der Profil-Datei.

---

### Komponenten-Struktur

```
Port Editor Page  (keine Änderung)
└── PortTable  (port-table.tsx)
    ├── TableRow: Index | PROT | PORT | HOST | ...
    │   └── [NEU] Kommentar-Zeile (graues Italic-Label, nur wenn comment gesetzt)
    └── ...
└── PortForm Dialog  (port-form.tsx)
    ├── Protokoll, Port-Nummer, Timeout, Host  (unverändert)
    ├── HTTPS-Felder (VCLIENT, SSLCONFIG)     (unverändert)
    └── [NEU] Kommentar-Feld (Input, optional, max 200 Zeichen)
```

---

### Parser-Logik (port-parser.ts)

**Lesen:** Der Parser iteriert Zeilen sequenziell. Wenn eine Zeile mit `#` beginnt **und die nächste Zeile** ein `icm/server_port_<n>`-Eintrag ist, wird der `#`-Text als `comment` des nachfolgenden Port-Eintrags gespeichert. Diese `#`-Zeile wird **nicht** in die `nonPortLines` aufgenommen (sie ist jetzt Eigentum des Port-Eintrags).

```
Datei-Zeilen:
  [i]   # Externer HTTP-Eingang       ← wird zu entry.comment = "Externer HTTP-Eingang"
  [i+1] icm/server_port_0 = PROT=HTTP,PORT=8080  ← portEntry[0]
  [i+2] icm/server_port_1 = PROT=HTTPS,...       ← portEntry[1], kein comment
```

**Mehrere `#`-Zeilen vor einem Port:** Nur die unmittelbar vorausgehende `#`-Zeile gilt als Kommentar. Alle weiteren `#`-Zeilen davor gehen in `nonPortLines` (kein Datenverlust).

**Schreiben:** `serializePortEntry` schreibt `# {kommentar}\n` vor die `icm/server_port_<n>`-Zeile — aber nur wenn `comment` nach Trim nicht leer ist. Bei leerem Kommentar entfällt die `#`-Zeile vollständig.

```
Ergebnis für entry mit comment "Externer HTTP-Eingang":
  # Externer HTTP-Eingang
  icm/server_port_0 = PROT=HTTP,PORT=8080

Ergebnis für entry ohne comment:
  icm/server_port_0 = PROT=HTTP,PORT=8080
```

Das `lineMap`-Array bleibt in seiner Struktur unverändert — `#`-Kommentarzeilen tauchen darin einfach nicht mehr auf (sie werden von der Port-Serialisierung selbst erzeugt).

---

### Formular-Erweiterung (port-form.tsx)

Das Zod-Validierungsschema erhält:
- `comment`: optionaler String, max. 200 Zeichen, Zeilenumbrüche werden beim Submit entfernt

Das Formular zeigt ein neues **"Kommentar"** Input-Feld (shadcn `Input`), positioniert am Ende des Formulars vor den Buttons. Kein eigener Formular-Abschnitt nötig — ein einzeiliges Textfeld genügt.

Bei `mode = 'edit'` oder `mode = 'duplicate'`: `entry.comment` wird als Vorgabewert eingefüllt.

---

### Tabellen-Anzeige (port-table.tsx)

Für jeden Port-Eintrag mit gesetztem `comment`: Eine zweite Zeile innerhalb der selben Tabellenzeile (oder ein `<div>` im ersten `<TableCell>`) zeigt den Kommentartext in gedämpftem Grau und kleinerer Schrift. Ports ohne Kommentar erhalten keine zusätzliche Zeile.

```
| 0 | HTTP | 8080 | ...               |
|   Externer HTTP-Eingang (grau)   |   ← NEU
| 1 | HTTPS | 4443 | ...            |
| 2 | HTTP | 8000 | ...             |   ← kein Kommentar, keine Extrazeile
```

---

### Commit-Nachricht (page.tsx — kleinere Anpassung)

Wenn der User nur den Kommentar eines Ports ändert (Port-Parameter unverändert), schlägt die Default-Commit-Nachricht vor: `"Update comment for port {PORT}"`. Die bestehende Logik zur Nachricht-Generierung in der Seite wird entsprechend erweitert.

---

### Keine neuen Dependencies

Alle benötigten Bausteine (Zod, react-hook-form, shadcn Input, shadcn Table) sind bereits installiert.

### Keine Datenbank-Migration

Kommentare leben ausschließlich in der Instanzprofil-Datei auf GitHub. Kein Supabase-Schema-Change.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
