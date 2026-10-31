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
