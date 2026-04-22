# Aether Revive Mobile Responsiveness Audit Report

## CRITICAL — breaks functionality on mobile

- **Page/Component: /revival/opportunities**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Complex multi-panel layout with sidebar + details panel does not collapse properly on mobile; uses fixed widths and relies on `lg:` breakpoints that leave narrow screens with unusable layout.
  - Impact: Users cannot access or interact with niche details panel on mobile phones.

- **Page/Component: /audit/[token] (Prospect-facing audit form)**
  - Viewport: iPhone SE (375px)
  - Issue: Sidebar navigation uses `hidden lg:block` and desktop-only stepper; mobile users see a cramped main content area with no visible progress indicator or navigation.
  - Impact: Prospects filling audit forms on phones cannot see which step they're on or navigate between sections.

- **Page/Component: /outreach page (Outreach Generator)**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Channel tabs, message cards with inline editing textareas, and action buttons overflow horizontally; touch targets for copy/mark-sent buttons are < 44px.
  - Impact: Outreach messages are unreadable and touch targets are difficult to tap.

- **Page/Component: Notification Bell Dropdown**
  - Viewport: iPhone SE (375px)
  - Issue: `PopoverContent` has fixed `w-[360px]` width which exceeds iPhone SE viewport width (375px).
  - Impact: Notification dropdown extends beyond screen edge, requiring horizontal scroll to read.

- **Page/Component: Support Request Modal**
  - Viewport: iPhone SE (375px)
  - Issue: Modal uses `max-w-2xl` (672px) which overflows mobile viewport; form fields and involvement level selector buttons don't stack properly.
  - Impact: Modal content clips off-screen and users cannot complete support requests.

- **Page/Component: Deploy Agent Modal (Agent Library)**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Modal uses `max-w-2xl w-full` but inner content (involvement options, complexity info) doesn't reflow for narrow viewports.
  - Impact: Deploy modal is unusable on mobile - content clips and buttons may be unreachable.

---

## MAJOR — looks broken but functional

- **Page/Component: / (Landing Page)**
  - Viewport: iPhone SE (375px)
  - Issue: Logo in nav uses fixed `height: 144px` which is oversized for mobile; social proof stats grid `gap-48` creates huge gaps; inline styles don't use responsive units.
  - Impact: Hero section looks disproportionate; stats section creates awkward whitespace.

- **Page/Component: /dashboard**
  - Viewport: iPhone SE (375px)
  - Issue: Trial ending/grace period banners use `flex items-center justify-between gap-4` which doesn't wrap; "Upgrade now" CTA button can be pushed off-screen.
  - Impact: Warning banners may truncate important text on narrow viewports.

- **Page/Component: /pipeline**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Filter pills use `flex-wrap` but metrics grid uses `grid-cols-2 md:grid-cols-4` which crowds at 375px; pipeline item cards have long text that doesn't truncate.
  - Impact: Filter bar and metrics cards appear cramped.

- **Page/Component: /agents (Agent Library)**
  - Viewport: iPhone SE (375px)
  - Issue: Agent cards use `grid-cols-1 md:grid-cols-2` (good) but category tabs use `overflow-x-auto` without momentum scroll indicator; pricing block text is dense.
  - Impact: Users may not realize they can scroll category tabs horizontally.

- **Page/Component: /audit/builder**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Multi-step form sidebar (step navigation) uses `hidden lg:block`; long service recommendation cards don't collapse on mobile.
  - Impact: On phones, users lose context of which step they're on; review cards overflow.

- **Page/Component: /quiz/[id] (Prospect-facing Quiz)**
  - Viewport: iPhone SE (375px)
  - Issue: Uses inline `maxWidth: "420px"` and `maxWidth: "2xl"` without responsive handling; option buttons may wrap awkwardly.
  - Impact: Quiz container looks cramped but remains usable.

- **Page/Component: /offer/builder**
  - Viewport: iPhone SE (375px)
  - Issue: Pricing model selector radio cards use fixed widths; price value inputs sit inline without proper wrapping.
  - Impact: Pricing section appears crowded but editable.

- **Page/Component: /proposal/builder**
  - Viewport: iPhone SE (375px)
  - Issue: Header confidence badge + reason text layout `flex items-start justify-between` pushes content to edges; long textarea labels may truncate.
  - Impact: Visual crowding at page header.

