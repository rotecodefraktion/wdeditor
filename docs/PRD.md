# Product Requirements Document

## Vision

Der SAP Web Dispatcher Config Editor ist ein webbasiertes Tool für SAP-Basis-Administratoren, das kollaboratives und sicheres Bearbeiten von Web Dispatcher Konfigurationsdateien ermöglicht. Änderungen werden syntaktisch validiert, auf Port-Eindeutigkeit geprüft und automatisch per Git-Commit in einem dedizierten Dev-Branch versioniert – ohne direkten Dateizugriff auf Serverebene.

## Target Users

**SAP-Basis-Administratoren** in Unternehmen, die SAP Web Dispatcher betreiben:

- Verwalten `icm/server_port_*`-Parameter im Instanzprofil (Ports, Protokolle, Hosts)
- Pflegen URL-Rewrite Rules in `rules.txt` für Routing und Weiterleitung
- Müssen Fehler durch manuelle Konfigurationsänderungen vermeiden (Tipp-Fehler, doppelte Ports)
- Benötigen Versionierung und Traceability aller Änderungen
- Arbeiten in kleinen Teams mit dem Bedarf an Zugangskontrolle und Audit-Trail

## Core Features (Roadmap)

| Priority | Feature | Status |
| -------- | ------- | ------ |
| P0 (MVP) | PROJ-1: User Registration & Approval Workflow | Planned |
| P0 (MVP) | PROJ-2: User Authentication (Email+PW, GitHub OAuth, Password Reset) | Planned |
| P0 (MVP) | PROJ-3: Admin User Management Dashboard | Planned |
| P0 (MVP) | PROJ-4: Global Settings (GitHub Repo, Dateipfade, Dev Branch) | Planned |
| P0 (MVP) | PROJ-5: Instance Profile Port Editor (inkl. Pessimistic Locking) | Planned |
| P0 (MVP) | PROJ-6: Rules.txt Rewrite Rule Editor (inkl. Pessimistic Locking) | Planned |
| P0 (MVP) | PROJ-7: GitHub Repository Integration (Lesen/Committen) | Planned |

## Success Metrics

- **Zero Syntax-Fehler:** Keine fehlerhaften Konfigurationen mehr durch Tipp-Fehler in Ports oder Rule-Syntax
- **Adoption:** Alle Administratoren nutzen den Editor statt direktem Datei-Editieren
- **Audit-Trail:** 100% der Änderungen sind per Git-History nachvollziehbar mit User-Attribution
- **Verfügbarkeit:** Fehlerhafte Port-Dopplungen werden zu 100% vor dem Commit abgefangen
- **Onboarding:** Neuer Admin kann innerhalb von 10 Minuten (nach Genehmigung) erste Änderungen vornehmen

## Constraints

- **Team:** Kleine Gruppe von SAP-Basis-Admins (typisch 2-10 User)
- **Git:** Ein globales GitHub-Repository für alle Konfigurationsdateien
- **Branch-Policy:** Commits ausschließlich in den konfigurierten Dev-Branch (kein direkter Push auf main/master)
- **GitHub-Pflicht:** Alle User müssen einen gültigen GitHub-Account mit Repository-Zugriff haben
- **Supabase:** Backend via Supabase (Auth + PostgreSQL)
- **Deployment:** Vercel (Next.js App Router)

## Non-Goals

- **Kein direkter SAP-Systemzugriff:** Die App kommuniziert nur mit GitHub, nicht direkt mit SAP-Servern
- **Kein automatisches Deployment:** Die App committed in den Dev-Branch, den Merge nach Production verantwortet das Team manuell
- **Kein Multi-Repository-Support:** In MVP nur ein globales Repository (kein Repository-Switching pro User)
- **Kein CI/CD-Trigger:** Die App löst keine Pipelines aus
- **Keine vollständige SAP-Profil-Verwaltung:** Nur `icm/server_port_*`-Parameter werden strukturiert verwaltet; restliche Parameter sind read-only sichtbar
- **Kein Live-Syntax-Checker für komplexe Nested-If-Bäume:** Basic-Keyword-Validierung, keine vollständige SAP-WD-Rule-Engine

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
