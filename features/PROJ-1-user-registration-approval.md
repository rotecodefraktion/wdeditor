# PROJ-1: User Registration & Approval Workflow

## Status: In Review
**Created:** 2026-02-20
**Last Updated:** 2026-02-20

## Dependencies
- None (Basis-Feature)

## User Stories

- Als neuer SAP-Basis-Admin möchte ich mich mit E-Mail + Passwort registrieren, damit ich Zugang zum Editor beantragen kann.
- Als neuer SAP-Basis-Admin möchte ich mich alternativ via GitHub OAuth registrieren, damit ich nicht noch ein weiteres Passwort verwalten muss.
- Als neu registrierter User möchte ich eine Bestätigungs-E-Mail erhalten, damit ich meine E-Mail-Adresse verifiziere.
- Als neu registrierter User möchte ich nach der E-Mail-Bestätigung klar informiert werden, dass mein Account auf Genehmigung wartet.
- Als Super-Admin möchte ich eine Liste aller ausstehenden Registrierungsanfragen sehen, damit ich neue User freischalten kann.
- Als Super-Admin möchte ich einen User mit optionaler Begründung ablehnen, damit der User versteht warum sein Zugang verweigert wird.
- Als User möchte ich eine E-Mail-Benachrichtigung erhalten wenn mein Account genehmigt oder abgelehnt wird.
- Als erster registrierter User möchte ich automatisch Super-Admin werden, damit das System sofort nutzbar ist.

## Acceptance Criteria

- [ ] Registrierungsformular enthält: E-Mail, Passwort (min. 8 Zeichen), Passwort-Wiederholung, GitHub-Benutzername (Pflichtfeld)
- [ ] Nach Absenden: E-Mail-Bestätigungslink wird versendet; User landet auf "Bitte bestätige deine E-Mail"-Seite
- [ ] Nach E-Mail-Bestätigung: User-Status wechselt auf `pending_approval`; User sieht "Dein Account wartet auf Genehmigung"-Seite
- [ ] GitHub OAuth Registrierung durchläuft denselben Approval-Workflow (Status `pending_approval` nach OAuth)
- [ ] Bei GitHub OAuth wird der GitHub-Benutzername automatisch aus dem OAuth-Profil übernommen
- [ ] Der erste registrierte und bestätigte User der Instanz erhält automatisch die Rolle `super_admin`
- [ ] Super-Admin sieht im Admin-Dashboard alle User mit Status `pending_approval` inkl. Registrierungsdatum, E-Mail und GitHub-Username
- [ ] Super-Admin kann einen User genehmigen → Status wechselt auf `active`; User erhält Benachrichtigungs-E-Mail
- [ ] Super-Admin kann einen User ablehnen (mit optionalem Freitext-Grund) → Status wechselt auf `rejected`; User erhält Ablehungs-E-Mail mit Begründung
- [ ] Abgelehnte und nicht genehmigte User können sich nicht einloggen (klare Fehlermeldung)
- [ ] Bereits existierende E-Mail bei Neuregistrierung: Fehlermeldung "E-Mail bereits registriert"
- [ ] Bereits existierender GitHub-Username: Fehlermeldung "GitHub-Account bereits mit einem Account verknüpft"

## Edge Cases

- **E-Mail-Bestätigungslink abgelaufen:** User kann neuen Link per Button anfordern (nach 24h Ablauf)
- **User registriert sich, bestätigt aber nie die E-Mail:** Account bleibt im Status `unconfirmed`; kein Approval nötig
- **Super-Admin löscht eigenen Account:** Nicht erlaubt, wenn er der letzte Super-Admin ist (Fehlermeldung + Blockierung)
- **GitHub OAuth: E-Mail bereits als E-Mail+PW-Account registriert:** Fehlermeldung mit Hinweis die vorhandene Anmeldung zu nutzen
- **Massimport / Spam-Registrierungen:** Rate-Limiting auf Registrierungsendpunkt (max. 5 Registrierungen pro IP/Stunde)
- **Admin-Account existiert noch nicht (leere DB):** Hinweis auf der Login-Seite "Kein Admin konfiguriert – bitte zuerst registrieren"