- **Page/Component: /call-prep**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Two-column layout `lg:grid-cols-3` collapses to single column (good) but checklist card and script cards have dense text without adequate mobile padding.
  - Impact: Content is readable but feels cramped.

- **Page/Component: /prompt-generator (Android Builder)**
  - Viewport: iPhone SE (375px)
  - Issue: Form inputs use proper responsive classes but the agent context banner at top uses `flex items-start gap-3` without wrapping, potentially truncating agent names.
  - Impact: Long agent names may clip.

- **Page/Component: Welcome Modal (4-step onboarding)**
  - Viewport: iPhone SE (375px)
  - Issue: `DialogContent` uses `max-w-lg` (512px) which overflows 375px viewport; step indicator dots + CTA button may wrap awkwardly.
  - Impact: Modal edges clip on smallest viewports.

- **Page/Component: Demo Link Prospect Modal**
  - Viewport: iPhone SE (375px)
  - Issue: Uses `sm:max-w-[480px]` which is fine for iPad but pushes 375px width; prospect search results list has dense touch targets.
  - Impact: Touch targets for prospect selection are < 44px.

---

## MINOR — small visual polish

- **Page/Component: /login**
  - Viewport: iPhone SE (375px)
  - Issue: Left brand panel uses `hidden lg:flex lg:w-[55%]` and mobile shows only right form panel (correct behavior), but subtle radial gradient glow positioning looks off-center.
  - Impact: Minor visual inconsistency.

- **Page/Component: /signup**
  - Viewport: iPhone SE (375px)
  - Issue: Radial glow `w-[600px] h-[600px]` creates excessive background element that doesn't scale with viewport.
  - Impact: Purely aesthetic; no functionality impact.

- **Page/Component: /settings**
  - Viewport: iPad mini (768px)
  - Issue: Settings cards use `max-w-4xl` but subdomain preview section could use tighter mobile layout.
  - Impact: Slight visual looseness on tablet.

- **Page/Component: /clients**
  - Viewport: iPhone SE (375px)
  - Issue: GHL aggregate stats grid uses `grid-cols-2 md:grid-cols-4` which is fine, but stat labels may wrap creating uneven heights.
  - Impact: Minor visual inconsistency.

- **Page/Component: /replies**
  - Viewport: iPhone SE (375px)
  - Issue: Reply thread cards use adequate responsive patterns but meta row with niche/channel/date uses inline separators that can wrap awkwardly.
  - Impact: Meta text occasionally wraps mid-line.

- **Page/Component: /upgrade**
  - Viewport: iPad mini (768px)
  - Issue: Plan toggle buttons use `flex gap-2` which is fine but "Save $398" badge inside button creates dense touch area.
  - Impact: Minor touch target overlap.

- **Page/Component: App Sidebar**
  - Viewport: iPhone SE (375px), iPhone 14 Pro (393px)
  - Issue: Sidebar does not have a mobile hamburger/overlay pattern - it uses `w-64`/`w-16` collapsible but no responsive hiding.
  - Impact: On mobile, sidebar likely pushes main content off-screen (needs layout wrapper inspection).

- **Page/Component: /demo/[androidId] (standard mode)**
  - Viewport: iPhone SE (375px)
  - Issue: Phone mockup scales reasonably with `maxWidth: "420px"` and `90vh` but "Link prospect" button text may truncate.
  - Impact: Minor text truncation.

---

## PASSES — pages that render correctly on all mobile viewports

- /login (mobile-optimized with hidden left panel)
- /signup (centered card layout works well)
- /support-requests (list layout with proper overflow)
- /settings/branding (form layout flows correctly)
- /my-offers (card grid collapses properly)
- /outreach/my-outreach (table scrolls horizontally with indicator)
- /quiz (internal quiz list page)
- /audit (internal audit list page)
- /revival (GHL connections list - simple card layout)
- /proposal (proposals list page - card layout)

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total pages audited | 35+ |
| Total issues found | 27 |
| Critical | 6 |
| Major | 13 |
| Minor | 8 |
| Passes | 10 |

**Overall mobile readiness:** Fair

**Most urgent fix recommendation:** Fix the prospect-facing /audit/[token] form immediately — this is the highest-priority mobile experience since prospects fill it on their phones, and currently they have no progress indicator or step navigation visible on mobile.
