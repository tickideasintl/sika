# Receipt ownership upgrade

Apply migration `0045_stored_object_ownership` before running the updated
application. It adds a record of which workspace owns each uploaded storage
object. Uploads, receipt assignment, document downloads/deletions, and workspace
archives check that ownership rather than trusting a caller-supplied storage key.

## Existing attachments

The migration preserves ownership for unambiguous supporting documents created
through the file-upload endpoint. It deliberately does not trust old transaction
receipt references or `legacy-*` documents: those fields could previously contain
an arbitrary storage key.

Unverified historical receipts must be re-uploaded or removed from their
transactions. Workspace archives containing these references fail with an
attachment-ownership error instead of downloading an unauthorized file. Unrelated
transaction edits remain possible unless they explicitly resubmit the unverified
receipt reference. JSON exports remain available.

No receipt files are deleted by the migration. Back up both PostgreSQL and object
storage before upgrading. Preserve the new `stored_objects` table in database
backups; it is required to authorize restored attachments.

## Storage configuration

Use private object storage. These checks protect application-mediated access;
they cannot revoke a public bucket policy or an already-public CDN URL.
