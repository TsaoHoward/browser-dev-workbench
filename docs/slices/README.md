# Slice index

This directory is the durable implementation plan. A slice is a bounded change with explicit
scope, dependencies, acceptance criteria, risks, validation, and exit conditions.

## Current implementation target

No slice is active. [07 — Semi-automated browser acceptance](archive/07-semi-automated-browser-acceptance.md)
is complete. [03 — Persistent browser workspace](planned/03-persistent-browser-workspace.md) is the
next approved target and must be activated before implementation begins.

## Approved sequence

| Slice                                                                                 | Status  | Purpose                                                       |
| ------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| [03 — Persistent browser workspace](planned/03-persistent-browser-workspace.md)       | planned | Recover files and metadata; separate them from process state. |
| [04 — Browser-local version control](planned/04-browser-local-version-control.md)     | planned | Validate disconnected browser-local Git workflows.            |
| [05 — Portable interchange](planned/05-portable-interchange.md)                       | planned | Add archives, patches/bundles, and selected-folder handoff.   |
| [06 — Optional remote synchronization](planned/06-optional-remote-synchronization.md) | planned | Add remote import/fetch/push after local Git is proven.       |

## Completed slices

| Slice                                                                                                 | Status     | Purpose                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| [01 — Read-only GitHub import](archive/01-readonly-github-import.md)                                  | completed  | Imported supported public repository files read-only.          |
| [02 — Capability model and runtime boundaries](archive/02-capability-model-and-runtime-boundaries.md) | completed  | Established the capability registry and runtime boundaries.    |
| [07 — Semi-automated browser acceptance](archive/07-semi-automated-browser-acceptance.md)             | completed  | Established repeatable browser acceptance evidence.            |
| [02 — Session-only GitHub publish](archive/02-session-only-github-publish.md)                         | superseded | Preserved remote-authentication research; never implemented.   |
| [00 — AI repository foundation](archive/00-ai-repository-foundation.md)                               | completed  | Established contributor guidance and durable planning records. |

## Decision records

- [ADR-0001 — Browser-local runtime and GitHub boundary](decisions/ADR-0001-browser-local-runtime-and-github-boundary.md)
- [ADR-0002 — Capability-oriented browser workbench boundary](decisions/ADR-0002-capability-oriented-browser-workbench-boundary.md)

## Lifecycle

1. A proposed slice becomes `active/` only after its scope and acceptance criteria are agreed.
2. The active document records implementation progress, decisions, validation, and deviations.
3. When its exit conditions are met, update this index and move the document to `archive/`.
4. Archived documents are historical context, not active instructions.

Only one slice may be the current implementation target at a time.
