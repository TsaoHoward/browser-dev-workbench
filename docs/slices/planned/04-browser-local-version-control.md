# Slice 04 — Browser-local version control

| Field        | Value                   |
| ------------ | ----------------------- |
| Status       | planned                 |
| Owner        | repository contributors |
| Dependencies | Slice 03 completed      |

## Goal

Validate a browser-native JavaScript Git library or WASM Git implementation and complete a
browser-local repository loop that does not require GitHub login, a host Git CLI, or any remote
repository.

## Scope

1. Run a documented selection PoC against at least one browser-native Git implementation. Evaluate
   persistence representation, file-size limits, worker behavior, licensing, bundle cost, and the
   exact capabilities needed below before committing the implementation choice.
2. Support repository initialization or workspace adoption, status, diff, staging, local commit,
   a bounded branch operation, history, and checkout. A single branch or limited branch model is
   acceptable initially; every supported operation must be a complete usable loop.
3. Persist browser-local repository state through Slice 03's selected storage representation and
   reconcile it explicitly with the editable worktree. Test reload and recovery behavior.
4. Keep commit identity local and clearly labelled. A local commit is not a GitHub commit, publish,
   or collaboration event.
5. Design a narrow interchange seam for patch or Git bundle export without making remote transport
   part of the local repository implementation.

## Out of scope

- GitHub sign-in, PAT collection, fetch, pull, push, remote tracking, pull requests, or host Git.
- Full merge/rebase, submodules, LFS, arbitrary hooks, SSH-agent support, or desktop-IDE parity.

## Acceptance criteria

- In a supported browser, a user can make edits, inspect status/diff, stage changes, make a local
  commit, inspect local history, and use the bounded branch/checkout operation while disconnected.
- Repository and worktree state restore honestly after reload when browser storage survives.
- Unsafe paths, unsupported repository features, persistence failure, and worktree/repository
  divergence receive tested, actionable handling.
- No token, remote provider, host Git executable, or authentication UI is required for any local
  Git acceptance path.

## Validation and exit conditions

Run the library/WASM PoC, focused domain/service tests, and `npm run validate`. Perform a browser
test that creates a repository, stages and commits a change, reloads, restores it, and verifies
history and diff. Archive only with the chosen implementation's compatibility, size, and storage
evidence recorded.

## Open decisions before activation

1. Which browser-native implementation meets the measured persistence and worker requirements?
2. Is the initial branch model one named branch plus explicit checkout, or a small multi-branch
   subset?
3. What local author identity UX is acceptable without treating it as a remote account identity?
