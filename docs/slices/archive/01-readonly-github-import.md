# Slice 01 — Read-only GitHub import

| Field        | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Status       | completed                                                                     |
| Owner        | repository contributors                                                       |
| Activated    | 2026-07-22                                                                    |
| Completed    | 2026-07-22                                                                    |
| Dependencies | Slice 00 completed; deployed Pages behavior verified for the existing runtime |

## Scope and outcome

Users can explicitly select a public GitHub.com owner, repository, and branch, then import its
supported file tree into the browser workspace. The UI records and displays the immutable commit
SHA and makes the local-snapshot outcome explicit. This slice is read-only: it adds no OAuth,
token storage, commits, pull requests, or workflow dispatch.

Public GitHub.com repositories are fetched directly from the browser without credentials. Any
authenticated capability, including the planned device-flow publish session, remains a later slice.

## Decisions implemented

1. **GitHub access and failures.** The browser uses unauthenticated GitHub REST only to resolve the
   selected branch and recursive tree, then downloads each immutable file from
   `raw.githubusercontent.com`. The normal public REST rate limit applies; a rate-limited response
   names its reset time. Network, not-found, and GitHub service failures are actionable and do not
   replace the active workspace or IndexedDB snapshot.
2. **Supported files.** Imports are limited to 200 regular UTF-8 text files, 1 MiB each and 5 MiB
   total. Truncated trees, symlinks, submodules, binary or invalid-UTF-8 files, unsafe paths, and
   oversized files are rejected. `.git`, `node_modules`, `dist`, `build`, `.svelte-kit`, `coverage`,
   `.env`, and `.env.*` paths are skipped. Every accepted path is validated before mounting it in a
   WebContainer.
3. **Snapshot conflicts.** When a saved snapshot or unsaved editor change exists, the user chooses
   to replace the saved snapshot immediately or retain it while the import remains in memory until a
   later explicit save. Cancel performs no import and no persistence write.
4. **Imported metadata.** The version-two IndexedDB snapshot records owner, repository, branch,
   immutable commit SHA, import timestamp, ignored-path count, and the snapshot-conflict outcome.
   Version-one snapshots migrate in memory without losing their files.
5. **Workbench states.** The import dialog exposes the explicit target, limits, conflict choice,
   loading state, and actionable errors. The workspace explorer shows the imported target, commit
   SHA, conflict outcome, and ignored-path count.

## Validation

- `npm run validate` passed on 2026-07-22: zero lint errors, zero Svelte diagnostics, 18 passing
  unit tests, a successful production build, and Pages artifact verification.
- A headless Chromium browser imported the representative public repository
  `octocat/Hello-World@master` from the local workbench. It completed through the public GitHub
  endpoints, rendered the 12-character immutable commit SHA, and produced no console or page errors.

## Handoff

The originally planned GitHub-publish follow-up was superseded on 2026-07-22. The next planned
capability is [Slice 02 — Capability model and runtime boundaries](../planned/02-capability-model-and-runtime-boundaries.md).
This completed slice remains a read-only Remote Repository Adapter result; it is not a prerequisite
for browser-local version control or remote authentication.
