# Slice index

This directory is the durable implementation plan. A slice is a bounded change with explicit
scope, dependencies, acceptance criteria, risks, validation, and exit conditions.

## Current implementation target

No implementation slice is active. Activate the next slice only after its open decisions are agreed.

## Approved next slice

| Slice                                                                | Status  | Purpose                                                          |
| -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| [01 — Read-only GitHub import](planned/01-readonly-github-import.md) | planned | Import an explicit repository/branch into the browser workspace. |

## Completed slices

| Slice                                                                   | Status    | Purpose                                                        |
| ----------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| [00 — AI repository foundation](archive/00-ai-repository-foundation.md) | completed | Established contributor guidance and durable planning records. |

## Decision records

- [ADR-0001 — Browser-local runtime and GitHub boundary](decisions/ADR-0001-browser-local-runtime-and-github-boundary.md)

## Lifecycle

1. A proposed slice becomes `active/` only after its scope and acceptance criteria are agreed.
2. The active document records implementation progress, decisions, validation, and deviations.
3. When its exit conditions are met, update this index and move the document to `archive/`.
4. Archived documents are historical context, not active instructions.

Only one slice may be the current implementation target at a time.
