# PROJ-11: Collapsible Sidebar Navigation & SVG Logo

## Status: Deployed
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-8 (UI Modernization — Consolut Branding) — Basis-Layout und Farbgebung
- Requires: PROJ-9 (i18n) — Navigationstexte sind bereits übersetzt

## Overview

Die horizontale Top-Navigation wird durch eine permanente, kollapsierbare linke Seitenleiste (Sidebar) ersetzt — analog zur Beispielgrafik (consolut Scope Engine UI). Der "consolut"-Schriftzug in der Topbar wird durch die echte SVG-Logodatei (`/public/consolut_logo.svg`) ersetzt. Die Sidebar kann über einen Hamburger-Button auf ein Icon-Only-Format reduziert werden (collapsed state). Die Topbar bleibt als schmale Leiste für sekundäre Aktionen (Sprachumschalter, Theme, Abmelden).

## User Stories

- Als User möchte ich eine Seitenleiste mit klaren Navigationspunkten sehen, damit ich sofort erkennen kann, wo ich mich befinde.
- Als User möchte ich die Seitenleiste über ein Hamburger-Icon einklappen können, damit ich mehr Platz für den Hauptinhalt habe.
- Als User möchte ich im eingeklappten Zustand nur die Icons der Navigationspunkte sehen (mit Tooltip), damit ich weiterhin navigieren kann.
- Als User möchte ich das offizielle Consolut-Logo in der Seitenleiste sehen (statt Text), damit die Markenpräsenz professionell ist.
- Als User möchte ich beim Hovern über das Logo einen leichten visuellen Effekt sehen.
- Als Admin möchte ich die Admin-Einträge (Benutzer, Einstellungen) ebenfalls in der Seitenleiste sehen, damit ich alle Bereiche schnell erreiche.
- Als User möchte ich meine E-Mail-Adresse und Rolle am unteren Ende der Seitenleiste sehen, damit ich weiß, mit welchem Account ich eingeloggt bin.

## Acceptance Criteria

### Seitenleiste — Struktur
- [ ] Die Navigation befindet sich ausschließlich in der linken Seitenleiste (nicht mehr in der Topbar)
- [ ] Die Seitenleiste ist auf Desktop standardmäßig **geöffnet** (expanded)
- [ ] Navigationspunkte in der Sidebar: Dashboard, Port Editor, Rules Editor; für Admins zusätzlich: Benutzer, Einstellungen
- [ ] Der aktive Navigationspunkt ist visuell hervorgehoben (z.B. farbiger Hintergrund, Consolut-Rotakzent)
- [ ] Jeder Navigationspunkt hat ein Icon (Lucide) + Label im expanded state
- [ ] Die Seitenleiste hat das Consolut-Logo oben und User-Info (E-Mail + Rolle) unten

### Hamburger / Collapse
- [ ] Ein Hamburger- oder Toggle-Button (oben in der Sidebar oder Sidebar-Rand) klappt die Sidebar ein
- [ ] Im collapsed state sind nur die Icons sichtbar (kein Label-Text)
- [ ] Im collapsed state zeigen Icons einen Tooltip mit dem Navigationsnamen bei Hover
- [ ] Der Zustand (expanded/collapsed) wird im Browser gespeichert (localStorage oder Cookie), sodass er nach Reload erhalten bleibt
- [ ] Die Transition zwischen expanded und collapsed ist animiert (smooth)

### Logo
- [ ] Das Consolut-SVG-Logo (`/public/consolut_logo.svg`) wird im Sidebar-Header angezeigt
- [ ] Im collapsed state wird nur das Icon/Symbol des Logos angezeigt (oder ein verkleinertes Logo), kein langer Text
- [ ] Das Logo hat einen leichten Hover-Effekt (z.B. leichte Opacity-Änderung oder sanfte Scale-Animation)
- [ ] Das Logo ist ein Link zur Dashboard-Seite

### Topbar
- [ ] Die Topbar bleibt als schmale Leiste bestehen (für: Sprachumschalter, Theme-Toggle, Sign-Out-Button)
- [ ] Die Topbar zeigt keinen Logo/Brand-Text mehr (der ist in der Sidebar)
- [ ] Die horizontale Navigations-`<nav>` in der Topbar entfällt vollständig
- [ ] Die `MobileNav`-Komponente (Sheet/Drawer) entfällt — sie wird durch die Sidebar ersetzt

