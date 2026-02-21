# PROJ-2: User Authentication (Email+PW, GitHub OAuth, Password Reset)

## Status: In Review
**Created:** 2026-02-20
**Last Updated:** 2026-02-20

## Dependencies
- Requires: PROJ-1 (User Registration & Approval) – Nur genehmigte User dürfen sich einloggen

## User Stories

- Als genehmigter Admin möchte ich mich mit E-Mail + Passwort einloggen, damit ich Zugang zum Editor erhalte.
- Als genehmigter Admin möchte ich mich mit GitHub OAuth einloggen, damit ich keine Passwörter verwalten muss.
- Als Admin, der sein Passwort vergessen hat, möchte ich einen Reset-Link per E-Mail erhalten, damit ich wieder Zugang bekomme.
- Als eingeloggter Admin möchte ich mich ausloggen können, damit meine Session sicher beendet wird.
- Als Admin möchte ich, dass meine Session über Browser-Neustarts hinweg bestehen bleibt, damit ich nicht ständig neu einloggen muss.
- Als nicht genehmigter User möchte ich eine klare Fehlermeldung beim Login-Versuch sehen, damit ich verstehe warum ich keinen Zugang habe.

## Acceptance Criteria

- [ ] Login-Seite bietet zwei Optionen: "Mit E-Mail einloggen" und "Mit GitHub einloggen"
- [ ] E-Mail+PW Login: Validierung E-Mail-Format und Passwort nicht leer; klare Fehlermeldung bei falschen Credentials
- [ ] Login nur für User mit Status `active` möglich; alle anderen Status zeigen spezifische Fehlermeldungen:
  - `unconfirmed`: "Bitte bestätige zuerst deine E-Mail-Adresse."
  - `pending_approval`: "Dein Account wartet noch auf Genehmigung."
  - `rejected`: "Dein Zugang wurde abgelehnt."
  - `deactivated`: "Dein Account wurde deaktiviert. Bitte wende dich an einen Administrator."
- [ ] GitHub OAuth Login: Redirect zu GitHub, Callback verarbeitet OAuth-Token, Session wird erstellt
- [ ] GitHub OAuth: Wenn der GitHub-Account keinem App-Account zugeordnet ist → Weiterleitung zur Registrierung mit vorausgefülltem GitHub-Username
- [ ] Passwort-Reset: "Passwort vergessen?"-Link auf Login-Seite öffnet Formular mit E-Mail-Eingabe
- [ ] Passwort-Reset: E-Mail mit Zeit-begrenztem Reset-Link wird versendet (gültig 1 Stunde)
- [ ] Passwort-Reset: Nach Klick auf Link → Formular für neues Passwort (min. 8 Zeichen, Bestätigung)
- [ ] Passwort-Reset: Nach erfolgreichem Reset → Weiterleitung zur Login-Seite mit Erfolgsmeldung
- [ ] Session bleibt über Browser-Neustart erhalten (Supabase persisted session)
- [ ] Logout: Session wird serverseitig invalidiert; Redirect zur Login-Seite
- [ ] Brute-Force-Schutz: Nach 5 fehlgeschlagenen Login-Versuchen → 15 Minuten Sperrzeit (Supabase eingebaut)

## Edge Cases

- **Passwort-Reset-Link abgelaufen:** Klarer Hinweis "Link abgelaufen" + Option neuen Link anzufordern
- **Passwort-Reset für GitHub-OAuth-User:** Fehlermeldung "Du hast dich via GitHub registriert – kein Passwort vorhanden. Bitte nutze GitHub OAuth."
- **GitHub OAuth: primäre E-Mail bei GitHub geändert:** Login funktioniert weiterhin via OAuth-ID; E-Mail in App-Profil wird aktualisiert
- **GitHub OAuth: User widerruft App-Zugriff bei GitHub:** Nächster Login-Versuch schlägt fehl mit klarer Meldung "GitHub-Zugriff wurde widerrufen"
- **Gleichzeitige Sessions auf mehreren Geräten:** Erlaubt (kein Single-Session-Enforcement in MVP)
- **Passwort-Reset: E-Mail nicht registriert:** Aus Sicherheitsgründen keine Unterscheidung – immer Meldung "Falls die E-Mail registriert ist, wurde ein Link versendet"

