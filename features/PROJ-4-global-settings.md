# PROJ-4: Global Settings Configuration

## Status: In Review

**Created:** 2026-02-20
**Last Updated:** 2026-02-21

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

### Component Structure (UI Tree)

```text
/settings  (Admin-only, redirect non-admins to /dashboard)
+-- SettingsPage  [Server Component]
|   +-- PageHeader  ("Globale Einstellungen")
|   +-- ActiveLockWarning  [Alert, shown if any file lock is active]
|   +-- SettingsForm  [Client Component]
|       +-- GitHubSection  [Card]
|       |   +-- RepoUrlInput       (e.g. "owner/repo" or full URL)
|       |   +-- PatInput           (masked: shows "••••••••abcd", never full token)
|       |   +-- BranchInput        (default: "dev")
|       +-- FilePathsSection  [Card]
|       |   +-- InstanceProfilePathInput  (e.g. "config/instance_profile")
|       |   +-- RulesTxtPathInput         (e.g. "config/rules.txt")
|       +-- ActionBar
|           +-- TestConnectionButton
|           |   +-- ConnectionTestResults  [inline, per-check status list]
|           |       +-- CheckItem: Repo accessible
|           |       +-- CheckItem: PAT valid + permissions (contents:read/write)
|           |       +-- CheckItem: Dev branch exists
|           |       +-- CheckItem: Instance profile path exists
|           |       +-- CheckItem: Rules.txt path exists
|           +-- SaveButton  → triggers success Toast on save
|
+-- UnconfiguredBanner  [shown to non-admins if no settings configured yet]
```

### Data Model (Plain Language)

**Table: `app_settings`** – one single row, shared globally across all users

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Fixed primary key (always the same row) |
| `github_repo` | Text | Repository in format `owner/repo` |
| `github_pat_encrypted` | Text | PAT encrypted with server-only secret key |
| `github_pat_hint` | Text | Only last 4 chars shown in UI (e.g. `"abc1"`) |
| `dev_branch` | Text | Git branch name for commits (default: `"dev"`) |
| `instance_profile_path` | Text | File path inside repo (e.g. `"config/instance_profile"`) |
| `rules_txt_path` | Text | File path inside repo (e.g. `"config/rules.txt"`) |
| `updated_at` | Timestamp | When settings were last saved |
| `updated_by` | UUID | FK to auth.users – which admin saved the settings |

**RLS Policies:**

- SELECT: Only `admin` and `super_admin` roles
- INSERT/UPDATE: Only `admin` and `super_admin` roles
- DELETE: Nobody (singleton row must never be deleted)

### Backend Components (3 API Routes)

**1. `GET /api/settings`**

- Returns all settings fields – **never** the full PAT, only the hint (last 4 chars)
- Used by the form to pre-populate fields on load

**2. `PUT /api/settings`**

- Receives updated fields from the form (including plain PAT on first save/update)
- Validates all inputs with Zod (required fields, URL/path format)
- Encrypts the PAT server-side before storing
- Saves encrypted PAT + hint; returns success or validation error

**3. `POST /api/settings/test-connection`**

- Triggered by the "Verbindung testen" button
- Fetches the PAT from DB server-side (PAT is never sent from browser)
- Decrypts PAT server-side, calls GitHub API with 5 checks:
  1. Is the repo accessible?
  2. Does the PAT have `contents: read` and `contents: write` permissions?
  3. Does the configured dev-branch exist?
  4. Does the instance profile path exist in the repo?
  5. Does the rules.txt path exist in the repo?
- Returns structured results per check: `pass | warn | fail` + human-readable message

### Security Architecture: PAT Handling

```text
Browser                    Next.js Server              Supabase DB
  |                              |                           |
  |-- Save Settings -----------> |                           |
  |   (sends plain PAT once)     |-- Encrypt PAT ----------> |
  |                              |   (AES-256-GCM)           |
  |                              |-- Store encrypted PAT --> |
  |                              |-- Store hint (last 4) --> |
  |<-- Return success ---------- |                           |
  |   (no token in response)     |                           |
  |                              |                           |
  |-- Test Connection ---------> |                           |
  |                              |-- Fetch encrypted PAT --> |
  |                              |-- Decrypt (server only)   |
  |                              |-- Call GitHub API         |
  |<-- Return test results ----- |                           |
  |   (pass/fail per check)      |                           |
```

