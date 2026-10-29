---
name: kriha-ui-designer
description: Redesign and implement Kriha car-rental agency management interfaces in existing React Native and Expo projects. Use when asked to redesign Kriha screens, apply its green brand design system, create reusable components, improve rental workflows, align implementations with provided mockups, or validate mobile UI without breaking business logic.
---

# Kriha UI Designer — React Native / Expo

## Purpose
Create a coherent, premium, accessible interface for Kriha, a Moroccan car-rental agency management application. The included design-board image is **visual inspiration**, not proof of actual implementation or a pixel-perfect specification. Read `references/design-system.md`, `references/screens.md`, and `references/qa.md` as needed.

## Source of truth
1. Existing app source code, navigation, API schemas, permissions, and business rules are authoritative for functionality.
2. User-provided screenshots and current project assets are authoritative for visual context, but do not assume all screens shown in the reference are implemented.
3. The Kriha design system in this skill governs new visual decisions unless user overrides it.
4. Do not infer the tech stack beyond React Native / Expo: inspect package.json to identify Expo Router vs React Navigation, styling, icons, state management, forms, localization, and installed packages.

## Mandatory workflow
1. **Inventory**: Inspect package.json, app config, route structure, shared components, design tokens, assets, API calls, localization and tests. Record what exists vs what is only in reference images.
2. **Map**: For each requested screen, list current fields, interactions, states, permissions, dependencies, and the proposed layout. Identify what must not change.
3. **Plan**: Show user a concise screen-by-screen plan and prioritize a single pilot screen (dashboard by default). Ask for approval before major structural changes.
4. **Design system**: Centralize tokens, type scale, spacing, radii, elevation and semantic status colors. Reuse existing UI framework if present; do not replace it without a reason and approval.
5. **Implement incrementally**: Build reusable primitives and refactor one screen at a time. Keep original routing, backend calls, data transformations, validation and permissions. Avoid hard-coded production mock data.
6. **Validate**: Run available typecheck, lint, unit tests, Expo diagnostics and app-specific checks; visually review actual screens on at least one compact Android viewport and one iPhone-size viewport when simulator/screenshots are available. Do not claim visual testing if not performed.
7. **Report**: For each screen report files changed, visual improvements, preserved behaviors, tests executed, remaining limitations, and suggested next screen.

## Non-negotiable UI rules
- Use the palette and semantic roles in `references/design-system.md`; green is the brand, not the only status color.
- Respect safe areas, keyboard, dynamic text, accessibility labels, touch targets and RTL support where applicable.
- Prioritize readability over decorative effects; use typography, spacing and grouping before shadows or gradients.
- Build loading, empty, error, offline and success states where applicable.
- Never replace sensitive document handling, identity validation, payment calculations, or role checks with decorative UI shortcuts.
- Avoid destructive bulk refactors, backend edits and package installations without clear justification.
- Never copy reference screenshot text blindly; use actual app terminology and locale strings.

## Screen-specific guidance
See `references/screens.md` for the full inventory. Default implementation order: Dashboard -> Fleet -> Vehicle detail -> Clients -> Rentals -> Inspections -> Contracts -> Maintenance -> Team -> Settings -> Authentication/Onboarding -> Desktop/RTL adaptations. Adjust to user's priority.

## React Native / Expo implementation conventions
- Prefer TypeScript where the repository uses it; preserve existing architecture and conventions.
- Use `StyleSheet` or the project's established styling solution consistently.
- Use `Pressable`, `TextInput`, `FlatList`/`SectionList` and platform-safe primitives as appropriate; ensure keyboard avoidance and list performance.
- Use `expo-image`, `expo-linear-gradient`, `expo-router`, icon libraries, etc. **only if already installed or approved**. Do not assume availability.
- Extract primitives such as `KrihaButton`, `KrihaCard`, `KrihaBadge`, `KrihaInput`, `KrihaScreen`, `KrihaStatCard`, `KrihaEmptyState`, `KrihaSectionHeader` when justified by repeated use.
- For charts, prefer an existing chart package; do not introduce a large new package merely to mimic a screenshot.
- Use `useWindowDimensions`, safe-area insets and platform-aware sizing rather than fixed screen dimensions.
- For Arabic, validate RTL order, alignment and text truncation separately from LTR.

## When user requests a full redesign
Do not claim to implement dozens of screens at once. First produce a coverage matrix and pilot the dashboard. After approval, proceed in batches with verification checkpoints. Use the bundled `assets/kriha-reference-board.png` as an art-direction reference and the user's own screenshots/PDF as detailed current-state reference if supplied.
