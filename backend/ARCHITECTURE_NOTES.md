# FlowDocs Day 1 Architecture Notes

- Yjs document state is the source of truth for collaborative content.
- Lexical is the editor and UI layer, not the canonical persistence layer.
- `Document.previewContent` is a preview/cache field and is not the authoritative document source.
- `Document.currentVersion` is advanced by the server and represents server-side ordering.
- `DocumentUpdate.version` is assigned by the server for accepted updates; clients do not generate versions.
- `DocumentUpdate.sourceClientId` is retained only for client identity and debugging.
- Snapshot cadence comes from config via `DOCUMENT_SNAPSHOT_INTERVAL` rather than hardcoded values.
- Restore uses the latest snapshot plus the update chain created after that snapshot.
- Presence remains in-memory and transient; it is not persisted to the database.
- Activity data remains durable in `ActivityLog`.
- `DocumentSnapshot.stateVector` is stored for future optimization, but is secondary in the initial restore path.
