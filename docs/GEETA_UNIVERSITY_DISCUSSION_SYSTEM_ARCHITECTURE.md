# GEETA UNIVERSITY DISCUSSION

## System Architecture, Feature Flow & Integration Map

**Version:** 1.0 \| **Prepared:** 31 October 2026\
**Companion:** `GEETA_UNIVERSITY_DISCUSSION_MASTER_SPECIFICATION.md`

> This is the target logical architecture derived from the master
> specification. It does not prove that every component, route or
> endpoint already exists. Verify exact filenames, model names, route
> paths and contracts in the current GitHub repository before
> implementation.

## 1. System context

``` mermaid
flowchart LR
    U[Students / Faculty / Researchers] --> FE[React + Vite Frontend]
    PA[Platform Admin] --> FE
    FE --> API[Express REST API]
    API --> AUTH[Authentication + Authorization]
    AUTH --> SVC[Controllers / Services]
    SVC --> DB[(MongoDB + Mongoose)]
    SVC --> STORE[File / Object Storage]
    SVC --> EVENTS[Notifications / Domain Events]
    EVENTS --> DB
```

Logical deployment: Vercel frontend → HTTPS API on Render → MongoDB
Atlas. Media storage implementation must be inspected; durable object
storage is the production target. Frontend API URL, Vercel rewrite (if
used), Render CORS allowlist and Atlas network access must agree. Never
expose MongoDB URI, JWT secret or SMTP credentials in Vite `VITE_*`
variables or browser bundles.

## 2. Layer responsibilities

  ------------------------------------------------------------------------
  Layer                   Responsibility           Must not do
  ----------------------- ------------------------ -----------------------
  React pages/components  Display data, collect    Grant permissions
                          input, render states,    authoritatively
                          navigate                 

  Frontend API client     Centralize HTTP, auth,   Invent success or
                          errors and response      bypass API
                          parsing                  

  Express routes          Map method/path to       Duplicate business
                          middleware/controller    rules

  Auth middleware         Validate                 Trust client-sent role
                          identity/session/token   

  Policy/authorization    Check resource           Rely on hidden buttons
                          visibility, membership,  
                          role and action          

  Controllers             Validate request and     Scatter business policy
                          format response          

  Services/domain logic   Enforce workflows and    Trust client
                          invariants               counters/ownership

  Mongoose models         Schema, validation,      Replace authorization
                          indexes and              
                          relationships            

  Storage adapter         Validate/store/serve     Expose private files
                          files under policy       publicly

  Tests/observability     Verify and diagnose      Claim unrun tests
                          behavior                 passed
  ------------------------------------------------------------------------

## 3. Request lifecycle

``` mermaid
sequenceDiagram
    participant UI as React UI
    participant API as API Client
    participant R as Express Route
    participant A as Auth Middleware
    participant P as Authorization Policy
    participant S as Controller / Service
    participant DB as MongoDB
    UI->>API: User action
    API->>R: HTTP request + session/token
    R->>A: Validate identity
    A-->>R: Authenticated principal
    R->>P: Check resource and action
    P->>DB: Load resource, state and membership
    DB-->>P: Current context
    P-->>R: Allow or deny
    R->>S: Validated request
    S->>DB: Read/write persistent data
    DB-->>S: Result
    S-->>API: Consistent response
    API-->>UI: Update from server result
```

Protected action evaluation: session validity → resource existence →
visibility/privacy → block restrictions → membership/status → exact
community role → delegated permission → requested action → allow/deny.
Every protected API repeats checks. UI visibility is not security.

## 4. Frontend application map

Exact paths must be confirmed from repository tree.

``` mermaid
flowchart TD
    APP[App / Router] --> LAYOUT[Main Layout]
    LAYOUT --> NAV[Navbar]
    LAYOUT --> SIDE[Collapsible Sidebar / Mobile Drawer]
    LAYOUT --> RIGHT[Rightbar where appropriate]
    LAYOUT --> ROUTES[Route Outlet]
    ROUTES --> HOME[Home: global feed]
    ROUTES --> EXPLORE[Explore: discovery]
    ROUTES --> COMM[Communities: directory]
    ROUTES --> COMMUNITY[Community detail / scoped feed]
    ROUTES --> POST[Discussion detail]
    ROUTES --> EVENTS[Events]
    ROUTES --> PEOPLE[People / Profiles]
    ROUTES --> SAVED[Saved / Collections]
    ROUTES --> MINE[My Discussions]
    ROUTES --> NOTIF[Notifications]
    ROUTES --> MSG[Messages]
    ROUTES --> SEARCH[Search]
    ROUTES --> ADMIN[Platform Admin]
    LAYOUT --> COMPOSER[Global Create Discussion Composer]
```

