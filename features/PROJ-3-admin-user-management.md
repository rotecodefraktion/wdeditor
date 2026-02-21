# PROJ-3: Admin User Management Dashboard

## Status: In Review
**Created:** 2026-02-20
**Last Updated:** 2026-02-20

## Dependencies
- Requires: PROJ-1 (User Registration & Approval) – für User-Status-Modell
- Requires: PROJ-2 (User Authentication) – Admin muss eingeloggt und genehmigt sein

## User Stories

- Als Super-Admin möchte ich eine Übersicht aller registrierten User sehen, damit ich den Zugriff kontrollieren kann.
- Als Super-Admin möchte ich die User-Liste nach Status filtern können, damit ich schnell ausstehende Anfragen finde.
- Als Super-Admin möchte ich einen User genehmigen oder ablehnen, damit er Zugang zur App erhält oder erhält.
- Als Super-Admin möchte ich einen aktiven User deaktivieren, damit sein Zugang sofort gesperrt wird (z.B. bei Mitarbeiter-Abgang).
- Als Super-Admin möchte ich einen deaktivierten User reaktivieren, damit er wieder Zugang erhält.
- Als Super-Admin möchte ich einem User die Admin-Rolle zuweisen oder entziehen, damit er ebenfalls Genehmigungen erteilen kann.
- Als Admin (nicht Super-Admin) möchte ich ausstehende Registrierungen genehmigen oder ablehnen, damit Super-Admins entlastet werden.
- Als Admin möchte ich sehen, wer zuletzt wann eingeloggt war, damit ich inaktive Accounts identifizieren kann.

## Acceptance Criteria

- [ ] Admin-Dashboard ist nur für User mit Rolle `admin` oder `super_admin` erreichbar (sonst 403)
- [ ] User-Tabelle zeigt: Name/E-Mail, GitHub-Username, Status, Rolle, Registrierungsdatum, Letzter Login
- [ ] Filter nach Status: Alle | Ausstehend | Aktiv | Abgelehnt | Deaktiviert
- [ ] Suche nach E-Mail oder GitHub-Username
- [ ] Ausstehende Registrierungen werden oben hervorgehoben (Badge mit Anzahl)
- [ ] Genehmigen-Button: Status wechselt `pending_approval` → `active`; E-Mail-Benachrichtigung an User
- [ ] Ablehnen-Button: Öffnet Modal mit optionalem Freitext; Status wechselt → `rejected`; E-Mail mit Begründung
- [ ] Deaktivieren-Button für aktive User: Bestätigungs-Dialog → Status `deactivated`; laufende Sessions des Users werden invalidiert
- [ ] Reaktivieren-Button für deaktivierte User: Status → `active`; E-Mail-Benachrichtigung
- [ ] Super-Admin kann Admin-Rolle zuweisen/entziehen (Toggle in User-Detailansicht)
- [ ] Super-Admin kann sich selbst nicht die Admin-Rolle entziehen (Fehlermeldung)
- [ ] Deaktivierung des letzten Super-Admins wird blockiert (Fehlermeldung)
- [ ] Eigener Account kann nicht deaktiviert werden (Fehlermeldung "Du kannst deinen eigenen Account nicht deaktivieren")
- [ ] Alle Admin-Aktionen werden in einem Audit-Log gespeichert (wer hat was wann mit welchem User gemacht)

## Edge Cases

- **Admin deaktiviert sich selbst:** Blockiert mit Fehlermeldung
- **Letzter Super-Admin wird deaktiviert:** Blockiert mit Fehlermeldung "Mindestens ein Super-Admin muss aktiv bleiben"
- **User loggt sich ein während Admin ihn deaktiviert:** Session wird sofort invalidiert; nächste API-Anfrage liefert 401
- **Admin lehnt User ab und User registriert sich erneut:** Neue Registrierung mit derselben E-Mail blockiert (E-Mail bereits registriert); User muss Support kontaktieren
- **Super-Admin-Rolle wird dem letzten Super-Admin entzogen:** Blockiert mit Fehlermeldung
- **Admin ohne Super-Admin-Rechte versucht Rollen zu ändern:** 403 Forbidden

