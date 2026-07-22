# Slice 06 — Optional remote synchronization

| Field        | Value                   |
| ------------ | ----------------------- |
| Status       | planned                 |
| Owner        | repository contributors |
| Dependencies | Slice 05 completed      |

## Goal

Add a remote repository as an optional adapter for import, fetch, pull, push, and remote-state
comparison. Keep it outside Workspace Core and browser-local Version Control so a user can edit,
run supported tools, and make local commits while disconnected.

## Scope

1. Define a narrow remote-adapter contract around explicit targets, import, fetch, pull, push, and
   comparison of local and remote committed state. The current public GitHub import service becomes
   one read-only adapter under this contract.
2. Choose and prove one initial transport through official documentation and a deployed browser PoC:
   GitHub REST, Git Smart HTTP, session-only fine-grained PAT, or another openly declared
   browser-safe route. A session-only PAT may be the first experiment but is never required to open
   the workbench or make local commits.
3. Model remote state as local ahead, remote ahead, equal, or diverged. Initially limit write and
   pull operations to fast-forward or otherwise conflict-free paths; give an explicit patch/archive
   handoff or re-import recovery route for unsupported divergence.
4. Require reviewed user intent for any remote write. Keep credentials only in the narrowly scoped
   live session when the chosen transport permits it; redact values from stores, URLs, logs, errors,
   telemetry, and test fixtures.
5. Reassess the superseded device-flow proposal as research only. Its CORS, branch safety, diff
   review, CSP, token redaction, and failure analysis may be adopted only after the chosen
   transport's official documentation and real deployed-origin PoC support it.

## Out of scope

- Making GitHub login, PATs, OAuth, extensions, native bridges, or a backend a prerequisite for
  core workflows.
- Hidden CORS proxies, undeclared backends, host credential-manager/SSH-agent access, force push,
  automatic conflict resolution, pull-request creation, or workflow dispatch.
- Uncommitted-workspace cross-device synchronization or restoration of runtime processes.

## Acceptance criteria

- A disconnected user can independently demonstrate the Slice 04 local commit loop.
- The chosen remote adapter has a written authorization and data-use model, verified browser
  transport feasibility, redaction tests, and a clear local-disconnect behavior.
- Import/fetch/pull/push outcomes accurately distinguish local ahead, remote ahead, and diverged
  committed state; unsupported conflict paths perform no silent write.
- A successful remote write transfers an explicit reviewed committed state and is not described as
  automatic editor persistence.

## Validation and exit conditions

Run focused adapter tests and `npm run validate`. Verify the selected transport, cancellation,
denial, expiry/revocation where relevant, reload/disconnect, remote advancement, divergence, and
redaction against a disposable test repository from the deployed Pages origin. Archive only with
the actual authorization, browser, and residual-risk evidence recorded.

## Open decisions before activation

1. Which initial remote transport is both browser-feasible and acceptable to maintainers without an
   application backend?
2. Is a session-only fine-grained PAT sufficient as the first remote transport experiment, or is a
   no-write import/fetch proof required first?
3. Should Slice 05 portable recovery be mandatory before enabling remote writes, rather than merely
   preferred?