The encryption key lives in environment variable `SETTINGS_ENCRYPTION_KEY` – never in the database or the frontend.

### Access Control Flow

```text
User visits /settings
    │
    ├─ Not logged in? → Redirect to /login
    │
    ├─ Logged in, not admin? → Redirect to /dashboard (403 message)
    │
    └─ Logged in, is admin → Show settings page
                                 │
                                 └─ All API calls also enforce RLS
                                    (even if someone bypasses the page)
```

### Active Lock Warning (PROJ-5/6 context)

- On page load, settings page checks if any active file locks exist (from the `file_locks` table built in PROJ-5)
- If locks exist → shows dismissible Alert warning admin about in-progress edits
- User can still save (warning only, not a blocker)

### Tech Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Settings storage | Supabase DB (single-row table) | Shared across all users/sessions; survives server restarts |
| PAT storage | AES-256-GCM encrypted in DB | Token never leaves server; even DB admins can't read plain PAT |
| Encryption | Node.js built-in `crypto` module | No extra dependency; AES-256-GCM is industry standard |
| Connection test | Next.js API Route (server-side) | PAT stays server-side; simpler than Edge Function for this use case |
| GitHub API calls | `@octokit/rest` npm package | Clean, well-typed GitHub client; handles auth headers automatically |
| Form validation | Zod + react-hook-form | Already used in PROJ-1/2/3; consistent pattern |
| Access guard | Middleware + Supabase RLS | Double layer: middleware stops page load, RLS stops direct API abuse |

### Required Packages

| Package | Purpose |
| --- | --- |
| `@octokit/rest` | GitHub API client for the connection test |
| Node.js `crypto` (built-in) | AES-256-GCM encryption for PAT storage – no install needed |

## QA Test Results (Re-Test 2026-02-22)

**Tested:** 2026-02-22
**App URL:** http://localhost:3000 (code-review-based; static analysis + production build verification)
**Tester:** QA Engineer (AI)
**Build Status:** PASS (`npm run build` succeeds cleanly; Next.js 16.1.1 Turbopack; all 26 routes present including `/api/settings`, `/api/settings/status`, `/api/settings/test-connection`, `/settings`)

### Test Methodology

This QA pass is a comprehensive independent re-test (3rd round) based on:
1. Full source code review of all PROJ-4 implementation files (16 files)
2. Production build verification (`npm run build` -- PASS, 0 errors, 0 warnings from app code)
3. Static analysis of API routes, validation schemas, encryption module, and UI components
4. Security audit of PAT handling, access control, input validation, and network behavior
5. Regression check on PROJ-1/2/3 code (no regressions detected)
6. Review of database migration files and RLS policies
7. Review of Next.js 16 proxy (middleware) configuration for route protection
8. Verification of fixes from prior QA pass (2026-02-21)

### Files Reviewed

- `src/app/(app)/settings/page.tsx` -- Settings page server component
- `src/app/api/settings/route.ts` -- GET + PUT settings API
- `src/app/api/settings/status/route.ts` -- Lightweight config status check
- `src/app/api/settings/test-connection/route.ts` -- GitHub connection test
- `src/components/settings/settings-form.tsx` -- Main settings form client component
- `src/components/settings/connection-test-results.tsx` -- Test results display
- `src/components/settings/active-lock-warning.tsx` -- File lock warning
- `src/components/settings/unconfigured-banner.tsx` -- Unconfigured app banner
- `src/lib/encryption.ts` -- AES-256-GCM PAT encryption/decryption
- `src/lib/settings-schema.ts` -- Zod v4 schema + TypeScript types
- `src/lib/rate-limit.ts` -- In-memory rate limiter
- `src/lib/supabase/admin.ts` -- Admin Supabase client
- `src/lib/supabase/server.ts` -- Server Supabase client
- `src/proxy.ts` -- Next.js 16 proxy (middleware) configuration
- `src/app/(app)/layout.tsx` -- App layout with nav
- `src/app/(app)/dashboard/page.tsx` -- Dashboard page (server component)
- `supabase/migrations/20260221000002_app_settings.sql` -- DB migration
- `supabase/migrations/20260221000003_fix_app_settings_rls.sql` -- RLS fix migration
- `next.config.ts` -- Security headers configuration
- `.env.local.example` -- Environment variable documentation