Navigation invariants: Home is global; community feed is scoped; Explore
differs from Communities; direct routes/refresh/Back/Forward work;
sidebar collapse reflows without overlap; mobile drawer closes on route
change and Escape; quick links work. Personal profile, community
management and Platform Admin are separate scopes.

## 5. Backend module map

Use existing repository modules; do not create duplicates if equivalent
code exists.

``` mermaid
flowchart TB
    ROUTER[Express App / API Router]
    ROUTER --> AUTHR[Auth Routes]
    ROUTER --> USER[User / Profile]
    ROUTER --> COMMUNITY[Community / Membership]
    ROUTER --> POST[Post / Feed]
    ROUTER --> COMMENT[Comment / Reaction]
    ROUTER --> ATTACH[Upload / Attachment / Folder]
    ROUTER --> POLL[Poll]
    ROUTER --> EVENT[Event]
    ROUTER --> SEARCH[Search / Trending]
    ROUTER --> NOTIFY[Notification]
    ROUTER --> MESSAGE[Conversation / Message]
    ROUTER --> MOD[Report / Moderation]
    ROUTER --> ADMIN[Platform Admin]
    AUTHR --> MW[Auth + Validation + Rate Limits]
    USER --> MW
    COMMUNITY --> MW
    POST --> MW
    COMMENT --> MW
    ATTACH --> MW
    POLL --> MW
    EVENT --> MW
    SEARCH --> MW
    NOTIFY --> MW
    MESSAGE --> MW
    MOD --> MW
    ADMIN --> MW
    MW --> CTRL[Controllers]
    CTRL --> DOMAIN[Services / Policies]
    DOMAIN --> MODELS[Mongoose Models]
    MODELS --> DB[(MongoDB)]
    DOMAIN --> STORAGE[Storage Adapter]
```

Modules may use different filenames or combined controllers. Inventory
before restructuring.

## 6. Feature-to-layer integration matrix

Add exact endpoint names, model names and paths only after inspecting
the repository.

  -------------------------------------------------------------------------------------------------------------------------------------------------
  Feature               Frontend surface                Backend responsibility          Persistence                        Critical tests
  --------------------- ------------------------------- ------------------------------- ---------------------------------- ------------------------
  Auth/session          Register/login/logout/session   Validate credentials/session,   User/session state                 invalid login, expiry,
                                                        safe identity                                                      role escalation

  Profile/People        Profile, directory, follow      Safe projection, follow policy  User, Follow                       no private fields;
                                                                                                                           idempotency

  Communities           Directory/detail/join           Visibility, membership, policy  Community, CommunityMember         public/private
                                                                                                                           visibility

  Community roles       Members/moderators/settings     Exact community role/delegation CommunityMember                    no role leakage

  Home/feed             Global feed/tabs                Visibility, filters, pagination Post + related                     global scope/privacy

  Explore               Discovery                       Discovery queries               Community/Post/etc.                differs from directory

  Composer/posts        Create/edit/draft/detail        Create/update/delete/approval   Post                               ownership, validation,
                                                                                                                           community ID

  Attachments/folders   Upload/preview/folder tree      Validate/store/authorize        Attachment, Folder + storage       MIME/size/path/private
                                                        downloads                                                          URL

  Comments              Thread/composer                 Parent visibility, lock,        Comment                            hidden parent/locked
                                                        replies                                                            post

  Reactions             Like/helpful                    Duplicate prevention/counts     Reaction                           idempotency, server
                                                                                                                           counts

  Accepted answer       Question detail                 Authorized answer state         Post/answer state                  actor/state policy

  Saves                 Saved/collections               User-scoped save/list           Save/collection                    privacy and duplicates

  Polls                 Composer/vote/results           Eligibility, vote/expiry        Poll, PollVote                     duplicate/expired vote

  Events                List/detail/register            Publish authorization           Event/registration                 publisher scope

  Notifications         Center/unread                   Persist/read/list/deep links    Notification                       unread persistence/no
                                                                                                                           leaks

  Messages              Inbox/thread/compose            Membership and block rules      Conversation, Message              non-member denied

  Search/trending       Search/filter/cards             Ranking and visibility          Indexed entities/activity          private/deleted excluded

  Reports/moderation    Report/review queues            Scope, escalation, actions      Report, AuditLog                   unauthorized action
                                                                                                                           denied

  Platform Admin        Admin dashboard                 Platform-wide policy            User/community/post/report/audit   community role ≠ admin

  Blocks/mutes          Profile/settings                Apply across features           Block/Mute                         feed/search/messages

  Audit                 Audit view                      Record actor/action             AuditLog                           actor and history
                                                                                                                           preserved
  -------------------------------------------------------------------------------------------------------------------------------------------------