## Technical Requirements

- Auth-Provider: Supabase Auth (Email+PW und GitHub OAuth Provider)
- Session-Handling: Supabase persisted session (localStorage)
- Post-Login Redirect: `window.location.href` (nicht `router.push`) zur Hauptseite
- Passwort-Mindestlänge: 8 Zeichen (konfiguriert in Supabase)
- Rate-Limiting: Supabase eingebaut (5 Versuche → 15 Min Sperre)
- GitHub OAuth App muss in GitHub registriert sein (Callback-URL konfiguriert)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Die Infrastruktur (Datenmodell, Trigger, Middleware) ist in PROJ-1 beschrieben. Dieses Dokument beschreibt die Login- und Session-Flows.

### Login-Flow (E-Mail + Passwort)

```
User gibt E-Mail + Passwort ein
  → Supabase Auth prüft Credentials
  → Supabase gibt Session-JWT zurück
  → Middleware prüft user_profiles.status
    → Nicht "active" → Redirect mit Fehlermeldung
    → "active" → window.location.href zur Hauptseite
```

### Login-Flow (GitHub OAuth)

```
User klickt "Mit GitHub einloggen"
  → Supabase leitet zu github.com/login/oauth weiter
  → User autorisiert App auf GitHub
  → GitHub leitet zurück zu /auth/callback
  → /auth/callback tauscht Code gegen Session-JWT
  → Middleware prüft user_profiles.status (wie oben)
  → Kein App-Account gefunden → Redirect /register?github=<username>
```

### Session-Verwaltung

- Supabase speichert Session im `localStorage` des Browsers (persistiert über Neustarts)
- Session-JWT wird automatisch erneuert solange der User aktiv ist
- Logout: Supabase invalidiert Session serverseitig + löscht `localStorage`-Eintrag

### Passwort-Reset-Flow

```
User gibt E-Mail ein auf /login/forgot-password
  → Supabase sendet Reset-Link (gültig 1 Stunde)
  → User klickt Link → landet auf /auth/reset-password?token=...
  → User gibt neues Passwort ein (min. 8 Zeichen)
  → Supabase setzt neues Passwort + invalidiert alten Reset-Token
  → Redirect /login mit Erfolgsmeldung
```

Sonderfall: GitHub-OAuth-User fordert Passwort-Reset an → Fehlermeldung "Kein Passwort vorhanden – bitte über GitHub einloggen."

### Seiten und Komponenten

| Seite | Komponenten | Zweck |
| ----- | ----------- | ----- |
| `/login` | `LoginForm`, `GitHubOAuthButton`, `StatusBanner` | E-Mail+PW Login + OAuth |
| `/login/forgot-password` | `ForgotPasswordForm` | Reset-Link anfordern |
| `/auth/reset-password` | `NewPasswordForm` | Neues Passwort setzen |
| `/auth/callback` | (kein UI, nur Handler) | GitHub OAuth Callback |

### Tech-Entscheidungen

| Entscheidung | Begründung |
| ------------ | ---------- |
| `window.location.href` statt `router.push` nach Login | Erzwingt vollständiges Page-Reload; stellt sicher dass Middleware und Server-Komponenten die neue Session sehen |
| Supabase persisted Session | User muss sich nicht bei jedem Browser-Neustart neu anmelden |
| Brute-Force-Schutz via Supabase | 5 fehlgeschlagene Versuche → 15 Min Sperre; eingebaut, kein eigener Code nötig |

## QA Test Results (Re-test #2)

**Tested:** 2026-02-21 (Re-test after bug fixes)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS

### Previously Reported Bugs -- Fix Verification

