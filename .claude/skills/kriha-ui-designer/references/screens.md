# Screen coverage and art direction

Reference board is conceptual and may contain invented labels or sample values. Verify against actual source screens.

| Area | Layout target | Functional safeguards |
|---|---|---|
| Sign-in / sign-up / reset | Deep forest brand panel, white input cards, clear emerald CTA | Auth validation, error handling, secure storage |
| Onboarding / agency join | Focused stepper, one decision per screen | Invitation codes, account and agency ownership |
| Dashboard | Forest revenue hero, 2-column KPI cards, recent rentals, prominent new-rental CTA | Real metrics, correct currency/date and role filtering |
| Fleet list | Search, segmented filters, vehicle thumbnails, status badges | Search, pagination, vehicle permissions |
| Vehicle detail | Vehicle hero image, specs, documents, maintenance, edit CTA | Exact plate/status, documents, edit validation |
| Clients | Searchable cards and profile tabs | Private information, documents, history |
| Rentals | List/calendar, status, guided new-rental flow | Pricing, overlap checks, dates, customer/vehicle binding |
| Departure/return/inspection | Stepper, photo capture, evidence review, damage annotations | Preserve photos, timestamps, approvals, audit trail |
| Contracts | Clean document preview, signature/download actions | Legal content, signature state, correct PDF |
| Maintenance/insurance | Urgency-first cards, due dates, create action | Accurate due dates and alerts |
| Team/roles | Member list, permissions toggles | Server-enforced authorization |
| Agency/profile/subscription | Grouped settings and billing details | Subscription state, account security |
| Desktop/web | Sidebar and denser tables using same tokens | Responsive layout, no mobile-only assumptions |
| Arabic | Proper RTL layout and localized labels | Numbers, dates, bidi, truncation |

For each screen deliver: existing-to-target mapping, components, responsive notes, states, changes, tests and screenshot if possible.