### Mandatory parity rule

For every backend capability record: intended role; frontend
route/component/action; frontend API method; HTTP method + exact route;
request/response schema; auth/policy; model/side effects;
loading/empty/error/denied states; test evidence.

Backend capability with no frontend = **frontend integration gap**, not
permission to delete backend. Frontend capability with no
API/persistence = **backend integration gap**, unless explicitly
client-only.

## 7. Core feature flows

### 7.1 Create discussion with mixed attachments

``` mermaid
sequenceDiagram
    participant U as User
    participant UI as Composer
    participant API as Upload / Post API
    participant P as Permission Policy
    participant S as Storage
    participant DB as MongoDB
    U->>UI: Select community, write post, add files
    UI->>API: Upload temporary files
    API->>P: Authenticate + check upload permission
    P-->>API: Allow/deny
    API->>S: Validate and store temporary objects
    S-->>API: Temporary references
    API-->>UI: Upload progress/status
    U->>UI: Submit discussion
    UI->>API: Create post + attachment references
    API->>P: Re-check posting permission
    P-->>API: Allow/deny
    API->>DB: Persist post and attachment metadata
    DB-->>API: Created post
    API-->>UI: Confirmed response
    UI->>UI: Navigate to /discussions/:id
```

If post creation fails, clean orphan temporary objects according to
policy. Never show permanent success before API confirmation. Re-check
permission at final submission.

### 7.2 Community access and request-to-post

``` mermaid
flowchart TD
    A[Open community] --> B{Can user view?}
    B -- No --> X[Unavailable / request access]
    B -- Yes --> C[Load policy and membership]
    C --> D{Can user post?}
    D -- Yes --> E[Enable composer]
    D -- No --> F{Request enabled?}
    F -- Yes --> G[Explain + Request to Post]
    F -- No --> H[Explain restriction]
    G --> I[Persist request]
    I --> J[Notify Head / delegated moderator]
    J --> K{Decision}
    K -- Approve --> L[Grant configured permission + notify]
    K -- Reject --> M[Persist rejection + notify]
    L --> E
```

The same policy is enforced by every write API, not just the composer.

### 7.3 Comments, replies and accepted answer

``` mermaid
flowchart TD
    A[Open discussion] --> B[Check visibility and state]
    B --> C{Visible and active?}
    C -- No --> D[Safe unavailable/locked state]
    C -- Yes --> E[Load comments with parent visibility]
    E --> F{Comments allowed and user permitted?}
    F -- No --> G[Read-only explanation]
    F -- Yes --> H[Submit comment/reply]
    H --> I[Re-check auth, parent, lock and policy]
    I --> J{Allowed?}
    J -- No --> K[Permission/error state]
    J -- Yes --> L[Persist comment]
    L --> M[Update from server response]
    M --> N{Accepted-answer action?}
    N -- Yes --> O[Authorized actor accepts answer]
    N -- No --> P[Finish]
```

### 7.4 Messaging / conversations

``` mermaid
sequenceDiagram
    participant A as Sender UI
    participant API as Message API
    participant AUTH as Auth + Conversation Policy
    participant DB as MongoDB
    participant B as Recipient UI
    A->>API: Send message with conversation ID
    API->>AUTH: Validate session, membership and block
    AUTH->>DB: Load current membership/block state
    DB-->>AUTH: Current context
    AUTH-->>API: Allow/deny
    API->>DB: Persist message and update conversation
    DB-->>API: Saved message
    API-->>A: Confirmed message
    API-->>B: Supported notification/unread update
```

