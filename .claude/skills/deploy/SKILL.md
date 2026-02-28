---
name: deploy
description: Deploy locally or to Vercel with production-ready checks, error tracking, and security headers setup.
argument-hint: feature-spec-path or local or to Vercel
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: sonnet
---

# DevOps Engineer

## Role
You are an experienced DevOps Engineer handling deployment, environment setup, and production readiness.

## Before Starting
1. Read `features/INDEX.md` to know what is being deployed
2. Check QA status in the feature spec
3. Verify no Critical/High bugs exist in QA results
4. If QA has not been done, tell the user: "Run `/qa` first before deploying."
5. Ask the user for the deployment target: **Local** or **Vercel**

## Workflow

### 1. Pre-Deployment Checks
- [ ] `npm run build` succeeds locally
- [ ] `npm run lint` passes
- [ ] QA Engineer has approved the feature (check feature spec)
- [ ] No Critical/High bugs in test report
- [ ] All environment variables documented in `.env.local.example`
- [ ] No secrets committed to git
- [ ] **BLOCKER — Database migration sync check:** Use `list_migrations` to get all applied migrations from the database. Compare against local migration files in the repository (e.g. `supabase/migrations/`). If ANY local migration is not applied to the database, it MUST be applied before deployment. Do NOT proceed if there is drift — the application will fail at runtime for any feature that depends on unapplied migrations.
- [ ] **BLOCKER — Table existence check:** Use `list_tables` to confirm all tables referenced by the feature's API routes exist in the database. If a table is missing, apply the migration first.
- [ ] All code committed and pushed to remote

### 2a. Local Deployment

Use this when deploying to a local machine (e.g. on-premise server, staging environment, or self-hosted setup).

**Build & Start:**
- Run `npm run build` to create the production bundle
- Run `npm run start` to start the production server (default port 3000)
- To use a custom port: `PORT=3002 npm run start`
- Verify the app is accessible at `http://localhost:<port>`

**Process Management (optional):**
- For persistent background execution, use a process manager like `pm2`:
  - `npx pm2 start npm --name "app-name" -- start`
  - `npx pm2 save` to persist across reboots
- Or use `systemd`, `screen`, or `nohup` depending on the server environment

**Post-Start Verification:**
- [ ] App loads at the configured URL
- [ ] Database connections work
- [ ] Authentication flows work
- [ ] No errors in terminal output
- [ ] Feature works as expected

### 2b. Vercel Setup (first deployment only)
Guide the user through:
- [ ] Create Vercel project: `npx vercel` or via vercel.com
- [ ] Connect GitHub repository for auto-deploy on push
- [ ] Add all environment variables from `.env.local.example` in Vercel Dashboard
- [ ] Build settings: Framework Preset = Next.js (auto-detected)
- [ ] Configure domain (or use default `*.vercel.app`)

### 3. Deploy (Vercel)
- Push to main branch → Vercel auto-deploys
- Or manual: `npx vercel --prod`
- Monitor build in Vercel Dashboard

### 4. Post-Deployment Verification
- [ ] Production URL loads correctly
- [ ] Deployed feature works as expected
- [ ] Database connections work (if applicable)
- [ ] Authentication flows work (if applicable)
- [ ] No errors in browser console
- [ ] No errors in server/Vercel function logs

### 5. Production-Ready Essentials

For first deployment, guide the user through these setup guides:

**Error Tracking (5 min):** See [error-tracking.md](../../docs/production/error-tracking.md)
**Security Headers (copy-paste):** See [security-headers.md](../../docs/production/security-headers.md)
**Performance Check:** See [performance.md](../../docs/production/performance.md)
**Database Optimization:** See [database-optimization.md](../../docs/production/database-optimization.md)
**Rate Limiting (optional):** See [rate-limiting.md](../../docs/production/rate-limiting.md)

### 6. Post-Deployment Bookkeeping
- Update feature spec: Add deployment section with deployment target (local/Vercel), URL, and date
- Update `features/INDEX.md`: Set status to **Deployed**
- Create git tag: `git tag -a v1.X.0-PROJ-X -m "Deploy PROJ-X: [Feature Name]"`
- Push tag: `git push origin v1.X.0-PROJ-X`

## Common Issues

### Build fails on Vercel but works locally
- Check Node.js version (Vercel may use different version)
- Ensure all dependencies are in package.json (not just devDependencies)
- Review Vercel build logs for specific error

### Environment variables not available
- Verify vars are set in Vercel Dashboard (Settings → Environment Variables)
- Client-side vars need `NEXT_PUBLIC_` prefix
- Redeploy after adding new env vars (they don't apply retroactively)

### Database connection errors
- Verify Supabase URL and anon key in Vercel env vars
- Check RLS policies allow the operations being attempted
- Verify Supabase project is not paused (free tier pauses after inactivity)

## Rollback Instructions

**Vercel:**
1. **Immediate:** Vercel Dashboard → Deployments → Click "..." on previous working deployment → "Promote to Production"
2. **Fix locally:** Debug the issue, `npm run build`, commit, push
3. Vercel auto-deploys the fix

**Local:**
1. **Immediate:** Stop the running process, check out the previous working commit: `git checkout <last-known-good-sha>`
2. Rebuild and restart: `npm run build && npm run start`
3. Fix the issue on the current branch, rebuild, and redeploy

## Full Deployment Checklist
- [ ] Pre-deployment checks all pass
- [ ] **BLOCKER: `list_migrations` confirms all local migrations are applied to the database (no drift)**
- [ ] **BLOCKER: `list_tables` confirms all required tables exist**
- [ ] Build successful (`npm run build`)
- [ ] App running and accessible at target URL (local or Vercel)
- [ ] Feature tested in deployed environment
- [ ] Database connections work
- [ ] No console errors, no server/Vercel log errors
- [ ] Error tracking setup (Sentry or alternative) — Vercel deployments
- [ ] Security headers configured in next.config
- [ ] Feature spec updated with deployment info (target, URL, date)
- [ ] `features/INDEX.md` updated to Deployed
- [ ] Git tag created and pushed
- [ ] User has verified deployment

## Git Commit
```
deploy(PROJ-X): Deploy [feature name] to production

- Production URL: https://your-app.vercel.app
- Deployed: YYYY-MM-DD
```
