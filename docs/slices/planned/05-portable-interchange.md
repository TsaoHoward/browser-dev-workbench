# Slice 05 — Portable interchange

| Field        | Value                   |
| ------------ | ----------------------- |
| Status       | planned                 |
| Owner        | repository contributors |
| Dependencies | Slice 04 completed      |

## Goal

Make a browser-local workspace and repository portable without requiring a full runtime, GitHub
account, host Git CLI, or installed companion software.

## Scope

1. Support bounded, validated workspace archive import/export using ZIP, tar, or a deliberately
   selected subset. Make path validation, file-count/size budgets, binary handling, and overwrite
   behavior explicit.
2. Support patch and, if the Slice 04 implementation proves it practical, Git bundle interchange
   for browser-local repository history. State exactly what each format preserves.
3. Add user-initiated File System Access integration where available. Define an explicit import,
   export, and reconciliation contract between the browser worktree and a selected local folder;
   never silently mirror, watch, or overwrite a folder.
4. Keep a portable workflow for browsers that lack WebContainer, OPFS, selected-folder access, or
   a complete Node runtime: edit, validated import/export, diff, patch, and basic static checks
   when their capabilities are usable.

## Out of scope

- Host filesystem APIs outside the user's explicit browser selection.
- Background folder sync, desktop Git integration, remote Git transport, GitHub authentication, or
  claims that archive interchange is a collaboration service.

## Acceptance criteria

- A user can export a bounded workspace, restore it into a fresh browser workspace, and receives
  clear validation/error outcomes for unsafe or unsupported archives.
- A local repository change can leave and re-enter the supported browser-local workflow through
  the chosen patch/bundle formats, with preservation limits disclosed.
- A selected-folder workflow requires explicit user action for each direction and correctly reports
  unavailable permission or browser support.
- The portable fallback remains discoverable through capability detection, not a separate product.

## Validation and exit conditions

Run focused import/export tests and `npm run validate`. Perform browser round trips for the selected
archive and patch/bundle formats, plus folder permission/revocation tests where supported. Record
format limits, browser support, and any data not preserved before archiving.

## Open decisions before activation

1. Which archive format gives the smallest secure implementation for the supported file model?
2. Does the selected browser-local Git implementation produce interoperable bundles within the
   prototype size budget, or should bundles be deferred while patch remains supported?
3. What conflict rule applies when the selected folder changes outside the workbench?