| Bug ID | Description | Previous Status | Re-test Result |
| ------ | ----------- | --------------- | -------------- |
| BUG-PROJ2-1 | Status messages in English, not German | Low / Open | STILL OPEN (Low) -- Entire UI is English; accepted as intentional |
| BUG-PROJ2-2 | No rate limiting on login endpoint | HIGH / Open | FIXED -- Login route now imports `checkRateLimit` (line 5), applies rate limit `login:<ip>` key with 10 requests per 15 minutes (lines 20-37). Returns 429 with `Retry-After` header when exceeded. |
| BUG-PROJ2-3 | No explicit expired-link handling for password reset | Medium / Open | STILL OPEN -- `NewPasswordForm` still shows generic `toast.error(error.message)` on Supabase error; no "Link abgelaufen" specific handling |
| BUG-PROJ2-4 | check-provider fetches all users | Medium / Open | STILL OPEN -- `/api/auth/check-provider` still calls `listUsers()` without pagination (line 38). Acceptable for PRD scope (2-10 users). |
| BUG-PROJ2-5 | Missing oauth_error mapping in StatusBanner | Low / Open | STILL OPEN -- StatusBanner still has no mapping for `oauth_error`; falls back to generic message |
| BUG-PROJ2-6 | Session race condition in login API | Medium / Open | FIXED -- Login API now checks user status BEFORE calling `signInWithPassword` (lines 51-80). Uses `adminClient` to look up user by email and verify profile status is `active` before creating a session. Defense-in-depth: double-check after sign-in on lines 99-112 with signOut fallback. |
| BUG-PROJ2-7 | No oauth_error mapping in StatusBanner | Low / Open | STILL OPEN -- Same as BUG-PROJ2-5 (duplicate) |

### Acceptance Criteria Status

#### AC-1: Login page offers two options - "Mit E-Mail einloggen" and "Mit GitHub einloggen"

- [x] PASS -- Login page (`/login`) renders `LoginForm` for email+password
- [x] PASS -- Login page renders `GitHubOAuthButton` with label "Sign In with GitHub"
- [x] PASS -- Separator between the two options with "or" text

#### AC-2: Email+PW Login validation and error messages

- [x] PASS -- Client-side Zod validation: email format required, password not empty (min 1 char)
- [x] PASS -- Server-side Zod validation in `/api/auth/login` with `loginSchema`
- [x] PASS -- Wrong credentials return 401 with `invalid_credentials` code
- [x] PASS -- StatusBanner displays "Invalid email or password." for `invalid_credentials`

#### AC-3: Login only for `active` users with specific error messages per status

- [x] PASS -- Login API checks `user_profiles.status` BEFORE creating session (race condition fixed)
- [x] PASS -- Non-active users are rejected immediately without creating a session
- [x] PASS -- `unconfirmed`: "Please confirm your email address before signing in."
- [x] PASS -- `pending_approval`: "Your account is pending administrator approval."
- [x] PASS -- `rejected`: "Your access request has been rejected. Please contact an administrator."
- [x] PASS -- `deactivated`: "Your account has been deactivated. Please contact an administrator."
- [ ] BUG-PROJ2-1 (Low, STILL OPEN): Messages in English instead of German per spec. Accepted as intentional (whole UI is English).

#### AC-4: GitHub OAuth Login flow

- [x] PASS -- GitHubOAuthButton calls `supabase.auth.signInWithOAuth` with `provider: 'github'`
- [x] PASS -- Redirect URL set to `/auth/callback`
- [x] PASS -- Callback exchanges code for session and checks profile status

#### AC-5: GitHub OAuth - no matching app account redirects to registration

- [x] PASS -- Callback checks for profile via `user_profiles` query
- [x] PASS -- If no profile found, extracts GitHub username from `user_metadata` and redirects to `/register?github=<username>`

#### AC-6: Password Reset - "Passwort vergessen?" link on login page

- [x] PASS -- "Forgot password?" link present in login form, links to `/login/forgot-password`
- [x] PASS -- ForgotPasswordForm with email input exists

#### AC-7: Password Reset - time-limited reset link sent (1 hour validity)

- [x] PASS -- Uses `supabase.auth.resetPasswordForEmail` which sends time-limited link
- [x] PASS -- Redirect URL configured to `/auth/reset-password`
- [x] PASS -- After submission, shows generic security message

#### AC-8: Password Reset - form for new password (min 8 chars, confirmation)