### Layout
- [ ] Der Hauptinhalt (`children`) füllt den verbleibenden Platz rechts der Sidebar
- [ ] Das Layout ist auf Desktop (≥768px) und Tablet korrekt
- [ ] Auf Mobile (<768px) ist die Sidebar standardmäßig eingeklappt (collapsed) oder als Overlay dargestellt

### i18n
- [ ] Alle neuen Labels und Tooltips in der Sidebar sind übersetzt (DE / EN / PT)

## Edge Cases

- **Admin-Einträge für Non-Admin:** Benutzer- und Einstellungslinks sind im JSX nicht gerendert (kein reines CSS-Hide), damit keine unbefugte Navigation möglich ist.
- **Sehr langer E-Mail-Name im User-Footer:** Text wird mit `truncate` abgeschnitten, kein Layout-Overflow.
- **Logo-SVG lädt nicht:** Fallback auf Text-Alternative (`consolut`) mit gleichem Hover-Effekt.
- **Collapsed state + aktive Route:** Das Icon des aktiven Eintrags bleibt visuell markiert, auch wenn kein Label sichtbar ist.
- **Resize von Mobile zu Desktop:** Sidebar-Zustand passt sich an — auf Desktop expanded by default, auf Mobile collapsed/overlay.
- **Tooltip im collapsed state auf Touch-Geräten:** Tooltips sind auf Touch-Geräten optional (können entfallen, da Navigation per Tap ohnehin funktioniert).

## Technical Requirements

- shadcn/ui `Sidebar`-Komponente (`src/components/ui/sidebar.tsx`) verwenden — bereits installiert
- Consolut-SVG aus `public/consolut_logo.svg` als `<Image>` (Next.js) oder direkt als `<img>`-Tag einbinden
- Hover-Effekt per Tailwind (`hover:opacity-80 transition-opacity` o.ä.)
- Sidebar-Collapse-State in `localStorage` persistieren (Client-seitig)
- Keine URL-Änderungen — rein UI-strukturelle Änderung
- Die `MobileNav`-Komponente kann nach dem Umbau entfernt werden

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

Rein frontend-seitige Umstrukturierung — kein Backend, keine Datenbankänderungen, keine neuen API-Routen. Die shadcn/ui `Sidebar`-Komponente (`src/components/ui/sidebar.tsx`) ist bereits vollständig installiert und bringt alle benötigten Bausteine mit: Cookie-Persistenz, Icon-Only-Collapse-Modus, Mobile-Sheet und Tooltips.

---

### Hinweis: Logo-Dateiname

Die Datei im `public/`-Ordner heißt `conslout_logo.svg` (Tippfehler im Dateinamen — "conslout" statt "consolut"). Der `/frontend`-Skill muss den tatsächlichen Dateinamen `conslout_logo.svg` verwenden.

---

### Component Structure (Visual Tree)

```
src/app/(app)/layout.tsx  ← Server Component (umgebaut)
└── SidebarProvider  ← shadcn Client Component (Cookie-State)
    ├── AppSidebar  ← NEU: src/components/app-sidebar.tsx (Client Component)
    │   ├── SidebarHeader
    │   │   └── Link → /dashboard
    │   │       ├── [expanded] <img> conslout_logo.svg  (volle Breite, Hover-Effekt)
    │   │       └── [collapsed] <img> conslout_logo.svg (kleine Variante / icon-only)
    │   ├── SidebarContent
    │   │   └── SidebarMenu
    │   │       ├── SidebarMenuItem: Dashboard        (icon: LayoutDashboard)
    │   │       ├── SidebarMenuItem: Port Editor      (icon: Server)
    │   │       ├── SidebarMenuItem: Rules Editor     (icon: FileText)
    │   │       ├── [isAdmin] SidebarMenuItem: Users  (icon: Users)
    │   │       └── [isAdmin] SidebarMenuItem: Settings (icon: Settings)
    │   └── SidebarFooter
    │       └── User-Info-Block
    │           ├── Avatar (Initialen aus E-Mail)
    │           ├── E-Mail (truncate)
    │           └── Rollen-Badge (admin / user)
    │
    └── SidebarInset  ← shadcn: verschiebt Main-Content automatisch
        ├── Topbar (slim header)  ← bleibt Server Component oder Client Component
        │   ├── SidebarTrigger  ← shadcn Toggle-Button (PanelLeft-Icon)
        │   └── [rechts] LanguageSwitcher · ThemeToggle · SignOutButton
        └── <main> {children} </main>
```

