# Frontend Implementation Checklist

Before marking frontend as complete:

## shadcn/ui
- [ ] Checked shadcn/ui for EVERY UI component needed
- [ ] No custom duplicates of shadcn components created
- [ ] Missing shadcn components installed via `npx shadcn@latest add`

## Existing Code
- [ ] Checked existing project components via `git ls-files src/components/`
- [ ] Reused existing components where possible

## Design
- [ ] Design preferences clarified with user (if no mockups)
- [ ] Component architecture from Solution Architect followed

## Implementation
- [ ] All planned components implemented
- [ ] All components use Tailwind CSS (no inline styles, no CSS modules)
- [ ] Loading states implemented (spinner/skeleton during data fetches)
- [ ] Error states implemented (user-friendly error messages)
- [ ] Empty states implemented ("No data yet" messages)

## Error Handling (CRITICAL)

- [ ] Every `fetch()` call has an explicit error branch for `!res.ok` with user-visible feedback
- [ ] No silent degradation: if functionality is hidden due to a failed API call, the reason is displayed to the user
- [ ] All API-dependent components handle ALL states: loading, success, error, empty, and domain-specific states
- [ ] No `fetch().catch(() => {})` patterns that swallow errors without user feedback

## Quality
- [ ] Responsive: Mobile (375px), Tablet (768px), Desktop (1440px)
- [ ] Accessibility: Semantic HTML, ARIA labels, keyboard navigation
- [ ] TypeScript: No errors (`npm run build` passes)
- [ ] ESLint: No warnings (`npm run lint`)

## Verification (run before marking complete)
- [ ] `npm run build` passes without errors
- [ ] All acceptance criteria from feature spec addressed in UI
- [ ] `features/INDEX.md` status updated to "In Progress"

## Completion
- [ ] User has reviewed and approved the UI in browser
- [ ] Code committed to git