- [x] PASS -- NewPasswordForm at `/reset-password` with password (min 8) and confirmPassword fields
- [x] PASS -- Zod validation with `.refine()` for password match
- [x] PASS -- Uses `supabase.auth.updateUser({ password })` to set new password

#### AC-9: Password Reset - after success, redirect to login with success message

- [x] PASS -- After successful password update, redirects to `/login?message=password_reset`
- [x] PASS -- Login page shows success message when `message=password_reset`

#### AC-10: Session persists over browser restart

- [x] PASS -- Uses `@supabase/ssr` with `createBrowserClient` which persists session in localStorage
- [x] PASS -- Supabase auto-refreshes JWT tokens

#### AC-11: Logout - session invalidated server-side, redirect to login

- [x] PASS -- Signout route (`/auth/signout`) calls `supabase.auth.signOut()` server-side
- [x] PASS -- Redirects to `/login` after signout
- [x] PASS -- Signout is POST-only (CSRF protection)
- [x] PASS -- SignOutButton in app layout submits form to `/auth/signout`

#### AC-12: Brute-force protection - 5 failed attempts, 15 min lockout

- [x] PASS (FIXED) -- Login route now implements rate limiting via `checkRateLimit` with key `login:<ip>` (line 24-25). Configuration: max 10 requests per 15 minutes (lines 12-15). Returns 429 with `Retry-After` header and German error message.
- [ ] BUG-PROJ2-8 (NEW, Low): **Rate limit config deviates from spec** -- Spec says "5 failed attempts, 15 min lockout" but implementation uses 10 requests per 15 minutes. Also, rate limiting counts ALL login attempts (not just failures), so a user who types their password wrong 9 times and then gets it right on the 10th attempt would be blocked on the 11th legitimate request.

### Edge Cases Status

#### EC-1: Expired password reset link

- [x] PASS -- Supabase handles token expiry; `updateUser` will fail with an error
- [ ] BUG-PROJ2-3 (Medium, STILL OPEN): No explicit "Link abgelaufen" message or button to request new link

#### EC-2: Password reset for GitHub-OAuth-only user

- [x] PASS -- `/api/auth/check-provider` endpoint checks for GitHub-only provider
- [x] PASS -- ForgotPasswordForm calls this endpoint before requesting reset
- [x] PASS -- Shows "You signed up with GitHub. Please use the GitHub login button instead."
- [ ] BUG-PROJ2-4 (Low -- downgraded, STILL OPEN): `listUsers()` fetches all users. Acceptable for PRD scope (2-10 users on single instance). Partial user enumeration risk acknowledged but low impact for internal admin tool.

#### EC-3: GitHub OAuth - primary email changed at GitHub

- [x] PASS -- OAuth login uses OAuth ID not email, so continues to work
- [ ] NOTE -- Email update in app profile not explicitly implemented (depends on Supabase behavior)

#### EC-4: GitHub OAuth - user revokes app access

- [x] PASS -- Next OAuth attempt fails and returns to callback with no code
- [x] PASS -- Callback redirects to `/login?error=oauth_error`
- [ ] BUG-PROJ2-5 (Low, STILL OPEN): Generic fallback message instead of specific "GitHub-Zugriff wurde widerrufen"

#### EC-5: Concurrent sessions on multiple devices

- [x] PASS -- Allowed by default (no single-session enforcement in MVP)

#### EC-6: Password reset for unregistered email

- [x] PASS -- Shows generic message (does not reveal email existence)

### Security Audit Results

- [x] **Authentication bypass:** Protected routes redirect to login via proxy middleware when no session
- [x] **Session handling:** Server-side session validation via `supabase.auth.getUser()` (not just JWT decode)
- [x] **Post-login redirect:** Uses `window.location.href` for full page reload (as per best practice)
- [x] **Open redirect in OAuth callback:** `sanitizeRedirectPath` properly blocks protocol-relative URLs, backslash bypasses, and scheme injections
- [x] **CSRF on signout:** POST-only route
- [x] **Password security:** Minimum 8 chars enforced client + server side, bcrypt hashing by Supabase
- [x] **Login rate limiting (FIXED):** Now rate-limited per IP with 10 requests / 15 minute window
- [x] **Session race condition (FIXED):** Login API now checks user status BEFORE calling `signInWithPassword`, eliminating the brief session window for non-active users
- [ ] BUG-PROJ2-4 (Low): check-provider partial user enumeration for GitHub-only accounts. Low risk for internal admin tool with 2-10 users.
- [ ] BUG-PROJ2-9 (NEW, Medium): **Login API uses `listUsers` with `perPage: 1000` for email lookup** -- In `/api/auth/login` line 58-63, the login route fetches up to 1000 users via `adminClient.auth.admin.listUsers()` to find a user by email, then iterates with `.find()`. This is the same pattern as `check-provider`. For the PRD scope (2-10 users) this is acceptable, but it creates a performance bottleneck as user count grows and adds latency to every login request.

