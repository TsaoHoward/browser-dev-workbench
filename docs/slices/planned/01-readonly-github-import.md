# Slice 01 — Read-only GitHub import

| Field        | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Status       | planned                                                                       |
| Owner        | repository contributors                                                       |
| Dependencies | Slice 00 completed; deployed Pages behavior verified for the existing runtime |

## Scope

Let a user explicitly select a GitHub repository and branch, load its supported file tree into the
browser workspace, and understand what happens to a saved IndexedDB snapshot. This slice is
read-only: it excludes OAuth token storage, commits, pull requests, and workflow dispatch.

Public GitHub.com repositories are fetched directly from the browser without credentials. Any
authenticated capability, including the planned device-flow publish session, belongs to a later
slice and must not be pulled into this import flow.

## Decisions required before activation

1. Public GitHub REST access rate-limit and error behavior.
2. Supported repository size, file count, file size, binary-file, symlink, and ignored-path rules.
3. Snapshot conflict UX: replace, retain, export, or cancel; no silent overwrite.
4. Imported workspace metadata: repository, branch, immutable commit SHA, and import timestamp.
5. Error, loading, and retry states in the workbench UI.

## Acceptance criteria

- The user supplies and can review an explicit owner, repository, and branch before import.
- The imported tree is converted into validated `WorkspaceFile` records and mounted safely.
- The selected commit SHA and snapshot-conflict outcome are visible to the user.
- No credential or write capability is introduced.
- Tests cover mapping, invalid or unsupported entries, conflict choices, and service failures.

## Validation and exit conditions

Run `npm run validate`, perform an import against a representative public repository, and record
the supported limits and conflict behavior. Exit only after the read-only flow is verified; move
this document to `archive/` before activating a later write-capability slice.
