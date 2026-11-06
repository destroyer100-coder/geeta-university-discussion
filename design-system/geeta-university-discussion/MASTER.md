# Geeta University Discussion — Master Design System

> UI/UX Pro Max-informed design source of truth. Product: university community and discussion platform. Audience: students, seniors, faculty and community moderators. Primary job: discover useful campus conversations, participate safely, and create academic discussions.

## 1. Product and visual direction

- **Product profile:** Membership/Community + Social Media App + Educational App.
- **Chosen direction:** Academic Editorial + Community Utility.
- **Style blend:** Minimalism / Swiss structure for reading and navigation, with restrained Soft UI Evolution for card depth and feedback. Use selective modular/Bento layouts only for discovery summaries, never for the long-form discussion feed.
- **Primary principle:** Content-first. Posts, authors, community context and actions must be more prominent than decorative chrome.
- **Brand personality:** Trustworthy, useful, student-led, modern, calm and inclusive.
- **Avoid:** Purple/pink AI gradients, neon, glassmorphism everywhere, claymorphism, oversized marketing hero sections, excessive card lift, emoji used as functional icons, unnecessary animations, nested page scrollbars and horizontal overflow.

## 2. Color tokens

| Token | Value | Use |
|---|---|---|
| Brand / primary | `#1E3A8A` | Brand, primary navigation and important actions |
| Primary hover | `#1D4ED8` | Hover/active primary controls |
| Primary soft | `#EFF6FF` | Selected nav, selected filters, subtle highlights |
| Primary border | `#BFDBFE` | Focus-adjacent and selected borders |
| Accent gold | `#B45309` | Gold/amber emphasis with white-text-safe contrast |
| Accent soft | `#FEF3C7` | Event, featured and academic highlight surfaces |
| Page background | `#F6F8FC` | App canvas |
| Surface | `#FFFFFF` | Cards, menus, forms and modal |
| Surface muted | `#F1F5F9` | Search, subtle panels and disabled backgrounds |
| Text primary | `#0F172A` | Headings and body text |
| Text secondary | `#334155` | Supporting content |
| Text muted | `#64748B` | Metadata and helper copy |
| Border | `#E2E8F0` | Default separators and outlines |
| Border strong | `#CBD5E1` | Hover and emphasized boundaries |
| Focus | `#2563EB` | Visible keyboard focus |
| Success | `#047857` | Success status |
| Warning | `#B45309` | Warning status |
| Danger | `#B91C1C` | Destructive actions and errors |
| Info | `#0369A1` | Informational status |

Use semantic tokens, not one-off hex values in JSX. Normal text contrast must meet WCAG AA (4.5:1); large text and meaningful non-text controls must meet their applicable contrast threshold. Never communicate state by color alone.

## 3. Typography

- **Family:** Inter, system-ui, sans-serif. Use one family for product UI; do not mix display fonts into the feed.
- **Body:** 15–16px, line-height 1.55–1.65.
- **Metadata:** 12–13px; never use tiny low-contrast text for essential information.
- **Page title:** 26–30px, weight 750–800, line-height 1.2.
- **Section title:** 16–18px, weight 700.
- **Post title:** 16–18px, weight 700, line-height 1.4.
- **Post body:** 14–16px, line-height 1.65.
- **Labels:** 13–14px, weight 600.
- Use sentence case. Avoid all-caps except tiny, non-essential section eyebrows.

## 4. Layout and spacing

- **Spacing base:** 4px; use 4/8/12/16/20/24/32/40/48px.
- **Desktop shell:** max-width 1440px; grid `248px minmax(0, 1fr) 296px`; 20–24px gutters.
- **Collapsed sidebar:** 72px; feed expands without overlap.
- **Navbar:** 68–72px high, one row on desktop, clear mobile wrap/drawer behavior.
- **Feed measure:** keep long-form reading around 60–75 characters per line.
- **Page scroll ownership:** document is the only page-level scroller. Desktop left/right sidebars and Upcoming Events grow with the document; no independent sidebar scrollbars. Exceptions: mobile navigation drawer and the body of a long modal.
- **Breakpoints:** 1440px, 1200px, 1024px, 768px, 520px, 375px. At tablet widths, simplify columns before shrinking content; on mobile, use a single column and drawer navigation.
- **No horizontal page overflow.** Filter chips should wrap where possible; if a local chip row must scroll, it must be clearly scoped and must not create page-level overflow.

## 5. Surfaces and components

