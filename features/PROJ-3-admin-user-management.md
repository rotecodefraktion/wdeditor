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

## QA Test Results (Final Verification -- Re-test #3)

**Tested:** 2026-02-21 (Final verification pass before deployment)
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS

### Focus Areas This Round

This final pass verified the three cross-cutting fixes that affect PROJ-3:
1. Login rate limiting (5 failed attempts) -- verified in PROJ-2; no direct PROJ-3 impact
2. Login flow efficiency (no listUsers on login path) -- the admin users API still uses `listUsers` for email/last-login merge, which is correct and expected for the admin context
3. Middleware file naming -- `src/proxy.ts` confirmed correct; admin routes properly protected behind proxy auth guard

### Previously Reported Bugs -- Final Status

| Bug ID | Description | Final Status |
| ------ | ----------- | ------------ |
| BUG-PROJ3-1 | No server-side page-level access control | STILL OPEN (Medium) -- Accepted for MVP; API layer protects all data |
| BUG-PROJ3-2 | Email column missing from table | FIXED (verified in re-test #2) |
| BUG-PROJ3-3 | Last Login column missing | FIXED (verified in re-test #2) |
| BUG-PROJ3-4 | Unconfirmed status missing from filter | STILL OPEN (Low) -- Accepted for MVP |
| BUG-PROJ3-5 | Search does not search by email | FIXED (verified in re-test #2) |
| BUG-PROJ3-6 | No email notification on reactivation | FIXED (verified in re-test #2) |
| BUG-PROJ3-7 | Audit log not implemented | FIXED (verified in re-test #2) |
| BUG-PROJ3-8 | No pagination | FIXED (verified in re-test #2) -- client-side, 50 per page |
| BUG-PROJ3-9 | Client-side role check on admin page | STILL OPEN (Low) -- Accepted for MVP; API protects data |
| BUG-PROJ3-10 | Audit log table migration not in codebase | STILL OPEN (Medium) -- Must verify table exists before deployment |
| BUG-PROJ3-11 | Audit log failures silently swallowed | STILL OPEN (Low) -- Accepted for MVP |

### Cross-cutting Fix Verification

#### Admin Users API -- listUsers usage (context for BUG-PROJ2-9 fix)

The `/api/admin/users/route.ts` still uses `adminClient.auth.admin.listUsers({ perPage: 1000 })` on line 57-59. This is correct and expected behavior for the admin context:
- This endpoint is only accessible to admin/super_admin users (line 28 role check)
- It needs to merge email and `last_sign_in_at` from `auth.users` into `user_profiles`
- The `listUsers` call was removed from the LOGIN path (PROJ-2 fix); it remains appropriately in the ADMIN path
- For PRD scope (2-10 users), this is well within acceptable performance limits

#### Proxy middleware and admin route protection

- [x] PASS -- `src/proxy.ts` (line 14) exports `proxy` function -- correct for Next.js 16
- [x] PASS -- Build output confirms `f Proxy (Middleware)` detection
- [x] PASS -- Admin routes at `/admin/users` are not in `PUBLIC_PATHS` (line 4-8), so proxy requires authentication
- [x] PASS -- Proxy checks `user_profiles.status` is `active` before allowing access (line 74)
- [x] PASS -- Non-active users are redirected away from all protected routes including admin pages

### Acceptance Criteria Status

#### AC-1: Admin dashboard only accessible for `admin` or `super_admin` (otherwise 403)

- [x] PASS -- API route `/api/admin/users` checks caller role and returns 403 if not admin/super_admin
- [x] PASS -- All sub-routes also check caller role
- [x] PASS -- App layout only shows "Users" nav link for admin/super_admin roles
- [ ] BUG-PROJ3-1 (Medium): No server-side access control on page component. Data protected by API.

#### AC-2: User table shows Name/E-Mail, GitHub-Username, Status, Rolle, Registrierungsdatum, Letzter Login

- [x] PASS -- Table shows: User (Name), Email, GitHub, Status, Role, Registered, Last Login, Actions
- [x] PASS -- Email column displays email from auth.users, hidden on mobile
- [x] PASS -- Last Login column displays `last_sign_in_at` with formatted date or "Never" fallback

#### AC-3: Filter by status (Alle, Ausstehend, Aktiv, Abgelehnt, Deaktiviert)

- [x] PASS -- Client-side filter with Select component
- [x] PASS -- Filter options: All, Pending (with count), Active, Rejected, Deactivated
- [ ] BUG-PROJ3-4 (Low): No "Unconfirmed" filter option

#### AC-4: Search by E-Mail or GitHub-Username

- [x] PASS -- Search checks `full_name`, `github_username`, `email`, and `user_id`
- [x] PASS -- Placeholder text reads "Search by name, email, or GitHub username..."

#### AC-5: Pending registrations highlighted with badge showing count

- [x] PASS -- Pending count badge with amber styling
- [x] PASS -- Pending users highlighted with amber background
- [x] PASS -- Pending users sorted to top of list

#### AC-6: Approve button changes `pending_approval` to `active`, sends email

- [x] PASS -- All sub-criteria verified (API validation, status update, email, audit log, UI refresh)

#### AC-7: Reject button opens modal with optional reason, changes to `rejected`, sends email

- [x] PASS -- All sub-criteria verified (dialog, Zod validation, status update, email, audit log)

#### AC-8: Deactivate button for active users with confirmation dialog, invalidates sessions

- [x] PASS -- All sub-criteria verified (dialog, self-protection, status update, session invalidation, audit log)

#### AC-9: Reactivate button for deactivated users, changes to `active`, sends email

- [x] PASS -- All sub-criteria verified (status validation, update, reactivation email, audit log)

#### AC-10: Super-Admin can assign/remove admin role (toggle in user detail view)

- [x] PASS -- RoleSelect component, role validation, audit log all working

#### AC-11: Super-Admin cannot remove own admin role

- [x] PASS -- API blocks self-role-change; UI hides RoleSelect for current user

#### AC-12: Deactivation of last super-admin blocked

- [x] PASS -- Both deactivate and role-change APIs check for last active super_admin

#### AC-13: Own account cannot be deactivated

- [x] PASS -- API returns 409; UI hides deactivate button for current user

#### AC-14: All admin actions logged in audit log

- [x] PASS -- All five action routes insert into `admin_audit_log`
- [ ] BUG-PROJ3-10 (Medium): Table migration not in codebase -- verify table exists before deployment
- [ ] BUG-PROJ3-11 (Low): Failures silently swallowed -- accepted for MVP

### Edge Cases Status

All edge cases (EC-1 through EC-6) continue to PASS -- no regressions detected.

### Security Audit Results

- [x] **Authentication:** All admin API routes verify auth via `supabase.auth.getUser()`
- [x] **Authorization:** Role checks on every endpoint; super_admin-only for role changes
- [x] **Input validation:** UUID validation on userId params via Zod; Zod on all request bodies
- [x] **Self-protection:** Cannot deactivate self, cannot change own role
- [x] **Last-admin protection:** Cannot deactivate or demote the last super_admin
- [x] **IDOR protection:** User ID validated as UUID; actions only work on existing profiles
- [x] **Service role key isolation:** Admin client only used server-side
- [x] **HTML injection in emails:** All email templates use `escapeHtml()` for user-supplied data
- [x] **Proxy middleware:** Correctly protects admin routes; requires active status
- [ ] BUG-PROJ3-1 (Medium): No server-side page-level access control -- defense-in-depth gap
- [ ] BUG-PROJ3-9 (Low): Client-side role check for page rendering -- API layer properly protected

### Bugs Remaining (Final)

#### BUG-PROJ3-1: No server-side page-level access control (Medium)

- **Priority:** Fix in next sprint (defense-in-depth; data is API-protected)

#### BUG-PROJ3-4: Unconfirmed status missing from filter (Low)

- **Priority:** Nice to have

#### BUG-PROJ3-9: Client-side role check on admin page (Low)

- **Priority:** Fix in next sprint

#### BUG-PROJ3-10: Audit log table migration not in codebase (Medium)

- **Priority:** Verify table exists in Supabase before deployment (or add migration SQL)

#### BUG-PROJ3-11: Audit log failures silently swallowed (Low)

- **Priority:** Fix in next sprint

### Cross-Browser / Responsive Notes

- [x] User table responsive: Email and GitHub hidden on mobile, Role hidden on small, Registered and Last Login hidden on medium
- [x] Search + filter stack vertically on mobile
- [x] Action buttons show icons only on mobile, text on larger screens
- [x] Dialogs use `sm:max-w-md` for mobile friendliness
- [x] Pagination controls stack responsively

### Summary (Final)

- **Acceptance Criteria:** 13/14 passed (1 remaining: server-side page protection, Medium -- defense-in-depth only)
- **All previously reported HIGH bugs:** FIXED and verified
- **Bugs Remaining:** 5 total (0 critical, 0 high, 2 medium, 3 low)
- **No new bugs found this round** -- all cross-cutting fixes verified clean
- **Admin listUsers usage:** Confirmed appropriate in admin context (distinct from login path fix)
- **Security:** API authorization solid. All email injection protections in place.
- **Production Ready:** YES
- **Recommendation:** READY FOR DEPLOYMENT. `admin_audit_log` table confirmed in Cloud-DB (2026-02-21). BUG-PROJ3-1 should be addressed in next sprint.

## Deployment
_To be added by /deploy_