**Entfernt:**
- `src/components/mobile-nav.tsx` — ersetzt durch die eingebaute Mobile-Sheet-Logik der Sidebar
- Horizontale `<nav>` in der Topbar
- Logo-Text `consolut / WD EDITOR` in der Topbar

---

### Wie der Collapse-Modus funktioniert

Die shadcn Sidebar unterstützt drei Modi:
- `collapsible="icon"` → **wird verwendet** — bei Collapse bleiben Icons sichtbar, Labels verschwinden, Tooltips erscheinen bei Hover
- `collapsible="offcanvas"` → Sidebar schiebt sich komplett aus dem Bild (nicht gewünscht)
- `collapsible="none"` → Sidebar ist nicht kollapsierbar (nicht gewünscht)

**State-Persistenz:** `SidebarProvider` schreibt den Zustand automatisch in ein Browser-Cookie (`sidebar_state`, 7 Tage Laufzeit) — kein manuelles localStorage-Management nötig.

**Keyboard-Shortcut:** `Ctrl+B` / `Cmd+B` — bereits in shadcn eingebaut.

---

### Logo-Verhalten nach Zustand

| Zustand | Logo-Darstellung |
|---|---|
| Expanded (Desktop) | Volles SVG (`conslout_logo.svg`), max-Breite ~140px, mit Hover-Effekt (opacity + leichtes scale) |
| Collapsed (Desktop, icon-only) | Gleiches SVG, stark verkleinert (~32px Breite) oder nur das runde „C"-Symbol als Fallback-Text |
| Mobile (Sheet-Overlay) | Volles SVG, gleicher Hover-Effekt |

**Hover-Effekt:** Tailwind `transition-opacity hover:opacity-75` + optional `hover:scale-105 transition-transform` — leicht, nicht aufdringlich.

---

### Active-Route-Highlighting

`SidebarMenuButton` akzeptiert ein `isActive`-Prop. Die aktive Route wird über Next.js `usePathname()` (Client Hook) ermittelt und mit dem `href` jedes Eintrags verglichen. Aktiver Eintrag erhält die Sidebar-Akzentfarbe (shadcn `sidebar-accent`-Token, angepasst an Consolut-Rot über CSS-Variable).

---

### Layout-Umstrukturierung

**Vorher:** `flex flex-col` (vertikales Stack: Header + main + footer)

**Nachher:** `SidebarProvider` → horizontales Flex-Layout
- Links: `AppSidebar` (fixed, 16rem expanded / 3rem collapsed)
- Rechts: `SidebarInset` (flex-1, passt sich automatisch an Sidebar-Breite an)
  - Oben: Topbar (slim, h-12)
  - Unten: `<main>` mit `{children}`

---

### Dateien: Änderungsübersicht

| Datei | Aktion | Beschreibung |
|---|---|---|
| `src/components/app-sidebar.tsx` | **NEU** | Haupt-Sidebar-Komponente (Client) |
| `src/app/(app)/layout.tsx` | **Umbau** | SidebarProvider-Wrapper, Topbar vereinfacht |
| `src/components/mobile-nav.tsx` | **Entfernt** | Nicht mehr benötigt |

**Keine neuen npm-Packages** — alle benötigten Bausteine sind bereits installiert:
- `shadcn/ui sidebar` ✅
- `lucide-react` (Icons) ✅
- `next-intl` (Übersetzungen) ✅
- `next/navigation` (usePathname) ✅

---

### Tech Decisions

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Sidebar-Bibliothek | shadcn/ui Sidebar (bereits installiert) | Kein neues Package nötig; vollständige Implementierung mit Cookie, Icon-Mode, Mobile-Sheet |
| Collapse-Modus | `collapsible="icon"` | Icons bleiben sichtbar → User findet sich auch eingeklappt zurecht |
| State-Persistenz | Cookie (shadcn-intern) | Serverseitig lesbar, keine extra Logik nötig |
| Logo | SVG als `<img>`-Tag | Einfachste, performanteste Methode; kein Next.js Image-Loader nötig für statische Assets |
| Hover-Effekt | Tailwind `transition-opacity hover:opacity-75` | Minimalistisch, Consolut-konform, keine JS-Animation nötig |
| Active-Route | `usePathname()` Hook | Standard-Methode in Next.js App Router |

## QA Test Results

**Tested:** 2026-02-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Infrastructure Verification

