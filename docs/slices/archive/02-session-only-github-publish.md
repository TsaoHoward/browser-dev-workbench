# Superseded Slice 02 — Session-only GitHub publish with device flow

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Status       | superseded                                                               |
| Owner        | repository contributors                                                  |
| Dependencies | Slice 01 completed and verified; a GitHub App registered for device flow |

## Supersession note

This unimplemented proposal was superseded on 2026-07-22 by the capability-first plan beginning
with [planned Slice 02](../planned/02-capability-model-and-runtime-boundaries.md). It coupled
browser-local version control, remote persistence, GitHub authentication, commit creation, and
collaboration before the browser-local repository capability had been validated.

Keep the material below as remote-adapter research. Its reviewed-diff, branch-safety, redaction,
CSP, CORS, and failure-boundary analysis is candidate input for planned Slice 06; it is not an
activation or implementation plan.

## Disposition of the original proposal

| Original content                                                                                      | Disposition                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Reviewed diff, explicit intent, new-branch safety, token redaction, CSP, CORS, and failure analysis   | Preserve as research and revalidate for Slice 06's chosen remote transport.                                                                |
| GitHub API write sequence, remote-target comparison, and session-only credential constraints          | Move conceptually to Slice 06, after browser-local commits and portable recovery exist.                                                    |
| GitHub App identity, device-flow UX, selected-repository permission grant, and callback configuration | Delete as a core prerequisite; reconsider only if a later selected transport needs it and deployed-browser feasibility is proved.          |
| Imported-file baseline and canonical diff as the basis for a remote-only commit                       | Rewrite around Slice 04's browser-local repository, staging, and local commit model.                                                       |
| Device flow as the project's immediate next implementation                                            | Delete; GitHub documentation positions device flow for headless clients, so it is not the default architecture for this browser workbench. |

## Scope

Let a user authorize a GitHub App in the browser through GitHub's device flow, then publish the
current imported workspace as one commit on a new branch. Authentication and publishing remain
entirely browser-hosted: this slice adds no backend, OAuth callback, client secret, persistent
token storage, or repository-data service.

The workbench is responsible only for turning an explicit, reviewed workspace diff into a branch
commit. GitHub's native pages remain responsible for installing the app, granting repository
access, forking, pull requests, review, merge, and repository administration.

## User authorization and data-use model

Before **Connect GitHub** starts, the UI must make the following facts clear in plain language:

1. The workbench opens GitHub's verification page and shows the one-time device code issued by
   GitHub. The user enters the code only on GitHub's page and can cancel there or in the
   workbench.
2. The GitHub App requests only the minimum repository permissions needed to read the selected
   target and create a branch commit. It must not request pull-request, workflow, administration,
   organization-management, or broad all-repository access when a selected-repository grant is
   available.
3. The resulting user access token is held only in the running page's memory. It is never placed
   in source code, the static bundle, IndexedDB, Cache Storage, localStorage, sessionStorage,
   URLs, browser downloads, test fixtures, analytics, or application/runtime logs.
4. Reloading the page, closing the tab, or choosing **Disconnect GitHub** makes the workbench
   discard its token and return to the disconnected state. This does not itself revoke the token
   at GitHub; GitHub's expiry or the user's GitHub revocation controls that. The UI must link to
   GitHub's app-authorization settings for revocation.
5. While connected, any same-origin script compromise, malicious browser extension, shared
   browser profile, or local-device compromise could act with the session's granted repository
   permissions. The workbench reduces persistence and exposure; it cannot make an active
   browser-session credential invulnerable.
6. Workspace files remain browser-local until the user explicitly confirms **Publish**. Publishing
   sends only the reviewed changed file contents and commit metadata to GitHub. GitHub import and
   publish are subject to GitHub's own service and privacy terms.

The confirmation must name the GitHub App, target owner/repository, requested permission level,
session-only storage rule, expiry/revocation distinction, and the fact that fork/PR work occurs on
GitHub's website. It must not make a misleading claim that a page reload revokes GitHub access.

## Intended user flow

1. Import a public repository in Slice 01 and retain its immutable base commit SHA in workspace
   metadata.