### Cards
- White surface, 1px `--border-color`, 14–18px radius, subtle `--shadow-sm`.
- Hover: border/shadow refinement only; no layout-shifting lift for dense feed cards.
- Consistent internal padding: 16–20px.
- Keep post cards visually quieter than primary actions.

### Buttons
- One primary CTA per screen/section; primary = solid brand blue.
- Secondary = white with visible neutral border.
- Tertiary = quiet text/icon button.
- Destructive = semantic danger treatment.
- Minimum interactive height 40px desktop and 44px touch layouts; icon-only controls need accessible names and generous hit areas.
- Distinguish hover, focus-visible, pressed, disabled and loading states.

### Navigation
- Active sidebar item: primary-soft background, primary text, visible active marker.
- Collapse/expand control must clearly communicate direction and expose `aria-expanded`.
- Search is a real form with a visible label or accessible name, keyboard shortcut hint and focus state.
- Menus close predictably with Escape and outside interaction; preserve keyboard navigation.

### Discussion feed and post cards
- Visual order: author/community metadata → title → body/media/attachments/poll → tags → actions.
- Make the whole title or explicit “Open discussion” affordance navigate; nested action buttons must not trigger parent navigation.
- Like, save, helpful, poll, pin, lock, delete and moderation states retain existing API behavior.
- Do not invent engagement metrics or display placeholder counts as real data.
- Deleted/locked/pinned/accepted-answer states need text or icon cues, not color alone.

### Create Post composer
- Preserve the existing permission checks, audience selection, attachment, folder, poll, preview and request-to-post flows.
- Improve grouping, field labels, helper/error text, upload progress, selected audience and permission status hierarchy.
- Keep modal header/footer visible while the form body scrolls when needed.
- Mobile composer fills the usable viewport with safe spacing; no clipped submit controls.

### Community discovery and creation
- Discovery hierarchy: page title/description → search → category filters → community cards.
- Cards show name, category, short description, member/visibility status and relevant action.
- Make membership state explicit: Join, Pending, Leave or View; do not hide permission restrictions.
- Create form uses visible labels, inline validation, visibility explanation and clear success state.

### Right rail
- Upcoming Events, Trending Discussions and Top Contributors use consistent section headers and compact rows.
- Event date, title, venue and time must remain readable; each event links to its detail page where available.
- Do not make the right rail independently scrollable on desktop.

## 6. Motion and interaction

- Standard transition: 150–200ms ease-out; use 220–260ms only for drawers/modals.
- Animate opacity, color, border, shadow and small transforms; avoid animating layout dimensions.
- Respect `prefers-reduced-motion`.
- Every interactive element has a pointer cursor, keyboard focus, and immediate visual feedback.
- No hover-only actions; touch and keyboard users must have equivalent access.

## 7. Responsive behavior

- **1440px+:** full three-column shell.
- **1200px–1439px:** preserve feed width; reduce gutters and right rail width.
- **1024px–1199px:** hide right rail; retain collapsible left navigation.
- **768px–1023px:** single feed column; left nav becomes a drawer.
- **520px–767px:** compact navbar with search row; buttons remain usable.
- **375px–519px:** one-column content, wrapped filters, no clipped text/actions.
- Test 375, 768, 1024 and 1440 viewport widths.

## 8. Accessibility and quality gates

- WCAG AA contrast; visible 2–4px focus indicators.
- Semantic landmarks and sequential heading hierarchy.
- Labels associated with every form control; errors adjacent to the field.
- Icon-only buttons have `aria-label`; toggles expose `aria-expanded` / `aria-pressed`.
- Keyboard operation for navigation, menus, tabs, modals and forms; Escape closes the topmost modal.
- Images have meaningful alt text or empty alt for decoration; reserve media dimensions to avoid layout shift.
- Respect reduced motion and browser zoom; never disable zoom.
- No horizontal page overflow, accidental nested page scrollers, clipped badges or overlapping controls.
- Validate build, route rendering and critical interactions before calling a redesign complete.

## 9. Non-negotiable implementation boundaries

- Preserve React Router paths, service/API contracts, auth state, backend behavior, permission checks and MongoDB schemas.
- Do not change API payloads or permission decisions as part of visual redesign.
- Reuse existing Lucide icon wrapper and existing component state/handlers.
- Consolidate duplicate CSS rules; do not keep appending override blocks.
- Do not add Tailwind utility classes unless Tailwind is installed and configured in the frontend build.
- Make each file change once per planned implementation pass, then validate the integrated result.