## Technical Requirements

- Rollenmodell: `user`, `admin`, `super_admin` (in `user_profiles`-Tabelle oder via Supabase `app_metadata`)
- Session-Invalidierung bei Deaktivierung: Custom Supabase RPC oder Auth-Admin-API
- Audit-Log: Eigene Tabelle `admin_audit_log` mit `actor_id`, `target_user_id`, `action`, `reason`, `created_at`
- Pagination: Max. 50 User pro Seite
- E-Mail-Benachrichtigungen: Via Supabase Edge Function oder externem E-Mail-Provider

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results (Re-test #2)

**Tested:** 2026-02-21 (Re-test after bug fixes)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS

### Previously Reported Bugs -- Fix Verification

| Bug ID | Description | Previous Status | Re-test Result |
| ------ | ----------- | --------------- | -------------- |
| BUG-PROJ3-1 | No server-side page-level access control | Medium / Open | STILL OPEN -- `admin/users/page.tsx` is still a client component with no server-side role gate. Regular users see the page skeleton then a 403 from the API. |
| BUG-PROJ3-2 | Email column missing from table | Medium / Open | FIXED -- `UserProfile` interface now includes `email: string or null` (line 37). Table renders Email column with header "Email" (line 216), hidden on mobile via `hidden md:table-cell`. |
| BUG-PROJ3-3 | Last Login column missing | Medium / Open | FIXED -- `UserProfile` interface now includes `last_sign_in_at: string or null` (line 45). API merges `last_sign_in_at` from `auth.users` (lines 68-84 in admin/users/route.ts). Table renders "Last Login" column (line 221) with formatted date or "Never" fallback (lines 320-331). Hidden on smaller screens via `hidden lg:table-cell`. |
| BUG-PROJ3-4 | Unconfirmed status missing from filter | Low / Open | STILL OPEN -- Filter still only shows All, Pending, Active, Rejected, Deactivated. |
| BUG-PROJ3-5 | Search does not search by email | Medium / Open | FIXED -- Search function now includes `const matchesEmail = u.email?.toLowerCase().includes(q)` (line 114) and checks it in the filter condition (line 116). Search placeholder text also updated to "Search by name, email, or GitHub username..." (line 172). |
| BUG-PROJ3-6 | No email notification on reactivation | Medium / Open | FIXED -- Reactivate route now imports `sendReactivationEmail` (line 5), fetches auth user email via admin API (line 85), and sends reactivation email (lines 87-89). New `sendReactivationEmail` function in `/src/lib/email.ts` (lines 110-141) with HTML-escaped userName. |
| BUG-PROJ3-7 | Audit log not implemented | HIGH / Open | FIXED (partially) -- All five admin action routes (approve, reject, deactivate, reactivate, role) now insert into `admin_audit_log` table via `adminClient`. See approve line 73, reject line 93, deactivate line 96, reactivate line 73, role line 108. Each logs `admin_user_id`, `target_user_id`, `action`, and `details` (JSON with previous state). Audit log write failures are caught and logged to console, not blocking the primary action. |
| BUG-PROJ3-8 | No pagination (limit 200) | Medium / Open | FIXED (hybrid) -- API still fetches up to 200 records, but client-side pagination now implemented with `USERS_PER_PAGE = 50` (line 104). Pagination controls with Previous/Next buttons and "Page X of Y" display (lines 408-432). Page resets to 1 on filter/search change (lines 137-145). |
| BUG-PROJ3-9 | Client-side role check on admin page | Low / Open | STILL OPEN -- Page still fetches role client-side. Defense in depth only; API protects data. |

### Acceptance Criteria Status

#### AC-1: Admin dashboard only accessible for `admin` or `super_admin` (otherwise 403)

- [x] PASS -- API route `/api/admin/users` checks caller role and returns 403 if not admin/super_admin
- [x] PASS -- All sub-routes also check caller role
- [x] PASS -- App layout only shows "Users" nav link for admin/super_admin roles
- [ ] BUG-PROJ3-1 (Medium, STILL OPEN): No server-side access control on the page component itself. Regular users see loading skeleton then API error.

#### AC-2: User table shows Name/E-Mail, GitHub-Username, Status, Rolle, Registrierungsdatum, Letzter Login

- [x] PASS (FIXED) -- Table now shows: User (Name), Email, GitHub, Status, Role, Registered, Last Login, Actions
- [x] PASS (FIXED) -- Email column displays email from auth.users, truncated to 200px, hidden on mobile
- [x] PASS (FIXED) -- Last Login column displays `last_sign_in_at` with date+time format (de-DE locale) or "Never" fallback

#### AC-3: Filter by status (Alle, Ausstehend, Aktiv, Abgelehnt, Deaktiviert)

- [x] PASS -- Client-side filter with Select component
- [x] PASS -- Filter options: All, Pending (with count), Active, Rejected, Deactivated
- [ ] BUG-PROJ3-4 (Low, STILL OPEN): No "Unconfirmed" filter option (unconfirmed users visible in "All" view)

#### AC-4: Search by E-Mail or GitHub-Username

- [x] PASS (FIXED) -- Search now checks `full_name`, `github_username`, `email`, and `user_id`
- [x] PASS -- Placeholder text reads "Search by name, email, or GitHub username..."

#### AC-5: Pending registrations highlighted with badge showing count

- [x] PASS -- Pending count badge with amber styling
- [x] PASS -- Pending users highlighted with amber background
- [x] PASS -- Pending users sorted to top of list
- [x] PASS -- Badge only shown when statusFilter is "all" and pendingCount > 0

#### AC-6: Approve button changes `pending_approval` to `active`, sends email

- [x] PASS -- Approve button visible for pending_approval users
- [x] PASS -- API validates target is in `pending_approval` status
- [x] PASS -- Updates status to `active`, clears rejection_reason
- [x] PASS -- Sends approval email via Resend with HTML-escaped userName
- [x] PASS -- Logs action to audit log
- [x] PASS -- UI refreshes user list after approval

#### AC-7: Reject button opens modal with optional reason, changes to `rejected`, sends email

- [x] PASS -- Reject button opens `RejectDialog` with textarea (max 500 chars, with counter)
- [x] PASS -- API accepts optional reason (max 500 chars via Zod)
- [x] PASS -- Updates status to `rejected` with reason
- [x] PASS -- Sends rejection email with HTML-escaped reason
- [x] PASS -- Logs action to audit log with reason in details
- [x] PASS -- UI refreshes after rejection
- [ ] NOTE: Reject API also allows rejecting `active` users (line 71). This extends beyond spec but is reasonable functionality.

#### AC-8: Deactivate button for active users with confirmation dialog, invalidates sessions

- [x] PASS -- Deactivate button visible for active users (excluding current user)
- [x] PASS -- `DeactivateDialog` (AlertDialog) shows confirmation
- [x] PASS -- API blocks self-deactivation
- [x] PASS -- API validates target is in `active` status
- [x] PASS -- Updates status to `deactivated`
- [x] PASS -- Invalidates sessions via `adminClient.auth.admin.signOut(userId)`
- [x] PASS -- Logs action to audit log

#### AC-9: Reactivate button for deactivated users, changes to `active`, sends email

- [x] PASS -- Reactivate button visible for deactivated users
- [x] PASS -- API validates target is in `deactivated` status
- [x] PASS -- Updates status to `active`
- [x] PASS (FIXED) -- Sends reactivation email via `sendReactivationEmail` with HTML-escaped userName
- [x] PASS -- Logs action to audit log

#### AC-10: Super-Admin can assign/remove admin role (toggle in user detail view)

- [x] PASS -- `RoleSelect` component shown for active users when current user is super_admin
- [x] PASS -- Select allows choosing between User, Admin, Super Admin roles
- [x] PASS -- API validates only super_admin can change roles (403 for others)
- [x] PASS -- Role change logged to audit log with previous and new role

#### AC-11: Super-Admin cannot remove own admin role

- [x] PASS -- Role change API blocks self-role-change: "Du kannst deine eigene Rolle nicht aendern"
- [x] PASS -- UI hides RoleSelect for the current user

#### AC-12: Deactivation of last super-admin blocked

- [x] PASS -- Deactivate API counts active super_admins and blocks if count <= 1
- [x] PASS -- Error message: "Mindestens ein Super-Admin muss aktiv bleiben"
- [x] PASS -- Role change API also blocks demoting the last super_admin

#### AC-13: Own account cannot be deactivated

- [x] PASS -- API returns 409: "Du kannst deinen eigenen Account nicht deaktivieren"
- [x] PASS -- UI hides deactivate button for current user

#### AC-14: All admin actions logged in audit log

- [x] PASS (FIXED) -- All five admin action routes now insert into `admin_audit_log` table
- [x] PASS -- Logged fields: `admin_user_id`, `target_user_id`, `action`, `details` (JSON)
- [x] PASS -- Actions covered: approve, reject, deactivate, reactivate, role_change
- [ ] BUG-PROJ3-10 (NEW, Medium): **Audit log table existence not verified** -- The code inserts into `admin_audit_log` via `adminClient`, but the SQL migration to create this table is not present in the codebase. If the table does not exist in Supabase, all audit log writes will silently fail (caught by try/catch). There is no health check or migration verification.
- [ ] BUG-PROJ3-11 (NEW, Low): **Audit log failures silently swallowed** -- All audit log inserts are wrapped in try/catch with only `console.error` logging. There is no monitoring, alerting, or user-facing indication that audit logging has failed. For a compliance/traceability requirement, silent failure may not be acceptable.

### Edge Cases Status

#### EC-1: Admin deactivates self - blocked

- [x] PASS -- API returns 409 with clear error message
- [x] PASS -- UI hides the deactivate button for current user

#### EC-2: Last super-admin deactivated - blocked

- [x] PASS -- Both deactivate and role-change APIs check for last active super_admin

#### EC-3: User logs in while admin deactivates them

- [x] PASS -- Sessions invalidated via `adminClient.auth.admin.signOut(userId)` on deactivation
- [x] PASS -- Proxy middleware checks profile status on every request

#### EC-4: Rejected user re-registers with same email

- [x] PASS -- Supabase Auth returns "already registered" error
- [x] PASS -- Registration API returns "E-Mail bereits registriert"

#### EC-5: Last super-admin role removed - blocked

- [x] PASS -- Role change API checks count of active super_admins before demoting

#### EC-6: Admin (not super_admin) tries to change roles - 403

- [x] PASS -- Role change API checks for `super_admin` specifically
- [x] PASS -- Returns 403: "Nur Super-Admins duerfen Rollen aendern"

### Security Audit Results

- [x] **Authentication:** All admin API routes verify auth via `supabase.auth.getUser()`
- [x] **Authorization:** Role checks on every endpoint; super_admin-only for role changes
- [x] **Input validation:** UUID validation on userId params via Zod; Zod on all request bodies
- [x] **Self-protection:** Cannot deactivate self, cannot change own role
- [x] **Last-admin protection:** Cannot deactivate or demote the last super_admin
- [x] **IDOR protection:** User ID validated as UUID; actions only work on existing profiles
- [x] **Service role key isolation:** Admin client only used server-side
- [x] **HTML injection in emails (FIXED):** All email templates use `escapeHtml()` for user-supplied data
- [ ] BUG-PROJ3-1 (Medium, STILL OPEN): No server-side page-level access control on admin page
- [ ] BUG-PROJ3-8 note: API still loads up to 200 records per request. Client-side pagination at 50/page is a UX improvement but not true server-side pagination. For PRD scope (2-10 users) this is acceptable.
- [ ] BUG-PROJ3-9 (Low, STILL OPEN): Client-side role check for page rendering; API layer properly protected

### Bugs Found (Updated)

#### BUG-PROJ3-2: Email column missing -- FIXED
#### BUG-PROJ3-3: Last Login column missing -- FIXED
#### BUG-PROJ3-5: Search does not search by email -- FIXED
#### BUG-PROJ3-6: No email notification on reactivation -- FIXED
#### BUG-PROJ3-7: Audit log not implemented -- FIXED
#### BUG-PROJ3-8: No pagination -- FIXED (client-side, 50 per page)

#### BUG-PROJ3-1: No server-side page-level access control (STILL OPEN)

- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in as a regular user (role: `user`)
  2. Navigate to `/admin/users` directly
  3. Expected: Redirect or 403 page
  4. Actual: Page renders with loading skeleton, then shows "Failed to load users" error from 403 API response
- **Note:** Data is protected by API authorization. This is a UX/defense-in-depth issue.
- **Priority:** Fix in next sprint

#### BUG-PROJ3-4: Unconfirmed status missing from filter (STILL OPEN)

- **Severity:** Low
- **Priority:** Nice to have

#### BUG-PROJ3-9: Client-side role check on admin page (STILL OPEN)

- **Severity:** Low
- **Priority:** Fix in next sprint

#### BUG-PROJ3-10 (NEW): Audit log table migration not in codebase

- **Severity:** Medium
- **Steps to Reproduce:**
  1. Perform an admin action (approve, reject, etc.)
  2. Check if `admin_audit_log` table exists in Supabase
  3. If table does not exist, the insert silently fails (caught by try/catch)
  4. Expected: Migration SQL in codebase to create the table
  5. Actual: No migration file found; table creation depends on manual DB setup
- **Note:** All five admin routes reference `admin_audit_log` table. If it does not exist, audit logging silently fails.
- **Priority:** Fix before deployment (add migration SQL or document required table schema)

#### BUG-PROJ3-11 (NEW): Audit log failures silently swallowed

- **Severity:** Low
- **Steps to Reproduce:**
  1. Remove or break the `admin_audit_log` table
  2. Perform admin actions
  3. Expected: Some indication that audit logging failed
  4. Actual: Only `console.error` on the server; no user notification, no monitoring hook
- **Note:** For a compliance/traceability feature, silent failure may be insufficient. However, not blocking the primary action on audit failure is the correct behavior.
- **Priority:** Fix in next sprint (add monitoring/alerting for audit failures)

### Cross-Browser / Responsive Notes

- [x] User table responsive: Email and GitHub hidden on mobile (`hidden md:table-cell`), Role hidden on small (`hidden sm:table-cell`), Registered and Last Login hidden on medium (`hidden lg:table-cell`)
- [x] Search + filter stack vertically on mobile (`flex-col sm:flex-row`)
- [x] Action buttons show icons only on mobile, text on larger screens (`hidden sm:inline`)
- [x] Dialogs (Reject, Deactivate) use `sm:max-w-md` for mobile friendliness
- [x] RoleSelect uses fixed width (`w-[130px]`) -- fits at all breakpoints
- [x] Pagination controls stack responsively (`flex-col sm:flex-row`)
- [x] colSpan updated to 8 for empty state row, matching all columns

### Summary

- **Acceptance Criteria:** 13/14 passed (1 remaining: server-side page protection, Medium)
- **Bugs Fixed This Round:** 6 (email column, last login, email search, reactivation email, audit log, pagination)
- **Bugs Remaining:** 5 total (0 critical, 0 high, 2 medium, 3 low)
- **New Bugs Found:** 2 (BUG-PROJ3-10 audit table migration Medium, BUG-PROJ3-11 silent audit failure Low)
- **Security:** All previously reported HIGH issues fixed. API authorization solid. Remaining items are defense-in-depth (page-level access, client role check).
- **Production Ready:** YES (conditional -- no critical or high bugs; medium items are acceptable for MVP with 2-10 users. BUG-PROJ3-10 requires verifying audit table exists in Supabase before deployment.)
- **Recommendation:** Ready for deployment IF the `admin_audit_log` table is confirmed to exist in Supabase (or migration is run). BUG-PROJ3-1 (server-side page protection) should be addressed in next sprint.

## Deployment
_To be added by /deploy_