## Technical Requirements

- Security: Passwort-Hashing via Supabase Auth (bcrypt)
- Security: E-Mail-Bestätigung ist Pflicht vor Approval-Workflow
- GitHub-Username wird bei Registrierung gespeichert aber NICHT gegen GitHub API validiert (das erfolgt in PROJ-7)
- User-Status-Enum: `unconfirmed`, `pending_approval`, `active`, `rejected`, `deactivated`
- E-Mail-Versand via Supabase Auth (Bestätigung) + Custom E-Mails für Approval/Rejection

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Gemeinsame Infrastruktur für PROJ-1 (Registration & Approval) und PROJ-2 (Authentication).

### Seitenstruktur

```
src/app/
├── (auth)/                           Öffentliche Auth-Seiten
│   ├── register/page.tsx             Registrierungsseite
│   │   ├── RegistrationForm         (E-Mail, Passwort, Passwort-Wdh., GitHub-Username)
│   │   └── GitHubOAuthButton
│   ├── register/confirm-email/       "Bitte E-Mail bestätigen"-Seite
│   │   └── ResendEmailButton
│   ├── register/pending/             "Warte auf Genehmigung"-Seite
│   ├── login/page.tsx                Login-Seite
│   │   ├── LoginForm                (E-Mail + Passwort)
│   │   ├── GitHubOAuthButton
│   │   └── StatusBanner            (Fehler für pending/rejected/deactivated)
│   ├── login/forgot-password/        Passwort-Reset anfordern
│   └── reset-password/               Neues Passwort setzen
├── auth/callback/route.ts            GitHub OAuth Callback (kein UI)
└── (app)/                            Geschützte App-Seiten (nach Login)

src/middleware.ts                     AuthGuard für alle Routen
```

### Datenmodell

**Supabase Auth** verwaltet intern: User-ID, E-Mail, Passwort-Hash, OAuth-Daten, E-Mail-Bestätigung-Datum.

**Eigene Tabelle `user_profiles`** (1:1 zu `auth.users`):

| Feld | Beschreibung |
| ---- | ------------ |
| `user_id` | Verweis auf Supabase Auth User (Primärschlüssel) |
| `github_username` | GitHub-Benutzername – Pflicht, eindeutig |
| `full_name` | Optional |
| `status` | Enum: `unconfirmed` / `pending_approval` / `active` / `rejected` / `deactivated` |
| `role` | Enum: `user` / `admin` / `super_admin` |
| `rejection_reason` | Optional, nur bei `rejected` |
| `created_at` / `updated_at` | Automatisch |

**Datenbank-Trigger:**

| Trigger | Auslöser | Aktion |
| ------- | -------- | ------ |
| `on_new_user` | Neuer Eintrag in `auth.users` | Erstellt `user_profiles`; wenn erster User → `super_admin` + `active` |
| `on_email_confirmed` | `email_confirmed_at` wird gesetzt | Status `unconfirmed` → `pending_approval` |
| `on_status_changed` | Status wechselt auf `active` / `rejected` | Löst Edge Function → Benachrichtigungs-E-Mail aus |

### Middleware-Zugangskontrolle

Jede Anfrage durchläuft `src/middleware.ts`:

- `/login`, `/register/*`, `/auth/*` → immer öffentlich
- Alle anderen Routen:
  - Keine Session → Redirect `/login`
  - Status `unconfirmed` → Redirect `/register/confirm-email`
  - Status `pending_approval` → Redirect `/register/pending`
  - Status `rejected` / `deactivated` → Redirect `/login?error=<status>`
  - Status `active` → Zugang erlaubt ✓

### E-Mail-Flows

| E-Mail | Sender | Auslöser |
| ------ | ------ | -------- |
| E-Mail-Bestätigung | Supabase (eingebaut) | Nach Registrierung automatisch |
| "Account genehmigt" | Edge Function → Resend | Status wechselt auf `active` |
| "Account abgelehnt" | Edge Function → Resend | Status wechselt auf `rejected` |
| Passwort-Reset-Link | Supabase (eingebaut) | User fordert Reset an |

