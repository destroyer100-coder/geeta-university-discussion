# REFERENCE SKILLS & PROJECT HARDENING PLAN

**Target repository:** `destroyer100-coder/geeta-university-discussion`  
**Target branch:** `master`  
**Prepared:** 31 October 2026

This plan records how the four supplied public repositories should inform work on this project. They are external references, not implementation dependencies. No code, executable script, plugin, or third-party skill has been copied or installed from them.

## 1. Sources reviewed

| Reference | Reviewed material | Intended use |
|---|---|---|
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | `AGENTS.md`, `.agents/rules/ponytail.md`, `skills/ponytail/SKILL.md`, README | Repository-first review, dependency reuse, smallest complete fixes, explicit tests, no shortcuts in security/accessibility |
| [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | Security audit skill, HTTP/auth, data isolation/lifecycle, cloud/deployment, validation/reporting guidance | Source-evidenced trust-boundary review, authentication/session checks, authorization, data isolation, deletion, uploads, storage, deployment configuration |
| [usestrix/strix](https://github.com/usestrix/strix) | Application/API/web application security-testing skill guidance and project structure | Defensive, authorized security test cases; API and browser trust-boundary tests; reproducible finding/validation discipline |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Taste skill and visual critique, app-screen, layout, colour and typography references | Visual hierarchy, layout rhythm, deliberate palette/typography, responsive screen critique, usability and accessibility review |

Use current upstream material only when re-checking the source repositories. These references may change; record the commit SHA used for any later detailed audit.

## 2. Authority order — do not confuse references with product decisions

1. Current GitHub full-stack implementation is the implementation source of truth.
2. `docs/GEETA_UNIVERSITY_DISCUSSION_MASTER_SPECIFICATION.md` is the product requirements and engineering decision reference.
3. `docs/GEETA_UNIVERSITY_DISCUSSION_SYSTEM_ARCHITECTURE.md` is the target architecture and integration map; it is not proof that a feature exists.
4. Original project handoff/history is context for decisions and reported issues.
5. The four external repositories are methodology/reference material only. They must not override project requirements, existing working behavior, data models, or APIs.

Before any code edit: inspect latest `master`, trace all callers/routes/controllers/services/models/components/tests, make a file map, identify data and compatibility risks, edit a file once with grouped fixes, run checks, inspect the diff, and only then commit. Do not rebuild from scratch.

## 3. Current repository snapshot inspected

Repository tree at commit `c7818314e8279515fab72b78e3b462a54673a8bd` was reviewed. It contains React/Vite frontend, Express/Mongoose backend, authentication, community permissions, post/comment/attachment/event/message/notification modules, and two project reference documents.

Relevant existing code:
- User roles in `backend/src/models/User.js`: `admin`, `faculty`, `student`.
- Public registration in `backend/src/controllers/authController.js` assigns `student`; a client cannot choose a role through the registration payload.
- JWT authentication loads the user record from MongoDB; role checks exist in `backend/src/middleware/requireRole.js`.
- Community-specific authorization and delegated permissions are centralized in `backend/src/services/permissionService.js` and `backend/src/middleware/communityPermission.js`.
- Community settings currently permit owner or Platform Admin; delegated moderators are not automatically allowed to change settings.
- Login rate-limiting and request validators exist in `backend/src/routes/authRoutes.js`.
- A large live HTTP permission matrix exists at `backend/tests/c5_permission_matrix.mjs`; custom-policy test exists at `backend/tests/c8_custom_policy_test.mjs`.
- There is currently no dedicated Admin page/route or admin API module in the inspected tree, despite that being a target in the architecture.
- The current login UI includes development-only demo persona buttons and the context has hard-coded demo identities.
- Seeder `backend/src/utils/seeder.js` uses the shared literal demo password `password123` and clears many collections. It refuses to run when `NODE_ENV=production`, but still requires explicit review before any shared/staging database use.
- Registration only creates students; faculty/admin account provisioning is not currently exposed via a dedicated protected onboarding workflow.
- The frontend route list has no protected route wrapper in `AppRoutes.jsx` (the current app layout routing should be verified as part of access-control work).
- The base frontend API client uses `/api`; proxy/CORS/deployment wiring requires environment/live verification.
- UI CSS already defines a navy/gold design system and sidebar collapse/mobile drawer code. Do not replace the theme wholesale without screenshot-based critique.
- Existing backend permission tests call the live local API and connect to the configured database. Do not run destructive or live-DB tests against shared or production data.

## 4. Identity model to preserve and complete

Do not collapse all roles into one role hierarchy. These are different authorization scopes.

### Platform role (global)

| Role | Intended scope |
|---|---|
| Platform Admin | Platform administration: user lifecycle, platform reports, moderation oversight, platform configuration, audit review and emergency controls |
| Faculty | Faculty identity; does not automatically equal Platform Admin. May own/manage a community or have explicitly assigned campus responsibilities |
| Student | Standard student account and campus participation |

Only the server may assign or change platform roles. Registration must never accept `role`, `isAdmin`, `permissions`, or community membership role as trusted client input. Faculty/admin invitation, provisioning, role changes, suspension and revocation must be authenticated, authorized, audited, and protected from self-escalation.

### Community role (per community)

Head/Owner, Moderator, Member, Approved User and Non-member remain community/resource scoped. A user may have different roles in different communities. Moderator actions must validate the exact community and explicit delegated permission. Platform Admin has documented platform-wide override; that must not silently create membership, ownership or private-message access.

### Route and action enforcement

The backend remains authoritative. Frontend guards and hidden controls are usability only. Every protected API must re-evaluate the user, target resource, target community, visibility, current membership state, delegated permission, account status, and requested action. Deny by default.

## 5. Priority workstreams

### P0 — Login, identity and account safety

1. Remove reliance on public/shared demo credentials for any staging or production account; introduce generated local-only demo passwords or a controlled seed fixture. Never print secrets into logs or docs.
2. Rework destructive seeding so a normal developer seed cannot wipe arbitrary collections or a shared database. Use isolated database name/allowlist, explicit confirmation, scoped fixture cleanup, and refuse shared/production environments. Do not run existing seeder on any real database.
3. Keep public registration fixed to student. Implement a protected provisioning path for faculty and initial Platform Admin; do not add a public role dropdown.
4. Verify JWT verification pins accepted algorithm, validates token expiry and principal, and ensure password changes/account suspension/deletion invalidate existing sessions according to a clear revocation strategy.
5. Review token storage (currently browser local storage) and CSP/XSS exposure. Do not switch to cookies without designing CSRF, cookie attributes, proxy and refresh/revocation behavior.
6. Ensure authentication errors are generic; review password validation, rate-limits by account/IP, timing, credential enumeration, verification resend and lockout abuse.
7. Login UX: accessible errors, loading/disabled states, show/hide password, recovery path only when a safe backend flow exists, correct return-to route, no false navigation on failed demo login.
8. Remove demo persona switching from any production build. Ensure development-only demo UI cannot authenticate as privileged seeded identities with a known common password.

### P0 — Authorization and administrative controls

1. Inventory all API routes and classify public, authenticated, student, faculty, community Head, delegated Moderator and Platform Admin access.
2. Add explicit route/action authorization tests for unauthorized, wrong-role, wrong-community, inactive member, banned member, deleted account, permission revoked and cross-user object IDs.
3. Build Platform Admin API and UI only after writing a complete permission matrix. Minimum admin capabilities: user search/detail, activate/suspend/deactivate, role provisioning/change, report queue, platform moderation, communities overview, audit events and platform settings.
4. Admin actions require server-side `requireRole('admin')` or a narrowly scoped policy, object-level checks, audit event with actor/target/reason, safe response fields and confirmation for high-impact actions.
5. Admin must not automatically read private conversations or bypass privacy contracts not expressly granted by the master specification.
6. Faculty access is not blanket admin access. Faculty community owner/head rights remain community scoped; official announcements/events require explicit platform/community policy.
7. Add tests proving no student can self-promote by modifying request JSON, no faculty can call platform admin APIs by default, and no moderator can use another community's delegation.

### P0 — Data isolation, attachments and lifecycle

1. Trace ownership/community filters through detail, list, search, saved, notifications, previews, downloads, exports, background paths and error paths.
2. Verify every attachment download checks access to the parent post/community at request time; avoid public upload directory exposure for private attachments.
3. Validate real file content/type, extension, byte limit, count, archive traversal and path generation; sanitize names and use opaque storage keys.
4. Review soft-delete/tombstone behavior for posts/comments/users and every derived copy (attachments, folders, notifications, search, feed and previews).
5. Verify message conversation membership for every read/write/delete operation, and block semantics apply to existing conversations.
6. Do not claim deletion or privacy if caches, static files, indexes or stale URLs still expose data; require tests or state needs-validation.

### P1 — Infrastructure and operations

1. Document production architecture: Vercel frontend → Render API → MongoDB Atlas; media storage target and actual adapter must be verified.
2. Verify Vercel rewrite/API base URL, exact HTTPS CORS allowlist, Render health/readiness, Atlas network access, Node version and build/start commands.
3. Ensure no secrets in Vite variables, frontend output, Git history, error responses or logs. Rotate any credential known to have been exposed.
4. Review upload persistence on ephemeral hosts; production should use durable object storage when current provider disk is ephemeral. Keep storage keys and private ACL checks server-side.
5. Add structured request IDs, safe logs, health/readiness, rate limiting, graceful shutdown, DB connection behavior, backup/restore plan, dependency audit and CI gates.
6. Check availability/limits against low-memory development hardware; avoid large dependencies when existing platform features suffice.

### P1 — UI/UX and design system

Use taste-skill as critique, not as a template to copy:
1. First screen should clearly show what the platform is, who it serves, and the primary next action.
2. Establish hierarchy: one dominant element per view, a small consistent type scale, controlled line lengths and legible body size.
3. Preserve campus navy/gold identity unless a design review demonstrates a better coherent direction; do not blindly import the taste skill's palette examples or bans.
4. Check consistent content edges, spacing, responsive card density, attachment previews, empty/loading/error states, keyboard focus and touch targets.
5. Test screenshots at desktop, tablet and phone widths; mobile must have its own considered layout, not simply squeezed desktop.
6. Keep Home global feed, Explore discovery, Communities directory and Community Discussions scoped; do not merge distinct destinations.
7. Every visible control must be wired to a real API/action or be clearly disabled/unavailable. No fake success, placeholder buttons or demo links.
8. Use the taste-skill's critique style: describe observable defects with exact screenshot/viewport and fix, not vague “polish” language.

## 6. Role/access matrix — target baseline

This is a starting matrix for implementation review; detailed action policy must follow the master specification and current API behavior.

| Capability | Student | Faculty | Community Head/Owner | Delegated Moderator | Platform Admin |
|---|---:|---:|---:|---:|---:|
| Register publicly | Yes | No | N/A | N/A | No |
| Standard campus feed/interactions | Yes | Yes | Yes | Yes | Yes |
| Create community | Existing policy; verify | Existing policy; verify | N/A | N/A | Yes |
| Manage own profile | Yes | Yes | Yes | Yes | Yes |
| Own/manage a community | If creator | If creator | Exact community | Only delegated actions | Platform override |
| Pin/lock/delete community post | No, except own content policy | No, except own content policy | Exact community | Only named delegation | Platform scope |
| Manage join/post requests | No | No by default | Exact community | `manage_requests` only | Platform scope |
| Configure community rules/settings | No | No by default | Exact community | Only if explicitly delegated and supported | Platform scope |
| Manage platform users | No | No by default | No | No | Yes |
| Review platform reports | No | No by default | Community-scoped reports if authorized | Only delegated/community scope | Yes |
| Read private conversations | Own conversation membership only | Own conversation membership only | Own conversation membership only | Own conversation membership only | No implicit access |

Every matrix cell must be verified against actual routes and tests; do not implement from this table alone.

## 7. Test gates

Before any auth, role, permission, admin, upload, message or lifecycle change:
- Static syntax checks / lint/build where scripts exist.
- Unit tests for decision helpers.
- HTTP integration tests with isolated test database and dummy users.
- Cross-role and cross-community negative tests.
- IDOR/object authorization tests with two users and two communities.
- Session expiry/revocation and unverified/deleted/suspended account tests.
- Admin self-escalation and unauthenticated admin endpoint tests.
- Upload/download with unauthorized user, traversal filename, invalid MIME, oversized file and deleted parent.
- Mobile/desktop screenshots and keyboard accessibility checks for UI work.
- Record exact commands, environment assumptions and pass/fail; never claim live deployment verified unless actually tested.

Do not run `backend/src/utils/seeder.js` or existing live HTTP test scripts against production, shared staging, or any database with user data. Existing tests use seeded credentials and fixed localhost API port; adapt them to an isolated database and disposable local service before use.

## 8. Required audit finding format

For each issue:
- ID and severity
- Affected role/principal and target resource
- Exact file/route/function evidence
- Preconditions and real impact
- Confirmed vs needs-validation
- Smallest safe fix
- Regression tests
- Files/callers affected
- Migration/deployment implications

No finding based solely on a missing header, hidden UI, hypothetical attack, or tool warning. Prove the trust-boundary break or mark as needs-validation.

## 9. Source attribution and licensing

The referenced projects are independently maintained open-source repositories with their own licenses. This plan paraphrases workflow and review ideas. Before copying any specific implementation/code/assets, inspect its license, attribution requirements, dependencies, and compatibility; prefer reimplementing the relevant principle in this project's existing architecture.