2. Select **Connect GitHub**, review the authorization disclosure, and continue to GitHub's native
   device-verification experience.
3. On success, show the connected GitHub account and the granted repository target without
   displaying a token. Offer **Disconnect GitHub** at all times.
4. Compute changes against the imported SHA and show the changed paths, target repository, new
   branch name, and commit message for review.
5. On an explicit **Publish** confirmation, verify that the target branch still descends from the
   imported SHA, create a new branch, and make one commit containing the reviewed changes.
6. Open or link to GitHub's native compare page. Forking, PR creation, review, merge, and branch
   protection decisions remain there.

## Safety and concurrency rules

- Publish only to a newly created branch by default; never silently write the imported branch or a
  default branch.
- Resolve and display the target repository and its branch before publishing. A fork, if wanted,
  is created through GitHub's native fork page and then selected as the target.
- Use the imported commit SHA as the expected base. If the target has advanced or cannot be proven
  compatible, fail without writing and ask the user to re-import or resolve the divergence.
- Respect GitHub's device-flow polling interval and `slow_down` responses. Cancellation, expiry,
  denial, rate limits, access restrictions, and network failures must leave the workspace and
  IndexedDB snapshot unchanged.
- Redact authorization values from all thrown errors, status messages, telemetry, and runtime
  logs. Treat the device code as sensitive while its verification window is active.

## Out of scope

- A backend, serverless function, OAuth callback, client secret, private key, refresh-token
  persistence, or personal-access-token entry.
- Private repository import, automatic token refresh, multi-session reconnect, or background
  publishing.
- Direct pushes to an existing branch, force pushes, merging, pull-request creation, workflow
  dispatch, GitHub repository creation, or fork creation through this application.
- Recreating GitHub repository, branch, fork, pull-request, review, or administration interfaces.

## Decisions required before activation

1. GitHub App ownership, public-facing name, privacy/support contact, callback/allowed origin
   configuration, and the exact selected-repository permission screen.
2. The smallest verified GitHub App permission set for read, branch creation, and a single commit.
3. Device-flow UX for opening GitHub verification, presenting the device code, polling, timeout,
   cancellation, and retry without exposing credentials.
4. Branch-name convention, commit-message validation, and whether a publish target must always be
   a fork rather than any repository the user has granted.
5. Workspace diff rules, including additions, modifications, deletions, generated lockfiles, and
   files excluded by Slice 01 limits.
6. The browser threat-model wording, supported browser policy, Content Security Policy, and the
   manual verification needed for browser extensions, reload/disconnect behavior, and GitHub
   authorization revocation.

## Planning assessment and proposed decisions

This historic proposal was not activated or implemented. The following was a concrete proposal for
activation, checked against the current Slice 01 implementation on 2026-07-22 and GitHub's current
documentation. Revalidate it before using any part of it in a remote-adapter slice.

### Authorization and GitHub App configuration

1. Register one public GitHub App owned by the project maintainers. Publish its name, owner,
   support contact, privacy notice, installation URL, and revocation URL in the disclosure. Its
   public `client_id` may be compiled into the static app; no app ID, client secret, or private key
   may be required by the browser.
2. Enable device flow only after the maintainer explicitly accepts its browser-specific residual
   risk. GitHub documents device flow for headless clients and advises against enabling it for a
   web application when phishing is a concern. For a GitHub App, the documented web application
   flow requires a client secret when exchanging the callback code; PKCE protects that flow but
   does not remove the client-secret requirement. It therefore cannot be substituted into this
   static-only application without violating the credential rule. If device flow is rejected, this
   slice must instead be replaced by a separately approved confidential-backend authorization
   design. Do not describe device flow as equivalent to a browser authorization flow.
3. Request only repository `Contents: write` and its implicit/required `Metadata: read`; do not
   request `Workflows`, pull requests, administration, organization, or account permissions. The
   app must allow a selected-repositories installation, not require all repositories. Changes to
   `.github/workflows/**` are blocked in this slice because GitHub requires the separate
   `Workflows: write` permission for those writes.