### Tech-Entscheidungen

| Entscheidung | Begründung |
| ------------ | ---------- |
| Supabase Auth | Übernimmt Passwort-Hashing, OAuth-Tokens, JWTs – kein manuelles Sicherheits-Code nötig |
| GitHub OAuth via Supabase | Direkt im Supabase-Dashboard konfigurierbar; Callback ist Standard-Wrapper |
| `@supabase/ssr` in Middleware | Session-Prüfung serverseitig vor dem Browser; sicherer als client-seitige Checks |
| Status-Enum in `user_profiles` | SQL-abfragbar, RLS-geschützt, auditierbar |
| Resend für Approval-E-Mails | Einfaches SDK; kostenloser Tier; bessere Template-Kontrolle als Supabase-SMTP |
| Route Groups `(auth)` / `(app)` | Saubere Layout-Trennung: minimales Auth-Layout vs. volles App-Layout |

### Neue Pakete

- `@supabase/ssr` – Server-seitige Supabase-Session für Middleware
- `resend` – E-Mail-Versand für Approval/Rejection

## QA Test Results (Re-test #2)

**Tested:** 2026-02-21 (Re-test after bug fixes)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (npm run build succeeds cleanly)

### Previously Reported Bugs -- Fix Verification

| Bug ID | Description | Previous Status | Re-test Result |
| ------ | ----------- | --------------- | -------------- |
| BUG-PROJ1-1 | Email column missing from UserTable | Medium / Open | FIXED -- `UserProfile` interface now includes `email: string or null`; table renders Email column (hidden on mobile via `hidden md:table-cell`) |
| BUG-PROJ1-2 | No email link expiry indication | Low / Open | STILL OPEN -- Confirm-email page still only shows "Didn't receive the email?" without 24h expiry info |
| BUG-PROJ1-3 | In-memory rate limiter not production-ready | Medium / Open | STILL OPEN -- Rate limiter is still in-memory (`src/lib/rate-limit.ts` line 14: `const store = new Map<...>()`). Comment on line 6 still acknowledges limitation. Acceptable for small-team MVP per PRD constraints (2-10 users, single Vercel instance). |
| BUG-PROJ1-4 | HTML injection in rejection/approval emails | Medium / Open | FIXED -- `escapeHtml()` function added at `/src/lib/email.ts` lines 7-14. All `userName` and `reason` values now pass through `escapeHtml()` before HTML interpolation (lines 46, 77, 90, 121). |
| BUG-PROJ1-5 | Search does not search by email | Low / Open | FIXED -- Search function in `user-table.tsx` line 114 now includes `const matchesEmail = u.email?.toLowerCase().includes(q)` and line 116 checks `!matchesEmail` in the filter condition. |

### Acceptance Criteria Status

#### AC-1: Registration form fields (E-Mail, Passwort min 8 Zeichen, Passwort-Wiederholung, GitHub-Benutzername Pflichtfeld)
- [x] PASS -- E-Mail field present with type="email" and client-side Zod validation
- [x] PASS -- Password field present with min 8 character validation (client-side via Zod + server-side via Zod `RegisterSchema`)
- [x] PASS -- Password confirmation field present with `.refine()` match validation
- [x] PASS -- GitHub username field present as required (min 1 char, regex `/^[a-zA-Z0-9-]+$/` validated)
- [x] PASS -- Server-side Zod schema validates all fields in `/src/app/api/auth/register/route.ts`

#### AC-2: After submit - confirmation email sent, user lands on "Bitte bestaetige deine E-Mail"-Seite
- [x] PASS -- After successful registration, redirects to `/register/confirm-email` via `window.location.href`
- [x] PASS -- Confirm-email page shows user's email and "Check Your Email" message
- [x] PASS -- ResendEmailButton component available on the confirm-email page

#### AC-3: After email confirmation - status changes to `pending_approval`, user sees waiting page
- [x] PASS -- Pending page exists at `/register/pending` with appropriate messaging
- [x] PASS -- Proxy middleware redirects users with `pending_approval` status to `/register/pending`
- [ ] NOTE -- Status transition `unconfirmed` to `pending_approval` relies on database trigger (`on_email_confirmed`) -- cannot verify without database access

