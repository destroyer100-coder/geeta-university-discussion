# Geeta University Discussion Platform
**Hardened Academic Discussion & Collaborative Learning Platform**

A secure, multi-community discussion and resource-sharing platform engineered specifically for Geeta University students, faculty, coordinators, and platform administrators.

---

## 🎨 Visual Identity & UI Source of Truth
This platform is designed from the ground up as a **campus-first academic community hub**, not a generic dashboard or anonymous Reddit clone.
- **Academic Discourse Focus**: Upvoting and "Helpful" badges replace anonymous downvoting/karma wars to encourage constructive collaboration.
- **Verified University Personas**: Visual distinction for Faculty, Placement Coordinators, Student Leaders, and Platform Admins.
- **Unified Post Composer**: Clean multi-attachment composer supporting academic notes, PDF slide decks, ZIP archives, interactive polls, code structures, and rich text.
- **Campus Community Structure**: Departmental branches (CSE, ECE), academic batches, campus clubs, hostel boards, and placement channels.

---

## 🏛️ System Architecture & 20 Core Mongoose Models

The database layer consists of **20 standalone indexed Mongoose models** with relational integrity and compound unique constraints:

1. **`User`** (`User.js`): Account profiles, authentication credentials, university email verification, platform roles (`student`, `faculty`, `coordinator`, `admin`), bio, avatar, and system status.
2. **`Community`** (`Community.js`): Departmental, club, or batch spaces with custom policies (`requirePostApproval`, `postPolicy`, `commentPolicy`, `visibility`, `category`, `bannerImage`).
3. **`CommunityMember`** (`CommunityMember.js`): Per-community user membership, role (`owner`, `moderator`, `member`, `approved_user`), status (`active`, `banned`, `muted`), and join timestamps with compound index `{ user: 1, community: 1 }`.
4. **`Post`** (`Post.js`): Core discussions, academic threads, announcements, and resource posts tied to communities with compound index `{ community: 1, isPinned: -1, createdAt: -1 }`.
5. **`Attachment`** (`Attachment.js`): File metadata (PDF, ZIP, DOCX, images, media) linked directly to posts with path traversal guards and parent-resource authorization.
6. **`Folder`** (`Folder.js`): Hierarchical folder structures for organized academic attachments within posts.
7. **`Comment`** (`Comment.js`): Nested and top-level responses to posts with ownership verification, comment locking, and tombstone masking.
8. **`SaveCollection`** (`SaveCollection.js`): User bookmark folders and collections for organized access to discussions and study materials.
9. **`Follow`** (`Follow.js`): User-to-user following graph with compound unique index `{ follower: 1, following: 1 }`.
10. **`Poll`** (`Poll.js`): Interactive question polls with single or multiple choice capabilities attached directly to posts.
11. **`PollVote`** (`PollVote.js`): Immutable vote records tracking voter identity and selected options with compound unique index `{ poll: 1, user: 1 }`.
12. **`PostRequest`** (`PostRequest.js`): Approval queue entries for moderated communities requiring review before publishing.
13. **`Report`** (`Report.js`): Flagged content items (posts, comments, users) escalated to community moderators or platform admins.
14. **`Notification`** (`Notification.js`): Activity alerts (replies, mentions, approvals, role updates) with deep-linking metadata.
15. **`Conversation`** (`Conversation.js`): Direct peer-to-peer messaging channel metadata and participant pairs.
16. **`Message`** (`Message.js`): Direct chat messages with block enforcement, delete-for-me, and unsend/delete-for-everyone capabilities.
17. **`AuditLog`** (`AuditLog.js`): Immutable administrative audit records tracking security, pin, lock, and moderation actions.
18. **`Block`** (`Block.js`): User-level bidirectional blocking relationship model with compound unique index `{ blocker: 1, blocked: 1 }`.
19. **`Mute`** (`Mute.js`): User-level feed suppression relationship model with compound unique index `{ muter: 1, muted: 1 }`.
20. **`Event`** (`Event.js`): Campus and community events calendar metadata with date and location tracking.

