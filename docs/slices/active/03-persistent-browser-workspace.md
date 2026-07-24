# Slice 03 — Persistent browser workspace

| Field        | Value                   |
| ------------ | ----------------------- |
| Status       | active                  |
| Owner        | repository contributors |
| Dependencies | Slice 02 completed      |
| Activated    | 2026-07-24              |

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

## Decisions and implementation progress

- 2026-07-24 — IndexedDB is the sole Slice 03 workspace-snapshot implementation. A local Chromium
  probe successfully created and removed an OPFS file and committed a 5 MiB logical IndexedDB
  record, but storage estimates varied between approximately 5 GiB and 6 GiB and are not an exact
  accounting or durable-capacity promise. OPFS therefore remains a capability probe and a Slice 04
  local-Git storage candidate; this slice will not build a dual store.
- 2026-07-24 — The initial logical workspace budget matches the existing supported import boundary:
  at most 200 regular UTF-8 text files, 1 MiB per file, and 5 MiB total. Quota estimates may give
  an early warning but cannot admit or reject a save; the write result and `QuotaExceededError` are
  authoritative.
- 2026-07-24 — Stable persisted metadata is limited to workspace identity, the selected editor path,
  remote-import provenance, and an opaque future local-repository linkage. Runtime logs, dirty and
  busy UI state, processes, installed dependency memory, preview URLs, and credentials are
  transient and must not be serialized.
- 2026-07-24 — Implemented the version 3 workspace snapshot. IndexedDB now validates persisted
  records before restore; migrates valid version 1 and 2 records in memory; bounds file count,
  per-file UTF-8 size, and total UTF-8 size; and reports corrupt data, migration failure, quota,
  unavailable storage, or a logical-size rejection separately. A failed restore keeps the built-in
  workspace available and exposes an explicit action to clear the broken browser copy.
- 2026-07-24 — The save request persists the selected path, GitHub provenance, and a narrow
  `localRepository` identifier/version linkage without persisting repository objects. This is the
  tested integration point for Slice 04; it does not introduce local Git behavior.
- 2026-07-24 — Focused tests cover v1/v2 migration, corrupt v3 data, bounded writes, persistence
  error classification, clear, metadata cloning, and the local-repository linkage. A local
  Chromium Playwright check completed save, reload, restore, selected-file restoration, and clear.
  The browser's native quota limit was not intentionally exhausted; quota handling is covered by
  the classified `QuotaExceededError` boundary because a safe deterministic browser-quota
  simulation is unavailable.