### Acceptance Criteria Status

#### AC-1: Settings page only accessible for admins and super_admins (otherwise 403/Redirect)

- [x] PASS -- Server component `settings/page.tsx` checks `user_profiles.role` and redirects non-admins to `/dashboard`
- [x] PASS -- GET `/api/settings` route checks role and returns 403 if not admin/super_admin
- [x] PASS -- PUT `/api/settings` route checks role and returns 403
- [x] PASS -- POST `/api/settings/test-connection` route checks role and returns 403
- [x] PASS -- App layout (`layout.tsx` lines 52-63) only shows Settings nav link for admin/super_admin roles
- [x] PASS -- Next.js 16 proxy (`proxy.ts`) does not include `/settings` in PUBLIC_PATHS -- requires active session
- [x] PASS -- API routes excluded from proxy matcher (`api/` in exclusion pattern at `proxy.ts` line 87) but each route implements its own auth+role check independently

#### AC-2: Form contains all required fields (Repo URL, PAT, Dev Branch, Instance Profile Path, Rules.txt Path)

- [x] PASS -- `settings-form.tsx` contains `github_repo` input with placeholder "owner/repo or https://github.com/owner/repo"
- [x] PASS -- `github_pat` input with type="password" (masked by default), toggle show/hide button with Eye/EyeOff icons
- [x] PASS -- `dev_branch` input with placeholder "dev"
- [x] PASS -- `instance_profile_path` input with placeholder "config/instance_profile"
- [x] PASS -- `rules_txt_path` input with placeholder "config/rules.txt"
- [x] PASS -- Zod v4 schema `settingsFormSchema` validates all fields (min 1 char for required, regex for valid chars)
- [x] PASS -- Repo URL supports both `owner/repo` and full GitHub URL formats via `.transform()` in schema (`.transform()` runs before `.refine()`, correctly stripping URL first)

#### AC-3: PAT masked in UI (only last 4 chars visible); full token never rendered in frontend

- [x] PASS -- GET `/api/settings` response explicitly selects only non-sensitive columns (line 45-47) -- `github_pat_encrypted` is never fetched in GET
- [x] PASS -- Only `github_pat_hint` (last 4 chars) and `has_pat` boolean are returned to client
- [x] PASS -- Form input shows placeholder `"Current token ends with ...<hint>"` when PAT exists
- [x] PASS -- PAT input field is type="password" by default with toggle button
- [x] PASS -- `getPatHint()` function extracts only last 4 chars; short tokens (<=4 chars) returned as-is
- [x] PASS -- PUT response contains only `{ success: true }`, no PAT echo

#### AC-4: "Test Connection" button performs all 5 checks

- [x] PASS -- Check 1: Repository accessible (GitHub GET /repos/{owner}/{repo})
- [x] PASS -- Check 2: PAT permissions via `repoData.permissions` (push/admin = pass, pull-only = warn, none = fail)
- [x] PASS -- Check 3: Dev branch exists (GET /repos/.../branches/{branch})
- [x] PASS -- Check 4: Instance profile path exists (GET /repos/.../contents/{path})
- [x] PASS -- Check 5: Rules.txt path exists (GET /repos/.../contents/{path})
- [x] PASS -- PAT is decrypted server-side only, never sent to client
- [x] PASS -- Checks 4 and 5 are skipped if path is empty (conditional)
- [x] PASS -- Early return if repo is not accessible (checks 3-5 skipped)
- [x] PASS -- Owner/repo split from stored data, not user-controlled per-request
- [x] PASS -- All 4 fetch calls have `AbortSignal.timeout(10_000)` for timeout protection (previously BUG-PROJ4-12, now FIXED)

#### AC-5: Test results show detailed status per check (checkmark / warning / error)