#### AC-4: GitHub OAuth registration follows same approval workflow
- [x] PASS -- GitHubOAuthButton component on register page
- [x] PASS -- OAuth callback checks profile status and redirects accordingly
- [x] PASS -- If no profile exists after OAuth, redirects to `/register?github=<username>`

#### AC-5: GitHub OAuth auto-fills GitHub username from OAuth profile
- [x] PASS -- Callback extracts `user_name` or `login` from `user.user_metadata`
- [x] PASS -- Register page accepts `?github=` query parameter and passes to `RegistrationForm`

#### AC-6: First registered and confirmed user automatically gets `super_admin` role
- [ ] NOTE -- Relies on database trigger `on_new_user` -- cannot verify without database access

#### AC-7: Super-Admin sees pending users in Admin Dashboard (incl. E-Mail, GitHub-Username, Registrierungsdatum)
- [x] PASS -- Admin dashboard fetches all users via `/api/admin/users`
- [x] PASS -- API returns user profiles including github_username, status, role, created_at
- [x] PASS (FIXED) -- Email is merged from auth.users via admin API AND now displayed in the table UI (column header "Email", `hidden md:table-cell`)

#### AC-8: Super-Admin can approve a user (status -> `active`, notification email sent)
- [x] PASS -- Approve endpoint validates auth, role, and target status (`pending_approval` only)
- [x] PASS -- Sets status to `active` and clears `rejection_reason`
- [x] PASS -- Sends approval email via Resend with HTML-escaped userName
- [x] PASS -- Email failure is logged but does not block the approval

#### AC-9: Super-Admin can reject a user (with optional reason, email with reason sent)
- [x] PASS -- Reject endpoint validates auth, role, accepts optional `reason` (max 500 chars via Zod)
- [x] PASS -- Sets status to `rejected` with reason
- [x] PASS -- Sends rejection email with HTML-escaped reason via `escapeHtml()`
- [x] PASS -- Reject dialog in UI has textarea with 500 char limit and character counter

#### AC-10: Rejected and unapproved users cannot log in (clear error message)
- [x] PASS -- Login API checks `user_profiles.status` BEFORE calling `signInWithPassword` (race condition fix)
- [x] PASS -- Returns 403 with status code for non-active users
- [x] PASS -- StatusBanner shows specific messages for each status
- [x] PASS -- Proxy middleware redirects non-active users away from protected routes

#### AC-11: Duplicate email shows "E-Mail bereits registriert"
- [x] PASS -- Server checks Supabase Auth error containing "already registered" and returns 409
- [x] PASS -- Client maps email-related errors to the email form field

#### AC-12: Duplicate GitHub username shows "GitHub-Account bereits mit einem Account verknuepft"
- [x] PASS -- Server queries `user_profiles` for existing `github_username` before registration
- [x] PASS -- Returns 409 with correct message
- [x] PASS -- Client maps GitHub-related errors to the githubUsername form field

### Edge Cases Status

#### EC-1: Expired email confirmation link - user can request new link
- [x] PASS -- ResendEmailButton component allows re-sending confirmation email
- [ ] BUG-PROJ1-2 (STILL OPEN, Low): No expiry indication -- UI does not mention 24h link expiry

#### EC-2: User registers but never confirms email - stays `unconfirmed`
- [x] PASS -- Proxy middleware redirects `unconfirmed` users to `/register/confirm-email`
- [x] PASS -- Login API blocks unconfirmed users with appropriate message

#### EC-3: Super-Admin deletes own account - blocked if last Super-Admin
- [x] PASS -- Deactivate endpoint blocks self-deactivation with error
- [x] PASS -- Deactivate endpoint checks for last super_admin and blocks

#### EC-4: GitHub OAuth with existing email+PW account
- [x] PASS -- Callback checks for existing profile; if none exists, redirects to register
- [ ] NOTE -- Specific German error message for duplicate email across providers depends on Supabase behavior