4. Installation is a distinct prerequisite, not an outcome of device authorization. Before
   starting device flow, the workbench shows the GitHub-native installation page when the app has
   not been installed on the chosen repository. After authorization it calls the user-access-token
   installation and repository-list endpoints, and accepts a target only when the app installation,
   repository selection, and the user's effective write permission all include it. The initial
   device-code request also supplies that repository's numeric ID to narrow the resulting token;
   the post-authorization check remains mandatory because GitHub may ignore an inaccessible ID.
5. Keep the device code, device verification code, access token, and any refresh token in a
   closure-private session object only. Do not implement refresh. On cancellation, expiry,
   disconnect, unmount, or page reload, abort polling and overwrite the in-memory values. Treat
   the displayed user code as sensitive for its validity window. A disconnect is local disposal,
   not GitHub revocation; link the user to the app authorization settings for revocation.
6. Prove that GitHub permits the exact deployed Pages origin to read both device-flow responses
   (`github.com/login/device/code` and `github.com/login/oauth/access_token`) before activation.
   GitHub's published CORS guarantee covers the REST API at `api.github.com`, not these login
   endpoints. An unauthenticated probe from the Pages origin on 2026-07-22 received no
   `Access-Control-Allow-Origin` header, and its OPTIONS request returned 404. This is evidence of
   risk, not a substitute for a real registered-App browser test. If the real device-code response
   is not CORS-readable, a static page cannot obtain or poll the values: do not introduce a CORS
   proxy or hidden backend to work around it; mark this slice blocked and redesign its product
   boundary instead.