- [x] PASS -- `ConnectionTestResults` component renders results with pass/warn/fail icons (CheckCircle/AlertTriangle/XCircle)
- [x] PASS -- Each result shows label and human-readable message
- [x] PASS -- Color-coded backgrounds: green for pass, yellow for warn, red for fail (with dark mode variants)
- [x] PASS -- Summary toasts: error count, warning count, or "All checks passed"
- [x] PASS -- ARIA `role="list"` and `role="listitem"` for accessibility

#### AC-6: Settings stored globally (all users use same configuration)

- [x] PASS -- `app_settings` table uses singleton pattern with fixed UUID `00000000-0000-0000-0000-000000000001`
- [x] PASS -- Unique index `idx_app_settings_singleton ON public.app_settings ((true))` enforces single row at DB level
- [x] PASS -- PUT route uses check-then-upsert pattern: looks for existing row, updates or inserts

#### AC-7: Validation on save (not empty, URL format correct)

- [x] PASS -- Server-side Zod validation via `settingsFormSchema.safeParse(body)`
- [x] PASS -- Client-side Zod validation via `zodResolver(settingsFormSchema)` in react-hook-form
- [x] PASS -- `github_repo` requires min 1 char and must match `owner/repo` format after URL stripping
- [x] PASS -- `dev_branch` requires min 1 char, max 255, regex `[a-zA-Z0-9._\/-]+`
- [x] PASS -- `instance_profile_path` and `rules_txt_path` require min 1 char, max 500, regex validated
- [x] PASS -- Path traversal (`..`) blocked via `.refine()` on both path fields (previously BUG-PROJ4-7, now FIXED)
- [x] PASS -- `github_pat` optional (can be empty when updating other fields with existing PAT)
- [x] PASS -- PAT format validation: must start with `ghp_` or `github_pat_`
- [x] PASS -- Server enforces PAT requirement: if no existing PAT in DB and none provided, returns 400
- [x] PASS -- Invalid JSON body returns 400 "Invalid JSON body"
- [x] PASS -- Server-side field-level errors propagated to client form via `data.details.fieldErrors`

#### AC-8: Success toast after successful save

- [x] PASS -- `toast.success('Settings saved successfully.')` on successful save
- [x] PASS -- After success, `fetchSettings()` is called to refresh the form with updated data (PAT hint, timestamp)
- [x] PASS -- Error toast on failure: `toast.error(data.error || 'Failed to save settings')`

#### AC-9: Unconfigured banner for non-admin users when settings not configured

- [x] PASS -- `UnconfiguredBanner` component fetches `/api/settings/status` endpoint
- [x] PASS -- `/api/settings/status` uses admin client to bypass RLS (safe: returns only boolean)
- [x] PASS -- Dashboard page (server component) fetches user role and passes `userRole` prop to `UnconfiguredBanner`
- [x] PASS -- `UnconfiguredBanner` accepts `userRole` prop and skips rendering + fetch for admin/super_admin users (previously BUG-PROJ4-10, now FIXED)
- [x] PASS -- Banner text in German: "Die App ist noch nicht konfiguriert"

#### AC-10: Warning when settings changed while a file is locked

- [x] PASS -- `ActiveLockWarning` component implemented with dismissible Alert
- [x] PASS -- Settings page queries `file_locks` table for active locks with `expires_at` check
- [x] PASS -- When `file_locks` table does not exist (PROJ-5 not built), Supabase returns error in response object; `count` is `null`; fallback `count ?? 0` correctly results in 0
- [x] PASS -- Warning is dismissible but not a blocker (as designed)
- [ ] NOTE: The `file_locks` table is part of PROJ-5 which is not built yet. The warning will only become active after PROJ-5 is implemented. Current implementation is ready.

### Edge Cases Status

#### EC-1: PAT has insufficient permissions

- [x] PASS -- Check 2 in test-connection detects read-only PAT (permissions.pull without permissions.push)
- [x] PASS -- Shows warning: "PAT has read access only... Ensure the PAT has the 'repo' scope or 'contents: write' permission."
- [x] PASS -- If no permissions detected at all, shows fail status with scope requirements

#### EC-2: Dev branch does not exist

- [x] PASS -- Test returns `warn` status (not fail): "Branch does not exist. Commits will fail until this branch is created."
- [ ] BUG-PROJ4-3: Spec says "Option zum Erstellen des Branches" should be offered. No branch creation option is implemented. Test only warns.