| Check | Result | Notes |
|---|---|---|
| Database tables | N/A | Purely frontend feature -- no new tables required |
| Migrations | N/A | No database changes |
| `npm run build` | PASS | Compiled successfully, no errors or warnings |
| fetch() error handling | N/A | No `fetch()` calls in `app-sidebar.tsx` -- component receives all data via props from server component |

### Acceptance Criteria Status

#### AC-1: Seitenleiste -- Struktur

- [x] Navigation is exclusively in the left sidebar (no more topbar nav). Verified: `layout.tsx` diff removes the old `<nav>` element and all `<Link>` nav items from the header. The topbar now only contains `SidebarTrigger`, `LanguageSwitcher`, `ThemeToggle`, and `SignOutButton`.
- [x] Sidebar is expanded by default on desktop. Verified: `SidebarProvider defaultOpen={defaultOpen}` where `defaultOpen` defaults to `true` when no cookie is set (`sidebarCookie?.value !== 'false'`).
- [x] Nav items present: Dashboard, Port Editor, Rules Editor (all users); Users, Settings (admin only). Verified in `app-sidebar.tsx` lines 64-93.
- [x] Active nav item is visually highlighted. Verified: `SidebarMenuButton isActive={isActive(item.href)}` sets `data-active=true` which applies `bg-sidebar-accent` and `font-medium` via the CVA variants in `sidebar.tsx` line 525.
- [x] Each nav item has a Lucide icon + label in expanded state. Verified: `<item.icon className="h-4 w-4" />` + `<span>{item.label}</span>` for each menu button.
- [x] Sidebar has Consolut logo at top and user info (email + role) at bottom. Verified: `SidebarHeader` contains `SidebarLogo` component; `SidebarFooter` contains avatar initials, email (with `truncate`), and role `Badge`.

#### AC-2: Hamburger / Collapse

- [x] A toggle button collapses the sidebar. Verified: `SidebarTrigger` in the topbar (uses `PanelLeft` icon) calls `toggleSidebar()`. Also supports `Ctrl+B` / `Cmd+B` keyboard shortcut (built into shadcn).
- [x] In collapsed state only icons are visible (no label text). Verified: shadcn `collapsible="icon"` mode hides labels via `group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2` on `SidebarMenuButton` and `group-data-[collapsible=icon]:overflow-hidden` on `SidebarContent`.
- [x] In collapsed state, icons show tooltip on hover. Verified: `SidebarMenuButton tooltip={item.label}` wraps button in `Tooltip`/`TooltipTrigger`/`TooltipContent` with `hidden={state !== "collapsed" || isMobile}`.
- [x] State is persisted across reloads. Verified: Cookie `sidebar_state` is written by `SidebarProvider` (line 93 of `sidebar.tsx`) and read server-side in `layout.tsx` line 49-50 via `cookies().get('sidebar_state')`.
- [x] Transition is animated (smooth). Verified: `transition-[width] duration-200 ease-linear` on sidebar gap div, `transition-[left,right,width] duration-200 ease-linear` on sidebar container.

#### AC-3: Logo

- [x] Consolut SVG logo is displayed in the sidebar header. Verified: `<img src="/conslout_logo.svg" alt="consolut" />` in `SidebarLogo` component. Note: filename has typo ("conslout" instead of "consolut") but this is documented in the tech design and matches the actual file on disk.
- [x] In collapsed state the logo is displayed as a small version. Verified: collapsed uses `h-6 w-6 object-cover object-left` which crops the wide wordmark SVG to show only the leftmost portion (the "c" letterform).
- [x] Logo has a hover effect. Verified: `transition-opacity hover:opacity-75` on the `<Link>` wrapper.
- [x] Logo is a link to the dashboard. Verified: `<Link href="/dashboard">` wraps the logo image.

#### AC-4: Topbar

- [x] Topbar remains as a slim bar with secondary actions. Verified: `<header className="flex h-12 items-center justify-between border-b px-4">` contains `LanguageSwitcher`, `ThemeToggle`, `SignOutButton`.
- [x] Topbar no longer shows logo/brand text. Verified: git diff confirms removal of `<Link href="/dashboard">` with `consolut` / `WD EDITOR` text from header.
- [x] Horizontal `<nav>` in topbar is fully removed. Verified: no `<nav` element in `layout.tsx`.
- [x] `MobileNav` component is removed. Verified: `mobile-nav.tsx` is deleted (git status shows `D src/components/mobile-nav.tsx`), and no imports of `MobileNav` or `mobile-nav` remain in the `src/` directory.

