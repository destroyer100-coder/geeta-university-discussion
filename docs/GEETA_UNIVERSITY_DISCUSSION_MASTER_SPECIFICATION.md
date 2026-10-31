# GEETA UNIVERSITY DISCUSSION

## Master Product Specification & Engineering Rules

**Version:** 1.0 \| **Prepared:** 31 October 2026\
**Status:** Living requirements document. Verify implementation against
the current GitHub repository.

## 1. Authority and working rules

-   GitHub repository `destroyer100-coder/geeta-university-discussion`
    is the authoritative full-stack implementation.
-   AI Studio exports are frontend/design references only. Never
    overwrite the full-stack repository with a frontend-only snapshot.
-   Preserve the existing React/Vite frontend, Express backend,
    MongoDB/Mongoose schemas, routes, authentication, permissions and
    data.
-   Do not rebuild from scratch or delete backend functionality to make
    frontend compile.
-   Requirements are not proof of implementation. Verify code and
    runtime tests.
-   Never expose `.env`, JWT secrets, MongoDB credentials, API keys or
    other secrets.

Labels: **REQUIRED** explicit requirement; **DECIDED** project decision;
**REPORTED** historical observation requiring re-check; **PENDING**
unverified/undecided; **FUTURE** optional.

## 2. Product vision

A university discussion and collaboration platform for students,
faculty, researchers and authorized participants: Discuss, Learn, Share,
Grow. Support academic questions, projects, campus life, placements,
clubs, events, people discovery and community collaboration. Features
must use real APIs and persistent data, with backend-enforced
permissions and responsive desktop/tablet/mobile UX.

## 3. Non-negotiable decisions

1.  No separate Resource Library page/module. Resources are ordinary
    posts with Resource type/tags and attachments.
2.  One post supports text plus multiple mixed attachment types.
3.  No Reddit upvote/downvote arrows. Use Like, Comment, Share, Save,
    Helpful and Accepted Answer.
4.  Backend authorization is authoritative; hiding controls in the
    frontend is not security.
5.  Public communities allow non-member posting when configured policy
    permits.
6.  Home is a global feed; Community Discussions is scoped to one
    community.
7.  Explore and Communities are distinct destinations.
8.  Preserve existing login/authentication flow unless an approved
    change is required.
9.  No secrets in frontend bundles, source control or documentation.

## 4. Roles and identity

**Platform Admin:** platform-wide user/community administration,
reports, platform settings, safety and exceptional overrides. It is not
automatically a Head/Moderator in every community.

**Community-scoped roles:** a user may be Head in A, Moderator in B and
Member in C. Check the exact community/resource every time. -
**Head/Owner:** manages community, moderators, members, settings, rules,
permissions, pins, locks and approvals within platform limits. -
**Moderator:** moderates assigned communities and delegated actions
only. - **Member:** accepted/active member; participation follows
policy. - **Approved User:** explicitly granted posting permission; not
automatically a full member. - **Non-member:** may view public content
and request access when enabled; cannot access private content.

Personal profile, community management and Platform Admin are separate
permission scopes. Public profile APIs must not expose email, password
hashes or internal security fields.

## 5. Community types and permissions

  -----------------------------------------------------------------------
  Type                    View                    Posting
  ----------------------- ----------------------- -----------------------
  Open                    Everyone                Everyone

  Members Only            Everyone                Members

  Approved Users          Everyone                Members + approved
                                                  users

  Head/Admin Only         Configured              Head + authorized
                                                  moderators/delegates

  Private                 Members only            Configured

  Custom                  Head chooses            Head chooses
  -----------------------------------------------------------------------

Each community configures who can view, post, comment, share, upload,
create polls, request posting permission, approve posts, pin, lock,
announce, remove content and manage members/moderators. Approval and
anonymous-posting policies must be explicit. Show the actual rule in the
community header and composer selector.

### Request-to-Post flow

1.  Non-member opens a restricted public community.
2.  UI explains the restriction and offers Request to Post if enabled.
3.  User submits optional message; request is persisted.
4.  Head/authorized moderator reviews and approves/rejects (or requests
    clarification if supported).
5.  Decision is recorded and user notified.
6.  Approval grants configured permission; user can publish only after
    approval.

Example policies: General Discussion Everyone/Everyone; CSE Discussion
Members + approved/Members; University Announcements Head/Admin only;
Placement Updates Verified members/Members; Coding Club Members +
approved/Members.

Community areas: Discussions, About, Rules & Permissions, Members &
Moderators, Settings. Sensitive changes are audited. Privacy changes
must not expose previously private content.