#### EC-3: File paths do not exist in repo

- [x] PASS -- Test returns `warn` status (not fail): "File not found... It may be created later."

#### EC-4: Settings changed during file editing

- [x] PASS -- ActiveLockWarning covers this scenario
- [ ] NOTE: Lock timeout (60s auto-release) depends on PROJ-5 which is not built yet

#### EC-5: PAT expires

- [x] PASS -- test-connection handles 401 as "PAT is invalid or expired. Please update the token in settings."
- [ ] BUG-PROJ4-4: No proactive detection of expired PAT. Only detected when admin manually runs test-connection. Spec mentions "sprechende Fehlermeldung" for GitHub operations -- to be addressed in PROJ-7.

#### EC-6: Repository becomes private after configuration

- [x] PASS -- Test-connection handles 404 status: "Repository not found or no access"

#### EC-7: Non-admin tries to open editor when settings not configured

- [x] PASS -- `UnconfiguredBanner` shows on dashboard for non-admin users
- [ ] BUG-PROJ4-5: Spec says "Redirect zur Startseite mit Hinweis" when non-admin tries to open editor. Editors not built yet (PROJ-5/6). Forward-looking requirement.

### Security Audit Results

#### PAT Encryption and Handling

- [x] **AES-256-GCM encryption:** `encryption.ts` uses proper IV (16 random bytes), auth tag (16 bytes), and key from env var
- [x] **Key management:** `SETTINGS_ENCRYPTION_KEY` loaded from env var only, never hardcoded
- [x] **Key presence validation:** `getEncryptionKey()` throws if env var missing
- [x] **Key length validation:** `getEncryptionKey()` verifies buffer is exactly 32 bytes, throws with clear message if misconfigured (previously BUG-PROJ4-11, now FIXED)
- [x] **PAT never in API response:** GET endpoint returns `has_pat` boolean and `github_pat_hint` only
- [x] **PAT decryption only server-side:** Only `test-connection` route decrypts; result never includes PAT
- [x] **GET endpoint does not fetch encrypted PAT column** (previously BUG-PROJ4-6, FIXED in prior round)
- [ ] **BUG-PROJ4-9 (Low):** `/api/settings/status` still selects `github_pat_encrypted` via admin client (line 33). Should use `github_pat_hint` instead to avoid loading encrypted PAT into memory. The value is not returned in the response, so risk is minimal.

#### Access Control

- [x] **Authentication:** All four API routes (GET, PUT, POST test-connection, GET status) verify user session via `supabase.auth.getUser()`
- [x] **Authorization:** GET/PUT/POST routes check `user_profiles.role` for admin/super_admin; status route is intentionally open to all authenticated users (returns only boolean)
- [x] **RLS double-layer:** Database RLS policies enforce admin-only SELECT/INSERT/UPDATE; no DELETE policy (singleton protection)
- [x] **Settings page server component:** Server-side role check with redirect before rendering
- [x] **Status endpoint safe:** Uses admin client but only returns `{ configured: boolean }`
- [x] **API routes self-protecting:** API routes excluded from proxy matcher (`api/` exclusion in proxy.ts line 87), but each route implements its own auth+role checks -- no bypass possible

#### Input Validation

- [x] **Zod server-side validation:** PUT route validates all fields with `settingsFormSchema`
- [x] **Repo URL format:** Regex enforced `owner/repo` pattern (anchored with `^` and `$`) after URL stripping
- [x] **PAT prefix validation:** Must start with `ghp_` or `github_pat_` (prevents arbitrary strings)
- [x] **Path character restriction:** Regex `^[a-zA-Z0-9._\/-]+$` limits allowed characters
- [x] **Path traversal blocked:** `.refine()` rejects `..` segments in path fields (previously BUG-PROJ4-7, now FIXED)
- [x] **Branch name restriction:** Same regex prevents injection in branch names
- [x] **Max length limits:** dev_branch max 255, paths max 500 -- prevents oversized inputs

#### Rate Limiting