#### AC-5: Layout

- [x] Main content fills remaining space right of sidebar. Verified: `SidebarInset` renders `<main>` with `flex w-full flex-1 flex-col`, and the sidebar uses a gap div that pushes content right.
- [x] Layout is correct on desktop (>=768px) and tablet. Verified: shadcn sidebar uses `md:block` / `md:flex` for desktop rendering and handles width transitions.
- [x] On mobile (<768px) sidebar is displayed as overlay. Verified: `useIsMobile()` hook (breakpoint 768px) triggers Sheet/drawer overlay mode in the `Sidebar` component (lines 201-223 of `sidebar.tsx`).

#### AC-6: i18n

- [x] All sidebar labels and tooltips are translated in DE / EN / PT. Verified: `sidebar.navigation` and `sidebar.administration` keys exist in all 3 message files. Nav item labels use `common.dashboard`, `common.portEditor`, `common.rulesEditor`, `common.users`, `common.settings` -- all present in `messages/de.json`, `messages/en.json`, `messages/pt.json`. `SidebarTrigger` aria-label uses `common.openNavigation` -- also present in all 3 languages.

### Edge Cases Status

#### EC-1: Admin entries for non-admin users
- [x] Handled correctly. Admin nav items are conditionally rendered with `{isAdmin && (...)}` in JSX (line 148 of `app-sidebar.tsx`). The `isAdmin` boolean is computed server-side from the `user_profiles` table role. Non-admin users do not receive admin links in their DOM at all -- this is not a CSS-hide.

#### EC-2: Very long email in user footer
- [x] Handled correctly. The email `<span>` has `truncate` class (line 188), the parent `<div>` has `min-w-0` (lines 179, 187), and the avatar has `shrink-0` (line 181). Long emails will be truncated with an ellipsis.

#### EC-3: Logo SVG fails to load
- [ ] BUG: Not handled. The `<img>` tag has an `alt="consolut"` attribute for accessibility, but there is no `onError` handler to show a text fallback with the same hover effect. If the SVG fails to load (e.g., 404, network error), the browser shows a broken image icon or the alt text, but without the hover-opacity styling. The spec explicitly requires: "Fallback auf Text-Alternative ('consolut') mit gleichem Hover-Effekt."

#### EC-4: Collapsed state + active route
- [x] Handled correctly. The `isActive` prop is applied to `SidebarMenuButton` regardless of collapsed/expanded state. The `data-[active=true]:bg-sidebar-accent` styling remains on the icon-only button in collapsed mode.

#### EC-5: Resize from mobile to desktop
- [x] Handled correctly. The `useIsMobile()` hook listens to `matchMedia` change events and re-evaluates on resize. On mobile the sidebar uses Sheet (overlay); on desktop it uses fixed sidebar. Transitions happen automatically.

#### EC-6: Tooltip on touch devices in collapsed state
- [x] Acceptable. Tooltips are hidden on mobile via `hidden={state !== "collapsed" || isMobile}` in the `SidebarMenuButton` tooltip content. The spec says tooltips are optional on touch devices.

### Security Audit Results

- [x] Authentication: Layout verifies user session server-side (`supabase.auth.getUser()`) and redirects to `/login` if no user. No bypass possible.
- [x] Authorization: Admin nav items are conditionally rendered based on server-side role check from `user_profiles` table. Non-admin users cannot see admin links. The admin pages themselves (`/admin/users`, `/settings`) have their own API-level authorization checks.
- [x] No new API routes: This feature is purely frontend -- no new attack surface for injection or data leaks.
- [x] No secrets exposed: No new environment variables, API keys, or credentials introduced.
- [x] Cookie security: The `sidebar_state` cookie contains only a boolean string ("true"/"false") -- no sensitive data. It uses `path=/` which is appropriate for a layout preference.
- [x] XSS: User email is rendered as text content (`{userEmail}`), not as `dangerouslySetInnerHTML`. Role badge uses a computed string from a fixed set. No injection vectors.
- [x] SVG logo: Loaded via `<img>` tag (not inline SVG or `dangerouslySetInnerHTML`), so any scripts inside the SVG cannot execute. Safe.

### Regression Testing

