# Upload and Attachment Storage Lifecycle

## Upload staging
- Uploads are accepted only through the authenticated, rate-limited upload endpoint.
- Multer generates an opaque storage key containing the authenticated uploader ID and random bytes.
- Each request is limited to five files and 25 MB per file; extensions and declared MIME types must match the server allowlist.
- The upload response normalizes the display filename and does not trust client-supplied folder paths.
- A staged file is not publicly retrievable until an Attachment record links it to a post. The download endpoint resolves the Attachment and checks the parent post and community permissions before streaming.

## Linking staged files to posts
- Post creation validates the generated storage-key format and uploader ownership.
- It checks the file exists as a regular non-symlink file inside the expected upload category directory.
- Attachment records retain the generated storage key and are associated with the new post.

## Expiration and cleanup
- Unclaimed staged uploads older than 24 hours are eligible for cleanup when the backend starts.
- Cleanup only considers generated storage keys in the images, videos, and files directories.
- It checks MongoDB Attachment references before unlinking a file.
- Files referenced by Attachment records are retained, including attachments belonging to soft-deleted posts, so deletion history and retention policy are not silently bypassed.
- Failed upload response preparation removes files created by that upload request.

## Deletion and access
- Soft-deleting a post does not physically delete its attachment files.
- Attachment streaming and metadata access reject deleted or removed parent posts.
- Folder listing for deleted or removed posts returns no attachments or folders.
- Explicit attachment deletion remains a separate authorized operation.

## Operational limitations
- Cleanup currently runs once during backend startup, not as a recurring background worker.
- The 24-hour retention period is a fixed code constant, not an environment setting.
- Content signature / malware scanning is not implemented by this change; the extension and declared MIME allowlist is not a substitute for file-content inspection.
- No tests or deployment verification are implied by this document.

## Post, comment, and poll lifecycle enforcement

- Replies must reference an existing, non-deleted parent comment belonging to the same post. Cross-post and deleted-parent reply attempts are rejected.
- Comment bodies must be non-empty strings and are capped at 10,000 characters.
- Poll voting is allowed only while the parent discussion is published and unlocked. Locked, pending, rejected, deleted, and removed discussions cannot receive votes.
- Like, save, and helpful updates include an active discussion status condition in the database write itself. This prevents a request that races with post deletion from mutating the interaction arrays after the post becomes unavailable.
- No test/build/integration verification was run as part of this implementation batch.

## Community permission and moderation hardening

- Community settings updates are limited to the community owner or platform admin; moderators cannot change community-wide policy.
- Permission updates accept only the documented visibility, post/comment/share policy, boolean policy flags, and custom user allowlist fields. Unknown keys and invalid enum/boolean/ObjectId values are rejected with a validation response.
- Community rules are validated as an array of at most 30 entries with bounded title and description lengths.
- Comment policy fails closed for unknown stored policy values.
- The MEMBERS comment policy checks active membership, not the separate `canPost` flag. Revoking permission to publish posts therefore does not silently revoke the ability to comment when the configured comment policy allows members to comment.
- APPROVED_USERS commenting continues to require an active membership whose `canPost` permission is enabled.
- Sharing fails closed for unknown stored share-policy values; only EVERYONE, MEMBERS, and DISABLED are accepted.
- Moderator capabilities remain community-scoped: delegated moderation operations require the exact permission on the exact active community membership. General moderator identity is used only for community surfaces that intentionally allow all active moderators, such as viewing the member list or audit trail.