- [x] **Settings save rate limit:** 10 saves per 5 minutes per user
- [x] **Test connection rate limit:** 5 tests per minute per user
- [x] **Rate limit uses user ID (not IP):** Prevents admin lockout from shared IP
- [x] **Periodic cleanup:** Rate limit store cleaned every 5 minutes to prevent memory leaks
- [ ] **BUG-PROJ4-8 (Low):** PUT rate limit increment happens BEFORE role check (line 111 before role check at line 113-122). Non-admin users would be 403-rejected anyway, but their requests still consume rate limit budget.
- [ ] **BUG-PROJ4-14 (Low):** Same pattern in test-connection: rate limit incremented at line 58 before role check at line 60-69. Same negligible impact as BUG-PROJ4-8.

#### SSRF Prevention

- [x] **GitHub API calls use stored repo data:** Owner/repo split from DB-stored value, not from request body
- [x] **Repo format validated:** `owner/repo` Zod regex with safe character class prevents arbitrary URLs
- [x] **File paths encoded:** `encodeGitHubPath()` properly URI-encodes each path segment individually
- [x] **All external calls to known host:** Only `https://api.github.com` is called, never user-controlled URLs

#### Network/Timeout

- [x] **Timeout protection:** All 4 GitHub API fetch calls in test-connection have `AbortSignal.timeout(10_000)` (previously BUG-PROJ4-12, now FIXED)
- [x] **Error handling:** Catch blocks handle timeout/network errors with user-friendly messages

#### CSRF Protection

- [ ] **BUG-PROJ4-13 (Low):** No explicit CSRF token validation on PUT/POST API routes. Mitigated by: (1) Supabase auth cookies use `SameSite=Lax` by default, which prevents cross-origin POST/PUT with cookies; (2) JSON content type provides implicit protection since HTML forms cannot send `application/json`. Risk is low but not zero.

#### Security Headers

- [x] **X-Frame-Options:** DENY (next.config.ts)
- [x] **X-Content-Type-Options:** nosniff
- [x] **Referrer-Policy:** origin-when-cross-origin
- [x] **Strict-Transport-Security:** max-age=31536000; includeSubDomains
- [x] **SETTINGS_ENCRYPTION_KEY documented in `.env.local.example`** with dummy value and generation instruction

### Bugs Found

#### BUG-PROJ4-1: Server allows saving settings without PAT (Medium) -- FIXED

- **Status:** FIXED (verified 2026-02-21)
- **Fix:** PUT `/api/settings` route checks `github_pat_hint` from existing DB row and enforces PAT requirement.

#### BUG-PROJ4-2: Unconfigured banner text in English instead of German (Low) -- FIXED

- **Status:** FIXED (verified 2026-02-21)
- **Fix:** `unconfigured-banner.tsx` now displays German text as spec requires.

#### BUG-PROJ4-3: No "Create Branch" option when dev branch does not exist (Low)

- **Severity:** Low
- **Status:** OPEN
- **Steps to Reproduce:**
  1. Configure settings with a non-existent dev branch name
  2. Run Test Connection
  3. Expected: Warning with option to create the branch
  4. Actual: Warning only, no create option
- **Priority:** Nice to have (post-launch). Admin can create branch via GitHub directly.

#### BUG-PROJ4-4: No proactive PAT expiry detection (Low)

- **Severity:** Low
- **Status:** OPEN
- **Priority:** Address in PROJ-7 (GitHub Integration)

#### BUG-PROJ4-5: No redirect for non-admin editor access when unconfigured (Low)

- **Severity:** Low
- **Status:** OPEN
- **Priority:** Address when PROJ-5/6 editors are built

#### BUG-PROJ4-6: GET settings unnecessarily fetches encrypted PAT column (Medium) -- FIXED

- **Status:** FIXED (verified 2026-02-21)
- **Fix:** GET `/api/settings` route now explicitly selects only needed columns; `github_pat_encrypted` excluded.

#### BUG-PROJ4-7: Path validation allows `..` segments (Low) -- FIXED

- **Status:** FIXED (verified 2026-02-22)
- **Fix:** Both `instance_profile_path` and `rules_txt_path` in `settings-schema.ts` now have `.refine((val) => !/(^|\/)\.\.($|\/)/.test(val), { message: 'Path traversal (..) is not allowed.' })` blocking directory traversal patterns.

