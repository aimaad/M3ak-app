# Quality assurance checklist

## Before changes
- [ ] Confirm app routing and navigation library
- [ ] Identify current data sources and mutations
- [ ] Identify business rules and permission gates
- [ ] Capture or inspect current screen
- [ ] Identify current reusable components

## After changes
- [ ] `package.json` scripts inspected and appropriate lint/typecheck/test commands run
- [ ] `npx expo-doctor` run if appropriate and available (network may be needed)
- [ ] No new TypeScript errors
- [ ] Loading, empty, error, success and offline behavior checked where relevant
- [ ] Android/iOS safe areas and keyboard tested where possible
- [ ] Small-screen overflow, font scaling and tap target checks
- [ ] Dark/RTL behavior checked only if supported or requested
- [ ] Real API data preserved, no placeholder content in production
- [ ] Navigation, form submission, edits and deletes tested
- [ ] Contrast and status semantics reviewed
- [ ] Screenshots compared to supplied reference at similar dimensions

Never report an unchecked item as passed. Separate automated results from manual checks and unavailable simulator checks.