GitHub's [device-flow guidance](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app),
[web-app security guidance](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app),
and [permission reference](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
support these constraints.

### Publish contract

1. A publish target is explicit: owner, repository, and base branch. It defaults to the imported
   target. A GitHub-created fork may be entered as a different target only if its selected base
   branch resolves to exactly the imported commit SHA. The workbench never creates a fork.
2. Immediately before the user confirms, resolve the target base branch again. Require its head to
   equal the imported SHA exactly, rather than merely descend from it. If it is ahead, behind, or
   unrelated, stop before any write and require a fresh import. This keeps the reviewed change on a
   known base and removes ambiguous compare results.
3. Generate a new branch name such as `workbench/<UTC timestamp>-<random suffix>` before the final
   confirmation. The user can edit it only if it passes a strict Git ref-name validator and still
   begins with `workbench/`. Never reuse or update an existing ref. Commit messages are required,
   trimmed, limited to a single line and a bounded length, and are rendered as text in the review.
   The API omits caller-supplied author and committer identities so GitHub attributes the action to
   the authorized user/app rather than accepting forged metadata.
4. The review is a complete, immutable proposal: target, base SHA, branch name, commit message,
   sorted additions/modifications/deletions, and a canonical fingerprint of the current files. Any
   editor, target, branch, or message change invalidates the confirmation and requires a new
   review. This slice has no per-file staging: every displayed change is included only after the
   user confirms the entire set.
5. Define the base as the original supported imported files, not all files in the Git tree. Paths
   Slice 01 intentionally skipped are retained in the base tree and can never be deleted by their
   absence from the workspace. A generated `package-lock.json` is an ordinary reviewed change and
   is included only when it appears in the reviewed diff. The current UI cannot delete files; the
   domain mapper and tests nevertheless support a deletion entry for a future explicit delete UI.
6. Store the supported imported-file baseline alongside an imported snapshot in a version-three
   IndexedDB record, with an explicit version-two migration that downloads and validates the
   immutable base once before first publish. The baseline is browser-local source data, never a
   credential. This permits an exact offline diff after migration and avoids treating the mutable
   workspace as its own base.

### Write sequence and its honest failure guarantee

Use the Git Database API, not one Contents API request per file: build a tree from the immutable
base tree and the reviewed diff, create one commit with the imported SHA as its only parent, then
create the new branch reference. All requests use the authenticated GitHub API with the session
token; authorization headers and response bodies never reach the runtime log.

This sequence makes the final `create ref` call the only operation that exposes a branch. GitHub's
API necessarily creates the tree and commit objects before it can create that ref, so this slice
cannot truthfully promise that no unreachable Git objects exist after a final-step failure. Its
guarantee is instead: it never updates an existing branch, and a failed operation creates no
visible branch or partial repository file state. If the final request times out, retain the proposed
branch and commit SHA only in memory, re-read that exact new ref, and report success only when it
points to the intended commit; otherwise allow a retry of that ref creation without rebuilding a
second commit.

There is no REST transaction that atomically rechecks the imported branch head and creates a
different new ref. The second exact-head check is therefore a best-effort concurrency guard, not a
claim that a concurrent upstream push is impossible after the check. Record this residual race in
the disclosure and manual test evidence. The [tree](https://docs.github.com/en/rest/git/trees),
[commit](https://docs.github.com/en/rest/git/commits), and
[reference](https://docs.github.com/en/rest/git/refs) API documentation defines this ordering and
the required `Contents: write` permission.

### Proposed implementation plan

1. Extend `src/lib/workspace.ts` with the import-baseline and canonical-diff domain types and pure
   helpers. Cover additions, modifications, deletions, ignored paths, no-op diffs, duplicate/unsafe
   paths, and canonical-review fingerprinting with unit tests.
2. Add the version-three snapshot migration to `src/services/persistence/`. It persists the
   validated imported baseline only; session authorization state has no persistence interface and
   cannot be passed to this repository.
3. Split `src/services/github/` into focused adapters: an unauthenticated immutable-base reader,
   a device-flow session service with polling/redaction/cancellation, and a publish service that
   validates target access, builds the Git tree, creates the commit/ref, and maps every GitHub
   failure to a redacted actionable error. Keep fetch and time/scheduling dependencies injectable
   for deterministic tests.
4. Add Svelte orchestration only: install/connect guidance, the pre-flow disclosure, verification
   state, connected-account/target state, disconnect, diff review, and final publish confirmation.
   Do not place token values in component state rendered by the template, error strings, URLs, or
   the existing runtime log.
5. Add a narrowly scoped Content Security Policy only after verifying its compatibility with the
   WebContainer runtime, npm registry traffic, preview iframe, the COOP/COEP shim, and GitHub API
   endpoints. Its allowed origins must be documented and browser-tested; this is not a cosmetic
   meta-tag change.
6. Run focused unit tests for every state transition and failure boundary, then `npm run validate`.
   Complete the existing Chromium and deployed-Pages checks plus the manual device-flow, install,
   cancellation, expiry, reload, disconnect, GitHub-side revocation, publish, ref-timeout recovery,
   and concurrent-base-advance cases against a disposable test repository.

### Activation gate

Move this document to `active/` only when a maintainer records: the exact App identity and public
URLs; a screenshot or equivalent record of the selected-repository permission grant; explicit
acceptance of device flow or approval for a separately scoped confidential-backend redesign; the
`Contents: write` / no-`Workflows` permission decision; the target and branch policy above; the
baseline migration storage budget; the residual create-ref and concurrent-push guarantees; and a
CSP compatibility test plan; and a deployed-Pages proof that both device-flow endpoints are
CORS-readable for the registered App.

## Acceptance criteria

- A user can understand and accept the authorization/data-use disclosure before device flow
  begins, then cancel at every stage without any repository write.
- No client secret, private key, access token, refresh token, or device code reaches a persistent
  browser store, URL, source artifact, fixture, log, or test output.
- Reload and disconnect clear the workbench's connected state; the UI correctly distinguishes that
  local discard from GitHub-side token expiration or revocation.
- A successful publish creates exactly one user-reviewed commit on a newly created branch whose
  base is the imported immutable SHA, and returns a GitHub compare URL.
- Diverged targets, denied/revoked access, expired/cancelled device flow, polling limits, and
  GitHub service failures produce actionable errors and no partial or silent write.
- Unit tests cover authorization-state transitions, token non-persistence, redaction, diff-to-
  commit mapping, base-SHA conflict handling, and GitHub service failure modes.

## Validation and exit conditions

Run `npm run validate`. Manually verify the authorization disclosure and device flow in a current
Chromium browser, including cancellation, expiry, reload, disconnect, GitHub-side revocation, a
new-branch publish against a test repository, and GitHub compare-page handoff. Record the exact
GitHub App permissions, browser behavior, and residual session risks before archiving this slice.