#### BUG-PROJ4-8: Rate limit increment before role check on PUT (Low)

- **Severity:** Low
- **Status:** OPEN
- **Priority:** Nice to have -- negligible impact

#### BUG-PROJ4-9: Status endpoint still fetches encrypted PAT column (Low)

- **Severity:** Low
- **Status:** OPEN
- **Steps to Reproduce:**
  1. Review `/api/settings/status` route (status/route.ts line 33)
  2. SELECT includes `github_pat_encrypted` via admin client
  3. Expected: Use `github_pat_hint` instead to avoid loading encrypted PAT into memory
  4. Actual: Encrypted PAT loaded into server memory (not returned in response)
- **Priority:** Nice to have -- admin-client-only, returns only boolean

#### BUG-PROJ4-10: UnconfiguredBanner shows for admin users too (Medium) -- FIXED

- **Status:** FIXED (verified 2026-02-22)
- **Fix:** `UnconfiguredBanner` now accepts `userRole` prop and short-circuits for admin/super_admin users (skips fetch and renders null). `DashboardPage` is now a server component that fetches the user role from `user_profiles` and passes it as `userRole` prop. AC-9 now fully satisfied.

#### BUG-PROJ4-11: Encryption key length not validated (Low) -- FIXED

- **Status:** FIXED (verified 2026-02-22)
- **Fix:** `getEncryptionKey()` in `encryption.ts` now validates `buf.length !== 32` and throws a clear error message: "SETTINGS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes) for AES-256."

#### BUG-PROJ4-12: No timeout on GitHub API calls in test-connection (Medium) -- FIXED

- **Status:** FIXED (verified 2026-02-22)
- **Fix:** All 4 `fetch()` calls in `test-connection/route.ts` now include `signal: AbortSignal.timeout(10_000)` for 10-second timeout per call.

#### BUG-PROJ4-13: No explicit CSRF protection on API routes (Low)

- **Severity:** Low
- **Status:** OPEN
- **Mitigation Already in Place:**
  - Supabase auth cookies default to `SameSite=Lax` which blocks cross-origin POST/PUT with cookies
  - JSON Content-Type provides implicit CSRF protection (HTML forms cannot send `application/json`)
- **Priority:** Nice to have. Current mitigations are sufficient for MVP.

#### BUG-PROJ4-14: Rate limit increment before role check on test-connection (Low)

- **Severity:** Low
- **Status:** OPEN
- **Root Cause:** Same pattern as BUG-PROJ4-8 but in `test-connection/route.ts` (line 58 before role check at line 60).
- **Priority:** Nice to have -- same negligible impact as BUG-PROJ4-8.

#### BUG-PROJ4-15: Mobile navigation does not show Settings link (Low) -- NEW

- **Severity:** Low
- **Status:** OPEN
- **Steps to Reproduce:**
  1. Log in as an admin user on a mobile device (375px viewport)
  2. Expected: Settings link accessible somewhere (hamburger menu, bottom nav, or similar)
  3. Actual: Navigation uses `hidden md:flex` which completely hides all nav links (Dashboard, Users, Settings) below 768px. No mobile menu or hamburger icon exists.
- **Root Cause:** `src/app/(app)/layout.tsx` line 48 uses `hidden md:flex` on the nav element. On screens below `md` (768px), the nav is invisible. There is no mobile menu component.
- **Note:** This is a layout-level issue affecting all nav links (not just Settings). It was already noted in previous QA rounds as a general observation but was not formally logged as a bug. Since it impacts admin access to Settings on mobile, it is worth tracking.
- **Priority:** Fix in next sprint. Admins can still access `/settings` by typing the URL, but discoverability is poor on mobile.

### Cross-Browser / Responsive Analysis