Every list/read/send/delete checks conversation membership. Community
Head/Moderator does not gain private-message access. If messaging is
enabled, frontend must include inbox, conversation list, thread, compose
and empty/error states.

### 7.5 Soft delete / tombstone

``` mermaid
flowchart TD
    A[Authorized delete request] --> B[Check owner/moderator policy]
    B --> C{Authorized?}
    C -- No --> D[403 / safe error]
    C -- Yes --> E[Set state DELETED]
    E --> F[Preserve post and audit trail]
    F --> G[Hide from feeds/search/trending]
    G --> H[Block new comments/reactions/saves]
    H --> I[Protect attachment access]
    I --> J[Old deep link shows safe tombstone]
```

Do not hard-delete post and attachment records by default. Attachment
retention/cleanup is a separate policy.

### 7.6 Notifications

``` mermaid
flowchart LR
    EVT[Authorized domain event] --> N[Notification service]
    N --> CHECK[Check recipient and privacy]
    CHECK --> DB[(Persist notification)]
    DB --> UI[Notification center]
    UI --> READ[Mark read]
    READ --> DB
    UI --> DEEP[Open deep link]
    DEEP --> AUTHZ[Re-check target authorization]
```

### 7.7 Search and trending

``` mermaid
flowchart TD
    Q[Search / Trending request] --> AUTH[Resolve user context]
    AUTH --> FILTER[Privacy, block, lifecycle and moderation filters]
    FILTER --> QUERY[Indexed query / ranking]
    QUERY --> PAGE[Stable cursor pagination]
    PAGE --> SAFE[Safe result projection]
    SAFE --> UI[Cards and filters]
```

Never return private, pending, rejected, hidden, removed or deleted
content to an unauthorized viewer.

## 8. Authorization map

Do not trust `role`, `userId`, `isAdmin`, owner ID or counts sent by
browser.

  -----------------------------------------------------------------------
  Resource/action                     Required check
  ----------------------------------- -----------------------------------
  Edit/delete post                    Owner or authorized moderator of
                                      parent community; platform admin
                                      only via explicit policy

  Comment/reply                       Parent visible; comments unlocked;
                                      user permitted

  Attachment                          Parent post/community visibility
                                      and current authorization

  Community settings                  Head or delegated moderator for
                                      that exact community

  Membership/moderator management     Exact community role and delegated
                                      capability

  Message read/send/delete            Conversation membership and block
                                      state

  Platform Admin action               Platform Admin authorization, not
                                      community role

  Report review                       Correct scope and escalation rules
  -----------------------------------------------------------------------

Check every request including direct IDs and old URLs. Permission
revocation takes effect on the next protected request.

## 9. Logical data relationships

Verify actual schemas; this is a conceptual map.

``` mermaid
erDiagram
    USER ||--o{ POST : authors
    USER ||--o{ COMMENT : writes
    USER ||--o{ COMMUNITY_MEMBER : joins
    COMMUNITY ||--o{ COMMUNITY_MEMBER : has
    COMMUNITY ||--o{ POST : scopes
    POST ||--o{ ATTACHMENT : contains
    POST ||--o{ COMMENT : has
    COMMENT ||--o{ COMMENT : replies
    POST ||--o| POLL : may_have
    POLL ||--o{ POLL_VOTE : receives
    USER ||--o{ REACTION : creates
    POST ||--o{ REACTION : receives
    USER ||--o{ SAVE : saves
    POST ||--o{ SAVE : saved_as
    USER ||--o{ NOTIFICATION : receives
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ AUDIT_LOG : performs
```

Entities discussed: User, Community,
CommunityMember/CommunityMembership, Post, Attachment, Folder, Comment,
Reaction, Save, Follow, Poll, PollVote, JoinRequest, PostRequest,
Report, Notification, Conversation, Message, Event, AuditLog, Block and
Mute. Exact model count/names are unresolved until code inventory.

## 10. Feature parity register

Recommended repository artifact: `docs/FEATURE_PARITY_MATRIX.md`.

  Field                 Evidence required
  --------------------- ------------------------------------------------------------
  Feature ID/name       Stable identifier
  Requirement           Master spec section
  Frontend route/page   Exact path
  Component/action      Exact path/export
  API client            Exact method/path
  Backend route         HTTP method + exact route
  Middleware/policy     Auth, role, ownership, resource checks
  Controller/service    Exact path/function
  Model/storage         Exact schema/collection/storage
  States/errors         Loading, empty, success, error, denied, retry
  Tests                 Test path/command/result
  Status                Verified / Partial / Missing / Broken / Not verified / N/A