## 6. Navigation and page contracts

  Page                    Responsibility
  ----------------------- ---------------------------------------------------------------
  Home                    Global feed: For You, Latest, Trending, Unanswered, Following
  Explore                 Discover communities/content; not a duplicate directory
  Communities             Community directory
  Community Discussions   Posts from that community only
  Discussion              One post/thread, attachments, actions, comments
  Events                  Event list/details
  People                  Discover profiles
  Saved                   Saved posts/private collections
  My Discussions          Current user's posts
  Notifications           Persistent activity/unread state
  Messages                Private conversations with privacy/block rules
  Search                  Discussions, people, communities, events, attachments

Quick links (Ask a Senior, Previous Year Papers, Syllabus, Placement
Prep, Internships, Scholarships, University Notices) must work. SPA must
support client navigation, Back/Forward, direct refresh and
authorization re-check on deep links. Sidebar collapse must reflow
without overlap or unnecessary page-state loss.

## 7. Posts and composer

Post types: Question, Discussion, Resource, Poll, Announcement,
Experience.

A post may include title, rich-text body, multiple
images/videos/documents, folder upload with hierarchy, safe
links/previews, poll, @mentions, tags, community, permitted anonymous
mode and comment/answer settings.

Composer: title/body, Images/Video/Files/Folder/Link, Poll, @Mention,
drag/drop, community selector with visible permission explanation,
tags/type, permitted anonymous toggle, comment/answer settings, Save
Draft and Post. Attachment preview shows type, filename, size, progress,
preview/remove; support failed/cancelled/retry states. Community
composer must receive a community ID string, not a React click event.

Actions: Like, Comment, Share, Save, Report, Helpful, Accepted Answer
(questions), Edit/Delete (authorized), Pin/Lock/Announce (authorized).
No up/down votes. Detail page includes author/verification, metadata,
body, attachments, permission-aware comments, sorting, nested replies
and locked state.

## 8. Social features

-   Nested comments/replies; parent visibility and locked-post checks.
-   Like and Helpful; Accepted Answer for questions.
-   Save/bookmark and private Saved Collections.
-   Follow/unfollow users.
-   Poll options, votes and expiry; permissions follow posting by
    default unless separately configured.
-   Prevent duplicate reactions, saves, follows and votes.
-   Counts come from server/database, never client input.
-   Optimistic UI only when it rolls back on server rejection.

## 9. Attachments and storage

Supported types discussed: images, video, PDFs, documents,
presentations, explicitly allowed files, folders and safe links. Exact
MIME allowlist/extensions/limits/count must be verified in code.

Upload lifecycle: temporary upload → validate content/metadata → create
post → attach permanent references → clean orphan temporary files on
failure → apply retention/deletion policy.

Validate extension, MIME/content where feasible, size and count.
Sanitize names; generate storage keys; never use user filename as path;
prevent traversal; distrust client metadata. Check parent post/community
access for every view/download. Protect private files from public static
paths and stale URLs. Large binaries belong in durable object/media
storage; MongoDB stores metadata/references. Use thumbnails/posters and
responsive media.

## 10. Events, profiles and membership

Events show date/time, venue/link, organizer and registration; detail
includes description, speakers, attachments and reminders. Only
authorized accounts publish official events.

Profiles expose intentionally selected data. Verified badge comes from
trusted server data. Join/leave and join requests are
persistent/idempotent. Private access requires configured approval.
Member/moderator lists are community-scoped.

## 11. Notifications and messaging

Notifications include replies, mentions, likes, follows, accepted
answers, request decisions, announcements and event reminders. Persist
notifications and unread/read state; deep links re-check access;
previews never leak private content; unread counts come from server.

Messaging requires one-to-one conversations/messages, conversation
membership checks on every action, block enforcement in existing
conversations, and no automatic private-message access for community
Heads/Moderators. Define delete-for-me/delete-for-everyone and
account-deletion behavior. Exceptional platform access needs explicit
policy.

**Feature parity rule:** if backend has Conversation/Message
models/APIs, frontend must provide the intended messaging experience. Do
not silently accept backend-only features. Likewise, every frontend
feature must map to an API/persistent model or be explicitly documented
as client-only.

## 12. Search, moderation and audit

Search posts, people, communities, events, attachments and folder/file
names. Filters may include
community/category/department/year/date/type/media. Search and trending
must respect privacy, lifecycle state, blocks/mutes and moderation.
Trending must be deterministic and never surface private/deleted
content.

Reports capture reason/target, route to correct scope and prevent spam.
Moderation includes review, approve/reject, pin/unpin, lock/unlock,
hide/remove, membership/moderator management and delegated permissions.
Conflicts involving Heads/Moderators escalate to the next authorized
level.

Define block/mute semantics and apply consistently across feeds, search,
comments, messages and notifications. Audit sensitive permission,
moderator, approval, removal/lock, ownership and admin actions with
actual actor identity.

## 13. Content lifecycle and tombstones