- [x] Settings form uses `max-w-2xl` container -- content stays readable at all breakpoints
- [x] Cards use full-width within container -- responsive by default
- [x] Action bar with Test Connection and Save buttons stacks vertically in `space-y-4` -- mobile-friendly
- [x] Loading skeleton provides proper layout during data fetch with correct sizing
- [x] Error state provides retry button with inline layout
- [x] All form elements use shadcn/ui components (Button, Input, Card, Form, Alert) -- cross-browser compatible (Chrome, Firefox, Safari)
- [x] PAT toggle button positioned absolutely within input (`absolute right-0 top-0`) -- works at all breakpoints
- [x] ConnectionTestResults uses flex layout with icons -- responsive, handles long messages well
- [x] Dark mode support: All status colors have `dark:` variants
- [ ] BUG-PROJ4-15: Navigation hides on mobile (`hidden md:flex`) with no mobile menu alternative -- nav items inaccessible below 768px
- [x] User email hidden on small screens (`hidden sm:block`) -- clean mobile header

### Regression Check (PROJ-1, PROJ-2, PROJ-3)

- [x] **PROJ-1 Registration:** No PROJ-4 files touch registration flow. `src/app/(auth)/register/` unchanged. `src/app/api/auth/register/` unchanged.
- [x] **PROJ-2 Authentication:** No PROJ-4 files touch auth flow. Login, OAuth callback, password reset all unchanged.
- [x] **PROJ-3 Admin Dashboard:** No PROJ-4 files touch admin users API. `src/app/api/admin/users/` unchanged. `src/app/(app)/admin/users/` unchanged.
- [x] **Shared components:** PROJ-4 only adds new components under `src/components/settings/` -- no existing components modified.
- [x] **Shared libraries:** `encryption.ts` and `settings-schema.ts` are new files, not modifications to existing libs.
- [x] **Rate limit library:** `rate-limit.ts` is shared across features but PROJ-4 uses separate rate limit keys (`settings-save:` and `test-connection:`) that do not conflict with auth rate limits.
- [x] **Layout modification:** `src/app/(app)/layout.tsx` adds Settings nav link for admins -- no changes to existing nav items for non-admins.
- [x] **Dashboard modification:** `src/app/(app)/dashboard/page.tsx` is now a server component that fetches user role and passes to `<UnconfiguredBanner />` -- existing feature cards unchanged. No regression.
- [x] **Build verification:** `npm run build` succeeds cleanly. All 26 routes present and building correctly.

### Summary

- **Acceptance Criteria:** 10/10 passed
  - AC-1 through AC-10: ALL PASS
- **Bugs Found:** 14 total across all QA rounds
  - 7 FIXED: BUG-PROJ4-1 (Medium), BUG-PROJ4-2 (Low), BUG-PROJ4-6 (Medium), BUG-PROJ4-7 (Low), BUG-PROJ4-10 (Medium), BUG-PROJ4-11 (Low), BUG-PROJ4-12 (Medium)
  - 7 OPEN (all Low severity):
    - BUG-PROJ4-3: No "Create Branch" option (Low, nice to have)
    - BUG-PROJ4-4: No proactive PAT expiry detection (Low, deferred to PROJ-7)
    - BUG-PROJ4-5: No redirect for unconfigured editors (Low, deferred to PROJ-5/6)
    - BUG-PROJ4-8: Rate limit before role check on PUT (Low, negligible)
    - BUG-PROJ4-9: Status endpoint fetches encrypted PAT column (Low, not exposed)
    - BUG-PROJ4-13: No explicit CSRF protection (Low, mitigated by SameSite + JSON)
    - BUG-PROJ4-14: Rate limit before role check on test-connection (Low, negligible)
    - BUG-PROJ4-15: Mobile navigation hidden with no alternative (Low, URL workaround exists)
- **Security:** PAT encryption is solid (AES-256-GCM with validated key length). Access control properly layered (page + API + RLS). No PAT leaks to frontend. All GitHub API calls have timeouts. Path traversal blocked. SSRF prevented. All 4 required security headers present.
- **Production Ready:** YES -- All acceptance criteria pass. All Medium and Critical bugs from prior rounds have been fixed. Only Low-severity issues remain, all with workarounds or deferred to dependent features.
- **Recommendation:** Feature is ready for deployment. The 8 remaining Low bugs are acceptable for MVP and can be addressed in upcoming sprints. Priority order for Low bugs: BUG-PROJ4-9 (status endpoint PAT column, easy fix) > BUG-PROJ4-15 (mobile nav) > BUG-PROJ4-3 (create branch) > rest.

## Deployment
_To be added by /deploy_