#### EC-5: Rate limiting on registration endpoint (max 5 per IP/hour)
- [x] PASS -- In-memory rate limiter implemented, configured 5 requests per IP per hour
- [x] PASS -- Returns 429 with Retry-After header and rate limit headers
- [ ] BUG-PROJ1-3 (STILL OPEN, Low -- downgraded): In-memory rate limiter resets on restart. Acceptable for MVP per PRD (2-10 users, single Vercel instance).

#### EC-6: Empty DB - hint on login page to register first
- [x] PASS -- Login page queries user count and shows alert with register link when count is 0

### Security Audit Results

- [x] **Input Validation:** Server-side Zod validation on all registration inputs
- [x] **Password Security:** Passwords hashed by Supabase Auth (bcrypt), minimum 8 characters enforced
- [x] **Rate Limiting:** Registration endpoint rate-limited per IP (5/hour)
- [x] **Open Redirect Protection:** `sanitizeRedirectPath` blocks protocol-relative URLs, backslash bypasses, scheme attacks
- [x] **Security Headers:** X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, HSTS in `next.config.ts`
- [x] **CSRF on Signout:** POST-only route
- [x] **GitHub username validation:** Regex prevents injection in username field
- [x] **HTML Injection in emails (FIXED):** `escapeHtml()` now used for all user-supplied data in email templates (`reason`, `userName`)
- [x] **Service Role Key:** Only used server-side in `createAdminClient()`, never exposed to browser
- [x] **Environment Variables:** All sensitive vars documented in `.env.local.example`
- [ ] BUG-PROJ1-6 (Low, Documentation): Middleware logic is in `src/proxy.ts` (Next.js 16 "Proxy"), spec references `src/middleware.ts`. Functionally correct.

### Bugs Found (Updated)

#### BUG-PROJ1-1: Email column missing from User Management Table -- FIXED
#### BUG-PROJ1-4: HTML injection in rejection/approval emails -- FIXED
#### BUG-PROJ1-5: Search does not search by email -- FIXED

#### BUG-PROJ1-2: No email link expiry indication (STILL OPEN)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Register a new account
  2. Land on confirm-email page
  3. Expected: Information about 24h link expiry
  4. Actual: Only generic "Didn't receive the email?" text
- **Priority:** Nice to have

#### BUG-PROJ1-3: In-memory rate limiter not production-ready (STILL OPEN -- downgraded to Low)
- **Severity:** Low (was Medium -- downgraded because PRD specifies 2-10 users, single Vercel instance)
- **Steps to Reproduce:**
  1. Send 5 registration requests, 6th blocked
  2. Restart server, rate limit resets
- **Priority:** Fix in next sprint (use Upstash/Redis for multi-instance)

#### BUG-PROJ1-6: Proxy file naming deviation (STILL OPEN)
- **Severity:** Low
- **Description:** `src/proxy.ts` instead of documented `src/middleware.ts`. Next.js 16 uses Proxy naming.
- **Priority:** Nice to have (documentation update)

### Cross-Browser / Responsive Notes
- [x] Auth layout uses `max-w-md` centered card -- works well at 375px, 768px, 1440px
- [x] Responsive design uses flex/grid with Tailwind breakpoints
- [x] All forms use standard HTML form elements -- cross-browser compatible (Chrome, Firefox, Safari)
- [x] Email column in admin table hidden on mobile via `hidden md:table-cell` -- appropriate responsive behavior

### Summary
- **Acceptance Criteria:** 10/12 passed (2 require database trigger verification -- cannot test without DB)
- **Bugs Fixed This Round:** 3 (BUG-PROJ1-1 email column, BUG-PROJ1-4 HTML injection, BUG-PROJ1-5 email search)
- **Bugs Remaining:** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Security:** All previously reported security issues fixed (HTML escaping in emails)
- **Production Ready:** YES (conditional -- no critical or high bugs; 3 remaining low-severity items are acceptable for MVP)
- **Recommendation:** Ready for deployment. Low-priority items (expiry indication, rate limiter upgrade, proxy naming) can be addressed post-launch.

## Deployment
_To be added by /deploy_