Documented states: `PENDING`, `ACTIVE`, `EDITED`, `LOCKED`, `HIDDEN`,
`REMOVED`, `DELETED`, `REJECTED`. Verify exact enums/transitions in
current code.

Approval-required posts start PENDING and move through authorized
approval/activation or rejection. Notify author; define edit/resubmit
policy; prevent prohibited self-approval. Pending/rejected posts must
not appear in unauthorized feeds/search/trending.

**Soft-delete requirement:** prior audit reported `deletePost()`
hard-deleted Post and attachments. Required behavior: set state/status
to `DELETED`; preserve record; hide from ordinary feeds/discovery; old
references show safe tombstone; prevent new comments/reactions/saves;
protect attachments from stale URL access; define attachment retention
separately. User prioritized this before WebSockets, SMTP, cloud storage
or Redis.

## 14. Design and responsive UX

Documented reference palette: navy `#012E55`, orange `#E16B1F`, soft
blue-gray/off-white `#F4F8FB` family, white surfaces, subtle borders and
restrained shadows. Actual latest CSS must be inspected before declaring
final tokens.

Compare complete CSS cascade, tokens, base/component rules, duplicate
selectors, overrides and media queries. Do not blindly replace a
stylesheet or append a few classes. Use one canonical token set and
verify all breakpoints.

-   Desktop: collapsible sidebar; main content reflows; right rail where
    appropriate.
-   Tablet: adaptive columns; right rail may collapse; drawer
    navigation.
-   Mobile: one column, drawer/backdrop, route change closes drawer,
    Escape closes, mobile composer, no horizontal overflow, touch
    targets, keyboard-safe controls and safe areas.
-   Sidebar state changes without full reload and preserves
    route/content.
-   Prior AI Studio sidebar reportedly had dynamic communities/tooltips;
    GitHub version had hardcoded communities/promo banner. Merge
    preference: retain dynamic behavior while preserving required
    existing navigation/drawer behavior; verify compatibility.

Accessibility: keyboard navigation, visible focus, ARIA state, alt text,
accessible dialogs, Escape/focus management, touch targets. Important
actions must not be hover-only.

Required UI states: Loading, Empty, Success, Error, Disabled,
Unauthorized, Permission Denied, Pending Approval, Approved, Rejected,
Locked, Deleted/Removed/Unavailable, Upload Progress/Failed/Cancelled
and Retry.

## 15. Technical architecture and data

Documented stack: React + Vite, React Router, Node.js + Express,
MongoDB + Mongoose, existing auth/session flow. Durable media/object
storage is production target.

Entities discussed: User, Community,
CommunityMember/CommunityMembership, Post, Attachment, Folder, Comment,
Reaction, Save, Follow, Poll, PollVote, JoinRequest, PostRequest,
Report, Notification, Conversation, Message, Event, AuditLog, Block and
Mute. Historical docs disagree on model count; inventory current code
before claiming a count.

Relationships must be explicit; index common feeds/lookups; unique
constraints for membership/reaction/save/follow/vote as appropriate;
atomic counters; client counters never overwrite server truth.
Consistent API errors must cover unauthorized, permission denied, not
found, validation, conflict, rate limit and server error.

## 16. Security and reliability

Authorization evaluation: authentication/session → resource existence →
visibility/privacy → block restrictions → membership/status → exact
community role → delegated permission → requested action → allow/deny.

Every protected API checks authorization for posts/comments, reactions,
saves, follows, membership, requests, approvals, attachments, polls,
moderation, reports, messages, settings and admin actions.

Sanitize/validate input; reject unsafe URLs; never execute user HTML/JS;
rate-limit abuse; safe errors; HTTPS/CORS allowlist; secrets
server-side; never log passwords/tokens/private message bodies; re-check
permissions each request. Direct IDs/deep links never grant access.

Prevent duplicate actions. No permanent success before server
confirmation. Provide retry/rollback and preserve unsent composer text
where feasible. Use stable pagination, lazy media, debounced search,
indexes and performance suitable for Indian mobile networks/lower-end
devices.

## 17. Dashboards

Platform Admin areas discussed: Overview, Users, Communities, Posts,
Reports, Post Requests, Moderators, Events, Platform Settings and Audit
Logs. Keep personal profile, community management and Platform Admin
scopes separate.

## 18. Historical issues to re-test (not assumed still broken)

-   Explore and Communities appeared identical.
-   Public community posting forced join when policy should allow public
    posting.
-   Trending and Senior Quiz links failed.
-   Demo accounts failed login.
-   Sidebar collapse/reflow/mobile drawer needed improvement.
-   Some visible controls were nonfunctional.
-   Possible secrets exposure in environment/frontend config.
-   Local MongoDB `ECONNREFUSED` and Atlas authentication errors
    occurred.
-   Hard-delete/tombstone issue reported.
-   Multer dependency/lockfile mismatch reported.
-   Upload validation and authorization fixes were reported but runtime
    tests remained pending.