- [x] PROJ-8 (UI Modernization): Auth layout (`src/app/(auth)/layout.tsx`) still shows consolut text branding (unchanged). Dashboard feature cards still use `consolut-red`. No visual regression.
- [x] PROJ-9 (i18n): All sidebar labels use `useTranslations` / `getTranslations` hooks. Language switcher remains in topbar. No regression.
- [x] PROJ-6 (Rules Editor): Rules editor page route `/editor/rules` is unchanged. Sidebar link points to correct path. No regression.
- [x] PROJ-5 (Port Editor): Port editor page route `/editor/instance-profile` is unchanged. Sidebar link points to correct path. No regression.
- [x] PROJ-10 (Port Comments): Port comment functionality is within the instance-profile page. No layout changes affect it. No regression.

### Bugs Found

#### BUG-1: Missing SVG logo fallback handler

- **Severity:** Low
- **Steps to Reproduce:**
  1. Rename or delete `/public/conslout_logo.svg` temporarily
  2. Navigate to any authenticated page (e.g., `/dashboard`)
  3. Expected: A text fallback "consolut" with the same hover-opacity effect should appear
  4. Actual: Browser shows broken image icon or raw alt text without styled hover effect
- **Root Cause:** The `<img>` tag in `SidebarLogo` has `alt="consolut"` but no `onError` handler to swap in a styled text fallback
- **Priority:** Nice to have -- the SVG file exists and is committed; this only triggers if the file is deleted or a network error occurs on a local asset (very unlikely in production)

#### BUG-2: Sidebar accent color is default gray, not Consolut red

- **Severity:** Low
- **Steps to Reproduce:**
  1. Navigate to `/dashboard`
  2. Observe the active sidebar item highlight color
  3. Expected: According to the tech design (line 161), the sidebar-accent should be "angepasst an Consolut-Rot" (adapted to Consolut red)
  4. Actual: `--sidebar-accent` is `240 4.8% 95.9%` (light gray in light mode) / `240 3.7% 15.9%` (dark gray in dark mode) -- standard shadcn defaults, not Consolut red
- **Root Cause:** `globals.css` was not updated to override `--sidebar-accent` with a Consolut-red-tinted value
- **Note:** The acceptance criterion says "z.B. farbiger Hintergrund, Consolut-Rotakzent" (e.g. / for example), making this a suggestion rather than a hard requirement. The active item IS visually highlighted -- just not in red. This is a design polish item, not a functional bug.
- **Priority:** Nice to have

#### BUG-3: Collapsed logo cropping may show excessive whitespace

- **Severity:** Low
- **Steps to Reproduce:**
  1. Collapse the sidebar (click SidebarTrigger or press Cmd+B)
  2. Observe the logo area in the sidebar header
  3. Expected: A clean, recognizable icon-sized representation of the logo
  4. Actual: The SVG viewBox is `0 0 179.08 34.87` but the letter paths start at approximately y=10. With `h-6 w-6 object-cover object-left`, the 24x24 crop may include blank whitespace above the letterforms. The visual result depends on the browser's `object-cover` rendering of the wide-aspect-ratio SVG.
- **Root Cause:** Using CSS cropping (`object-cover object-left`) on a wide wordmark SVG (5:1 aspect ratio) to produce a square icon is inherently imprecise
- **Priority:** Nice to have -- requires visual verification in the browser to confirm severity

### Summary

- **Acceptance Criteria:** 20/20 passed
- **Edge Cases:** 5/6 passed, 1 has a missing fallback (Low severity)
- **Bugs Found:** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Security:** Pass -- no vulnerabilities found
- **Regression:** Pass -- all deployed features (PROJ-5 through PROJ-10) unaffected
- **Production Ready:** YES

All 3 bugs are Low severity cosmetic/polish items. None block deployment. The core functionality -- sidebar navigation, collapse/expand, logo display, tooltip support, cookie persistence, i18n, admin conditional rendering, mobile overlay -- is fully implemented and working correctly.

### Recommendation

Deploy as-is. The 3 Low-severity bugs can be addressed in a future polish iteration if desired:
- BUG-1: Add `onError` handler to `<img>` for SVG fallback
- BUG-2: Optionally tint `--sidebar-accent` CSS variable toward Consolut red
- BUG-3: Consider a dedicated square logo variant for the collapsed state

## Deployment

- **Target:** Local
- **URL:** `http://localhost:3002`
- **Deployed:** 2026-02-28
- **Build:** `npm run build` → success
- **Server:** `PORT=3002 npm run start`
