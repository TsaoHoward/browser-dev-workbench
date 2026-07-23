# Slice 03 — Persistent browser workspace

| Field        | Value                   |
| ------------ | ----------------------- |
| Status       | planned                 |
| Owner        | repository contributors |
| Dependencies | Slice 02 completed      |

## Goal

Provide a recoverable browser-local workspace loop for files and workspace metadata while clearly
separating it from non-restorable runtime process state.

## Scope

1. Define the canonical persisted workspace record, schema versioning, migrations, validation, and
   recovery behavior. Include files, workspace identity, editor-relevant metadata, import
   provenance, and later local-repository linkage without persisting credentials.
2. Establish the responsibility split between IndexedDB and OPFS using measured browser PoCs:
   IndexedDB remains the current structured snapshot implementation; OPFS is evaluated where file
   volume, streaming, or Git-object storage needs justify it. Do not force a dual implementation
   before that evidence exists.
3. Add quota estimation, bounded writes, actionable quota/eviction/error handling, explicit clear
   behavior, and a safe migration/recovery path for invalid or partial records.
4. Restore files and metadata after reload when browser storage survives. Explicitly report that
   terminals, running commands, installed process memory, server URLs, and dev-server state are not
   restored and must be started again.
5. Preserve the existing public GitHub import's snapshot-conflict rules while generalizing its
   metadata so it remains a Remote Repository Adapter result, not the workspace's identity.

## Out of scope

- Claiming storage is durable across browser data clearing or eviction.
- Cross-device synchronization, background synchronization, GitHub authentication, or remote
  writes.
- Browser-local Git commands; Slice 04 decides its persistent repository representation.

## Acceptance criteria

- A multi-file workspace and metadata save, reload, migration, and restore through a bounded
  recoverable-storage loop.
- Quota, unavailable storage, corrupt data, migration failure, and explicit clear paths are tested
  and preserve a usable in-memory workspace or give a safe export/recovery option.
- Runtime process state is neither serialized nor implied to be recoverable in UI or documentation.
- The storage representation leaves a documented, tested integration point for Slice 04 without
  requiring a generic storage framework.

## Validation and exit conditions

Run focused storage/domain tests and `npm run validate`. Perform browser checks for save, reload,
clear, quota/error simulation where supported, and migration from the currently delivered snapshot.
Record the selected IndexedDB/OPFS responsibility split, actual quota evidence, and migration
limits before archiving.

## Open decisions before activation

1. Does the measured local-Git PoC require OPFS before Slice 04, or can versioned repository data
   fit safely in the selected IndexedDB representation?
2. What maximum workspace size and file-count budget is usable for this prototype?
3. Which workspace metadata is stable product state rather than transient UI preference?