Re-audit current GitHub before relying on any status.

## 19. Mandatory engineering workflow

**Audit → File mapping → Dependency planning → File-wise repair →
Validation → Integration testing.**

1.  Inspect current GitHub branch, commit, tree and runtime.
2.  Protect current work; preserve backend/database.
3.  Inventory backend models, routes, middleware, controllers, services
    and environment variable NAMES (never values).
4.  Inventory frontend routes/pages/components/API clients/visible
    controls.
5.  Build backend↔frontend feature parity matrix.
6.  Map AI Studio files to GitHub `frontend/` paths.
7.  Compare imports, API contracts, auth, permissions, routes and CSS
    before editing.
8.  Plan dependencies; group all fixes per file; avoid repeated edits.
9.  Use exact paths/search anchors; never invent line numbers.
10. Preserve unrelated behavior; review cumulative diff.
11. Run syntax, lint/build, API, integration, role/permission,
    responsive and security tests.
12. Commit coherent changes; deploy only after verification.
13. Never claim a test passed unless it actually ran.

### Editing rules

-   Work on existing project; do not rebuild.
-   Never force-push AI Studio frontend-only snapshot over full repo.
-   Do not casually change login/authentication.
-   Do not remove backend routes/schemas/controllers/services/middleware
    to make frontend compile.
-   Do not invent APIs, fields, roles, enums or permissions.
-   Compare one file at a time; preserve unrelated behavior.
-   Review cumulative diff and test before dependent files.
-   Work one issue/file at a time.

## 20. Acceptance checklist

**Feature parity:** every intended backend feature has frontend
route/view/action; every frontend feature maps to real API and
persistence or is explicitly client-only. Specifically audit
Conversations/Messages, notifications, reports, events, folders, polls,
saved collections, moderation and admin. No fake buttons, mock success
or frontend-only permission.

**Roles:** Head A/Moderator B/Member C do not leak roles; open community
permits non-member posting; members-only/approved/Head-only/private
policies work; private content hidden; moderator actions scoped;
Platform Admin separate; every protected API checks authorization.

**Posts/files:** text and mixed attachments, multiple media, folders,
safe links, polls, mentions, drafts, community preselection, approval,
tombstones, locked/deleted restrictions, file validation and
private/stale URL denial, upload progress/failure/retry/cancel.

**Navigation:** Home global; community feed scoped; Explore differs from
Communities; Trending/quick links work; search privacy;
Back/Forward/refresh/deep links; sidebar reflow; mobile drawer/Escape.

**Social/communications:** Like, Helpful, Accepted Answer,
comments/replies, save/follow; persistent notifications without leaks;
messages enforce membership/block; report routing; separate
Head/Moderator/Admin scopes; audit logs.

**Responsive/security:** desktop/tablet/mobile; no overflow/clipping;
keyboard/focus/ARIA/touch; no secrets or private-data leaks; duplicate
prevention/rate limits/retry rollback; no success before server
confirmation.

## 21. Priority order

1.  Inspect current GitHub tree/commit.
2.  Protect work and preserve backend.
3.  Merge AI Studio frontend into existing `frontend/` file by file.
4.  Complete CSS comparison.
5.  Verify Sidebar/Navbar/MainLayout/routes.
6.  Fix Explore vs Communities and public/private posting.
7.  Resolve tombstone and attachment lifecycle.
8.  Finish upload validation and lockfile reconciliation.
9.  Verify authorization/privacy.
10. Run full feature/role/responsive/security tests.
11. Deploy after verification.
12. Optional infrastructure only after core acceptance.

Do not add WebSockets, SMTP, cloud storage, Redis, AI recommendations,
gamification, PWA/offline or rich analytics ahead of core correctness.

## 22. Unresolved items --- do not guess

Exact current model count/names; API inventory/contracts; final CSS
tokens/breakpoints; upload MIME/extensions/limits; durable
storage/retention; block/mute semantics; message/account deletion;
rejected-post resubmission; moderator self-approval; pin/announcement
policy; notification preferences/retention; password recovery scope;
current implementation/test status; deployment status; whether frontend
changes are committed/tested.

## 23. Rules for the coding assistant

Read this specification **and**
`GEETA_UNIVERSITY_DISCUSSION_SYSTEM_ARCHITECTURE.md` before project
work. Treat requirements as target behavior, not proof. Inspect current
repository. Maintain a feature parity matrix. Backend feature without
frontend = integration gap, not permission to delete backend. Frontend
feature without backend = integration gap unless explicitly client-only.
Preserve auth/APIs/schemas/roles/data/deployment. Never include secrets.
Test end-to-end and record evidence. If uncertain, inspect and report
uncertainty instead of guessing.

**END OF MASTER SPECIFICATION**