> **Embedded Reactions Architecture**:
> Likes and Helpful votes are modeled directly as **embedded ObjectId array fields** (`likes: [ObjectId]`, `helpfulVotes: [ObjectId]`) on `Post` and `Comment` schemas. This enables atomic, race-condition-free `$addToSet` and `$pull` operations without secondary table lookups.

---

## 🔄 Content State Machine

All discussions and comments follow a strictly enforced 8-state lifecycle:

| State | Constant | Description | Access & Visibility |
| :--- | :--- | :--- | :--- |
| **`PENDING`** | `CONTENT_STATUS.PENDING` | Submitted to a moderated community requiring approval | Visible only to author and community moderators/owners |
| **`ACTIVE`** | `CONTENT_STATUS.PUBLISHED` | Live and published discussion | Publicly visible according to community visibility rules |
| **`EDITED`** | `CONTENT_STATUS.EDITED` | Modified by the original author after publishing | Displays edit timestamp and version history indicator |
| **`LOCKED`** | `CONTENT_STATUS.LOCKED` | Comments and replies closed by a moderator/owner | Read-only; new interactions disabled |
| **`HIDDEN`** | `CONTENT_STATUS.HIDDEN` | Temporarily suppressed by moderation or filters | Hidden from standard community feeds |
| **`REMOVED`** | `CONTENT_STATUS.REMOVED` | Removed by a community moderator or platform admin | Renders a sanitized tombstone without author PII |
| **`DELETED`** | `CONTENT_STATUS.DELETED` | Soft-deleted by author or moderator | Preserves record for audit; renders tombstone; disables edits/interactions |
| **`REJECTED`** | `CONTENT_STATUS.REJECTED` | Rejected during post approval review | Author receives rejection reason and option to edit/resubmit |

### Soft Delete & Tombstone Semantics
- **Preservation for Audit**: Deleting a post sets its `status = 'deleted'`, unpins it, closes comments, and logs an immutable `AuditLog` entry.
- **Physical Media Retention**: Attachments and folder structures remain linked in the database for audit/reference without immediate physical disk unlinking.
- **Interaction Lockdown**: Posts in `DELETED` state strictly reject new likes, saves, helpful votes, comments, pins, locks, and resubmissions.
- **Sanitized Tombstone Rendering**: Non-author, non-moderator users requesting deleted discussions receive sanitized placeholder data (`[Discussion Removed]`) and are blocked from downloading attached media.

---

## 📁 Resource & Media Architecture

### No Isolated Resource Library
There is **no standalone or detached "Resource Library"**. Instead, learning resources, syllabus documents, lecture notes, ZIP archives, and PDFs are **first-class attachments directly embedded into discussion posts**. This unifies context, questions, answers, and study resources into cohesive discussion threads.

### Storage Architecture
- **Development**: Stored on the local filesystem (`backend/uploads/`) with sanitized UUID file keys and path-traversal prevention (`path.basename`).
- **Production**: Designed for Cloud Object Storage (e.g., AWS S3, Google Cloud Storage, or Cloudflare R2) backed by a CDN.
- **Upload Middleware**: **Multer** is utilized strictly as the multipart form-data parsing and upload middleware, streaming incoming streams to the configured storage driver.

---

## 🔒 Security & Authorization Principles

1. **Per-Community Role Scoping**: A user can be the *Owner* of Coding Club, a *Moderator* of CSE Discussion, and a regular *Member* of Placement Updates. Leaving or changing roles in one community has zero side-effects on others.
2. **Authoritative Backend Validation**: The frontend is treated as untrusted presentation. All permissions (`canPost`, `canComment`, `canModerate`, `canPin`, `canDeletePost`) are evaluated through a sequential backend pipeline.
3. **Link & Upload Safety**: Strict protocol whitelisting (`http:`, `https:`) blocking executable extensions and script injection vectors.
4. **Idempotency & Rate Limiting**: Dedicated rate limits for submissions, uploads, search, and reports to prevent automated abuse.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js** (v20.x or higher)
- **MongoDB** running locally on port `27017`

