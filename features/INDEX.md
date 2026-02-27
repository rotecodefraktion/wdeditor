# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend

- **Planned** - Requirements written, ready for development
- **In Progress** - Currently being built
- **In Review** - QA testing in progress
- **Deployed** - Live in production

## Features

| ID | Feature | Status | Spec | Created |
| -- | ------- | ------ | ---- | ------- |
| PROJ-1 | User Registration & Approval Workflow | In Review | [PROJ-1-user-registration-approval.md](PROJ-1-user-registration-approval.md) | 2026-02-20 |
| PROJ-2 | User Authentication (Email+PW, GitHub OAuth, Password Reset) | In Review | [PROJ-2-user-authentication.md](PROJ-2-user-authentication.md) | 2026-02-20 |
| PROJ-3 | Admin User Management Dashboard | In Review | [PROJ-3-admin-user-management.md](PROJ-3-admin-user-management.md) | 2026-02-20 |
| PROJ-4 | Global Settings (GitHub Repo, Dateipfade, Dev Branch) | In Review | [PROJ-4-global-settings.md](PROJ-4-global-settings.md) | 2026-02-20 |
| PROJ-5 | Instance Profile Port Editor (inkl. Pessimistic Locking) | Deployed | [PROJ-5-instance-profile-port-editor.md](PROJ-5-instance-profile-port-editor.md) | 2026-02-20 |
| PROJ-6 | Rules.txt Rewrite Rule Editor (inkl. Pessimistic Locking) | Deployed | [PROJ-6-rules-rewrite-editor.md](PROJ-6-rules-rewrite-editor.md) | 2026-02-20 |
| PROJ-7 | GitHub Repository Integration (Lesen/Committen) | In Review | [PROJ-7-github-integration.md](PROJ-7-github-integration.md) | 2026-02-20 |
| PROJ-8 | UI Modernization — Consolut Branding | Deployed | [PROJ-8-ui-modernization-consolut-branding.md](PROJ-8-ui-modernization-consolut-branding.md) | 2026-02-25 |
| PROJ-9 | Internationalization (i18n) — DE / EN / PT | Planned | [PROJ-9-internationalization.md](PROJ-9-internationalization.md) | 2026-02-27 |
| PROJ-10 | Port-Kommentare im Instance Profile Editor | In Progress | [PROJ-10-port-comments.md](PROJ-10-port-comments.md) | 2026-02-27 |

<!-- Add features above this line -->

## Next Available ID: PROJ-11

## Build Order (Empfohlen)

```text
PROJ-1 → PROJ-2 → PROJ-3 → PROJ-4 → PROJ-7 → PROJ-5 → PROJ-6
```

| Schritt | Feature | Begründung |
| ------- | ------- | ---------- |
| 1 | PROJ-1: Registration | Basis: User-Modell und Approval-Flow zuerst |
| 2 | PROJ-2: Authentication | Login baut auf Registration auf |
| 3 | PROJ-3: Admin Dashboard | Braucht Auth + User-Modell |
| 4 | PROJ-4: Settings | Braucht Auth + Admin-Rolle |
| 5 | PROJ-7: GitHub Integration | Braucht Settings; wird von Editoren genutzt |
| 6 | PROJ-5: Port Editor | Braucht Settings + GitHub Integration |
| 7 | PROJ-6: Rules Editor | Braucht Settings + GitHub + Lock-Infrastruktur von PROJ-5 |