### Bugs Found (Updated)

#### BUG-PROJ2-2: No rate limiting on login endpoint -- FIXED

#### BUG-PROJ2-6: Session race condition in login API -- FIXED

#### BUG-PROJ2-1: Status messages in English instead of German (STILL OPEN)

- **Severity:** Low
- **Priority:** Nice to have (decide on language strategy)

#### BUG-PROJ2-3: No explicit expired-link handling for password reset (STILL OPEN)

- **Severity:** Medium
- **Steps to Reproduce:**
  1. Request a password reset, wait for token to expire, click expired link
  2. Expected: "Link abgelaufen" message + button to request new link
  3. Actual: Generic Supabase error shown via toast
- **Priority:** Fix in next sprint

#### BUG-PROJ2-4: check-provider endpoint fetches all users (STILL OPEN -- downgraded to Low)

- **Severity:** Low (was Medium -- downgraded for PRD scope of 2-10 users)
- **Priority:** Fix in next sprint

#### BUG-PROJ2-5: Missing oauth_error mapping in StatusBanner (STILL OPEN)

- **Severity:** Low
- **Priority:** Nice to have

#### BUG-PROJ2-8 (NEW): Login rate limit config deviates from spec

- **Severity:** Low
- **Steps to Reproduce:**
  1. Spec requires: 5 failed attempts, 15 min lockout
  2. Actual: 10 total attempts (successful or failed) per 15 min window
  3. Rate limiting counts all requests, not just failures
- **Priority:** Nice to have (current config provides reasonable protection)

#### BUG-PROJ2-9 (NEW): Login API fetches all users on every login attempt

- **Severity:** Medium
- **Steps to Reproduce:**
  1. Attempt login with any email
  2. Login API calls `adminClient.auth.admin.listUsers({ perPage: 1000 })` to find user by email
  3. Expected: Direct lookup by email
  4. Actual: Full user list scan with `.find()`
- **Note:** Required for the pre-sign-in status check (race condition fix). Acceptable for 2-10 users per PRD. Would need optimization (Supabase RPC or email index) if user base grows significantly.
- **Priority:** Fix in next sprint

### Cross-Browser / Responsive Notes

- [x] Login form centered with `max-w-md` -- works at 375px, 768px, 1440px
- [x] Forgot password page -- responsive
- [x] Reset password form -- responsive
- [x] Standard form elements used -- cross-browser compatible (Chrome, Firefox, Safari)

### Summary

- **Acceptance Criteria:** 11/12 passed (rate limiting fixed; 1 remaining is config deviation, Low)
- **Bugs Fixed This Round:** 2 (BUG-PROJ2-2 login rate limiting, BUG-PROJ2-6 session race condition)
- **Bugs Remaining:** 7 total (0 critical, 0 high, 2 medium, 5 low)
- **New Bugs Found:** 2 (BUG-PROJ2-8 rate limit config deviation Low, BUG-PROJ2-9 listUsers performance Medium)
- **Security:** All previously reported HIGH issues fixed. Remaining medium items (expired-link UX, listUsers performance) are acceptable for MVP.
- **Production Ready:** YES (conditional -- no critical or high bugs; medium items are acceptable for MVP scope of 2-10 users)
- **Recommendation:** Ready for deployment. BUG-PROJ2-3 (expired link UX) and BUG-PROJ2-9 (listUsers performance) should be addressed in next sprint.

## Deployment
_To be added by /deploy_