### 2. Backend Setup
```bash
cd backend
npm install
npm start        # Runs API server on http://localhost:5000
```

### Production Environment Requirements

Configure these backend environment variables before production deployment: `MONGODB_URI`, a unique `JWT_SECRET` of at least 32 characters, HTTPS `CORS_ORIGINS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `UNIVERSITY_EMAIL_DOMAINS`. Production requires university email verification; accounts that predate this policy may need to request a new verification email. Never paste production secrets into source control or test fixtures.

### Optional Integration-Test Fixtures

The manual HTTP permission tests require an isolated fixture database and the backend running against that same database. Configure `MONGODB_URI` to a disposable database ending in `_test`, set `ALLOW_TEST_FIXTURE_RESET=true`, and run `npm run seed:test` from `backend/`. The fixture script refuses production and refuses database names without the `_test` suffix. Do not use production credentials or data for these tests.

### 3. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev      # Runs client application on http://localhost:5173
```

---

## 🔐 Account Provisioning

The application does not expose pre-created demo accounts or shared demo credentials. Public registration creates student accounts. Faculty and administrator accounts must be provisioned by an authorized operator; public registration must never allow a user to choose or elevate their own role. No general-purpose database seed command is provided. The optional test fixtures are stored under `backend/tests/fixtures/` and reset only when `MONGODB_URI` points to a disposable database whose name ends in `_test`, `ALLOW_TEST_FIXTURE_RESET=true` is set, and `NODE_ENV` is not `production`. Never aim test scripts at a real or production database.

---

## 📋 Implemented Features vs. Known Gaps

### ✅ Implemented in Codebase
- **20 Mongoose Data Models** with compound indexing and relational constraints.
- **Embedded Reactions**: Atomic `$addToSet` and `$pull` arrays on `Post` and `Comment` for likes and helpful votes.
- **8-Stage Content State Machine**: `PENDING`, `ACTIVE` (`PUBLISHED`), `EDITED`, `LOCKED`, `HIDDEN`, `REMOVED`, `DELETED`, `REJECTED`.
- **Soft Delete & Tombstone Pipeline**: Soft post deletion preserving database records and attachments for audit, with sanitized tombstone rendering for normal users.
- **Community Management**: Customizable post/comment policies, approval queues, and pin limits (up to 3).
- **Rich Post Authoring**: Multi-attachment files, code folder trees, polls, tags, and category discovery.
- **Social Interactions**: Optimistic likes, helpful marks, bookmarks (`SaveCollection`), user/community following (`Follow`), and rate-limited reporting.
- **Moderation Tools**: Approval/rejection workflows, immutable audit logging (`AuditLog`), user blocks (`Block`), and mutes (`Mute`).
- **Direct Peer-to-Peer Messaging**: Unsend and delete-for-me capabilities.
- **Security Hardening**: Sanitized downloads, UUID file keys, JWT auth, and role-scoped authorization middleware.

### ⚠️ Known Gaps & Production Roadmap
- **Real-Time Gateway**: Live chat and instant notification delivery currently utilize REST polling; WebSocket / Socket.io server integration is planned for high-concurrency production deployments.
- **Email Verification & Delivery**: Production requires SMTP configuration and verified university email domains; the backend now fails fast if these are missing. Existing accounts without `emailVerifiedAt` need to complete/resend verification before login. A password-reset email flow is not implemented yet.
- **Cloud Object Storage Adapter**: Local disk storage in `backend/uploads/` must be swapped for an S3/GCS/R2 SDK client with signed URLs for cloud deployment.
- **Background Task Workers**: Asynchronous media processing and bulk email notifications are currently executed in-process; production transition will incorporate Redis / BullMQ workers.
