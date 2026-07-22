# Slice 02 — Session-only GitHub publish with device flow

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Status       | planned                                                                  |
| Owner        | repository contributors                                                  |
| Dependencies | Slice 01 completed and verified; a GitHub App registered for device flow |

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
