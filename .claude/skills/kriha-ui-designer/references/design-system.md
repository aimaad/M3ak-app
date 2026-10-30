# Kriha design system v1

## Core palette
- primary `#00B884` — primary actions, selected nav, highlights
- primaryPressed `#008F69` — pressed/hover state and stronger text on pale surfaces
- forest `#064E3B` — premium hero cards, brand panels, headings on light backgrounds
- background `#F5FAF8` — app canvas
- surface `#FFFFFF` — cards, forms, sheets
- text `#172B26` — primary text
- muted `#64748B` — secondary text
- border `#E5EDE9` — dividers and input outlines
- accent `#F2B35D` — sparing editorial accents, never sole signal
- success `#16A34A`, warning `#F59E0B`, error `#EF4444`, info `#3B82F6`

## Accessibility
Do not put small white text on bright `#00B884` without contrast verification; prefer `#064E3B` text on light green, or a darker green button surface with white text. Verify WCAG AA text contrast (4.5:1 for normal text, 3:1 for large text) and status indicators with text/icon labels.

## Scale
- Spacing: 4, 8, 12, 16, 24, 32 px (8px baseline with 4px fine adjustment).
- Radius: 12 inputs/buttons, 16 cards, 20–24 feature panels.
- Touch targets: minimum 44x44 logical points; avoid cramped icon buttons.
- Typography: use existing app font; suggested body 14–16, section title 18–20, page title 24–28, KPI 28–34. Support system font scaling.
- Elevation: restrained, favor borders and spacing over strong shadows.
- Icons: one coherent line-icon family, consistent stroke weight.

## Components and states
- `KrihaScreen`: safe-area, scroll, page background.
- `KrihaHeader`: title, contextual back/action, optional notification.
- `KrihaButton`: primary, secondary, tertiary, destructive, loading, disabled.
- `KrihaCard`: default and forest feature variants.
- `KrihaStatCard`: icon, value, label, optional trend.
- `KrihaBadge`: status label with accessible text, not color alone.
- `KrihaInput`: label, hint, validation error, keyboard type.
- `KrihaEmptyState`: helpful explanation and relevant next action.
- `KrihaVehicleCard`: image, model, plate, availability, action.

## Navigation
Maintain existing routing. Keep the primary mobile tabs focused on high-frequency work; do not silently delete lesser-used features. Ensure active tab, scroll state, back navigation, loading and keyboard behavior are tested.

## Imagery
Use authentic licensed or existing car assets; no remote placeholder images in production. For missing images, render polished neutral placeholders.