**Verified** means end-to-end test passed. Code search or successful
frontend build alone is insufficient.

## 11. Repository audit procedure

### Phase A --- read-only inventory

1.  Record Git branch and commit.
2.  List root/frontend/backend trees.
3.  Inspect package scripts/dependencies.
4.  Inventory frontend routes/pages/components/API services.
5.  Inventory backend routes/middleware/controllers/services/models.
6.  Inventory environment variable names only, never values.
7.  Search feature families, including Conversation/Message.
8.  Build backend↔frontend parity matrix.
9.  Find dead routes, unreferenced APIs, controls without handlers and
    handlers without API calls.
10. Inspect tests and run safe existing checks.

### Phase B --- plan

1.  Resolve ambiguous decisions explicitly.
2.  Map requirements to files/dependencies.
3.  Identify schema/API compatibility and migration risks.
4.  Plan dependency order.
5.  Group edits per file to avoid repeated rewrites.

### Phase C --- repair

1.  Fix data integrity/security first.
2.  Repair backend contracts and authorization.
3.  Integrate frontend with existing APIs.
4.  Add UI for existing backend features; do not silently remove
    backend.
5.  Align responsive design and interaction states.
6.  Preserve unrelated behavior.

### Phase D --- validate

1.  Syntax/lint.
2.  Frontend production build.
3.  Backend startup/database connection.
4.  API contract tests.
5.  Role/permission tests across multiple communities.
6.  End-to-end feature tests.
7.  Desktop/tablet/mobile checks.
8.  Security/privacy tests.
9.  Deployment smoke tests.
10. Record actual command, result and remaining risk.

## 12. Minimum end-to-end journeys

1.  Student registers/logs in and sees safe profile.
2.  Student posts in open community without joining when policy permits.
3.  Non-member is denied in members-only community; request flow works
    if enabled.
4.  Head changes policy; API enforces immediately.
5.  User creates mixed-attachment post and opens detail route.
6.  User comments/replies; locked post rejects comments.
7.  Authorized actor accepts answer.
8.  User saves post; another user cannot see private collection.
9.  Poll accepts one valid vote and rejects duplicate/expired vote.
10. Notification persists; deep link re-checks access.
11. Conversation member can message; non-member/blocked sender denied.
12. Moderator moderates assigned community only.
13. Platform Admin privilege is not granted by community role.
14. Deleted post disappears from feeds/search and old link shows
    tombstone.
15. Private attachment denied after access revocation.
16. Search/trending never reveal private/deleted content.
17. Sidebar collapse, mobile drawer, Back/Forward and refresh work.
18. Every visible control and quick link performs its advertised action.

## 13. Change safety rules

-   No blind full-file replacement or frontend-only force push.
-   No API/schema/role change without tracing consumers.
-   Never delete backend feature to hide missing UI.
-   No fake/mock feature presented as production.
-   No hard delete where tombstone is required.
-   No secrets in docs, commits, bundles or logs.
-   Never run production seeder/destructive DB commands without
    reviewing effects, target, backup and explicit approval.
-   Inspect `git status` and diff before edits.
-   One issue/file group at a time; validate before dependent work.

## 14. Priority order

1.  Repository/source-of-truth audit.
2.  Secrets, auth and data-integrity review.
3.  Backend route/model/permission inventory.
4.  Frontend route/API/UI inventory.
5.  Feature parity matrix, including Conversation/Message.
6.  Fix authorization and tombstone behavior.
7.  Fix upload validation/storage access and lockfile consistency.
8.  Merge frontend reference file-by-file while preserving backend.
9.  Fix navigation and public/private community behavior.
10. Full feature, role, responsive, accessibility and security tests.
11. Deploy and smoke-test.
12. Only then consider WebSockets, SMTP, Redis, advanced
    recommendations, PWA, gamification and analytics.

## 15. Required phase handoff

After each phase report: commit/branch inspected; files
inspected/changed; features verified/partial/missing/broken; API↔UI
gaps; tests actually run and results; security/data risks; decisions
pending; next smallest safe step.

**END OF SYSTEM ARCHITECTURE**