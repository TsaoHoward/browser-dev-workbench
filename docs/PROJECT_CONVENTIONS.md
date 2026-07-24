# Project conventions

## Code and naming

- Use TypeScript with strict types. Prefer explicit domain interfaces at boundaries over `any` or
  untyped JSON.
- Use kebab-case filenames. Keep tests beside the code they cover as `*.test.ts`.
- Keep Svelte components focused on presentation and orchestration; extract browser or external
  side effects into `src/services/`.
- Prefer small pure helpers in `src/lib/` for workspace transformations and test them directly.
- Follow the repository's ESLint and Prettier configuration. Do not hand-format generated lockfiles.

## Service and persistence boundaries

- Browser infrastructure must be accessed through a focused adapter interface that can be tested or
  replaced. Do not call IndexedDB, OPFS, File System Access, WebContainer, browser-local Git, or a
  remote repository client throughout components.
- Treat `WorkspaceFile` paths and contents as untrusted import data. Validate path behavior before
  mounting a workspace into a WebContainer.
- Recoverable browser storage and runtime state are distinct: files, workspace metadata, and local
  repository objects may be restored when storage survives; processes, terminal sessions, and dev
  servers must be restarted after reload. Browser storage can be evicted and must not be presented
  as a substitute for a repository commit.
- Persist only intentional workspace state. Define migration behavior before changing a stored
  snapshot format or database schema.

## Testing and validation

- Add focused unit tests for new domain and service behavior, including failure and boundary cases.
- Run `npm run validate` before handing off any code, dependency, workflow, or configuration
  change. It runs linting, formatting, Svelte checking, tests, and a production build.
- Documentation-only changes require `npm run format:check` at minimum. Update validation claims
  only when their command has actually passed in the relevant environment.

## Git workflow

### Branches

- Do not commit directly to `main`. Create one short-lived branch per coherent slice or fix.
- Name branches as `<type>/<short-kebab-case-summary>`. Allowed types are `feat`, `fix`, `docs`,
  `refactor`, `test`, `chore`, and `ci`; for example, `feat/read-only-github-import` or
  `docs/repository-guidance`.
- Treat `origin/main` as the protected integration base. Before creating a slice or fix branch,
  fetch it, fast-forward the local `main` branch only, then create the new branch from that updated
  local `main`. Do not repair an older feature branch by rebasing it across already merged work;
  preserve it locally if useful and recreate the focused branch from current `main` instead.
- Rebase or merge the current target branch before merge when required by repository policy. Do not
  force-push a shared branch without agreement from its collaborators.

### Commits

- Make each commit one reviewable logical change. Do not mix unrelated formatting, refactoring, or
  dependency updates into a feature commit.
- Use Conventional Commit-style subjects: `<type>(<optional-scope>): <imperative summary>`.
  Examples: `feat(github): add repository target validation` and
  `docs(slices): record import conflict decision`.
- Keep the subject concise; use the body to explain why, risks, migrations, or verification when
  the diff alone is insufficient.
- Run the required validation before committing. Do not commit generated build output or credentials.

### Pushes and pull requests

- Push only the intended branch and confirm its upstream before the first push. Use a normal
  fast-forward push; use `--force-with-lease` only when a rewrite is agreed and necessary.
- Open a draft PR while implementation, validation, or scope decisions are still in progress.
- Mark a PR ready for review after all applicable pre-merge acceptance criteria and required
  validation are complete. Clearly identify any verification that can only occur after merge.
- Keep PRs focused. Resolve blocking review feedback, update affected documentation, and ensure
  required CI is green before requesting merge.

PR titles use the same Conventional Commit-style summary as the primary change.

Every PR description must state:

- purpose and scope;
- validation performed and its result;
- outstanding deployment or manual checks.

When a PR relates to a slice, it must also state the slice name and whether it is a progress PR or
the slice-completion PR. A completion PR must state that it closes the slice and identify the
planned next slice; a progress PR must state the work that remains before completion.

Use the repository PR template when one is available; an equivalent description is acceptable only
when the template cannot be applied.

Include non-goals, linked slices or decision records, risks, rollout notes, and follow-up work when
they materially apply to the change. Do not require empty or irrelevant sections for small,
self-contained changes.

### Work-item control plane

GitHub Issues are a collaboration projection, not the durable source of project state. Versioned
`ISSUE-xxxx` records preserve the project-relevant Issue content and lifecycle; linked `REQ-xxxx`
records are the canonical requirement state. A pull request, slice, delivery merge, and
release-verification run must link to these records when the work is not an explicitly exempt,
non-behavioral maintenance change.

The normal lifecycle is automation-first:

1. An external intake Issue is captured into a repository Issue record by a reviewable automation
   pull request. Internal work originates from a versioned Issue record and requirement change, not
   from manually creating or editing a GitHub Issue.
2. A planning pull request adds the Issue record, requirement, and any planned slice. Only after it
   merges may an implementation branch be created from the updated `main` branch.
3. An implementation progress pull request activates its planned slice as part of a merged change.
   A slice is not active merely because an unmerged branch contains an `active/` document.
4. A completion merge records delivery. The post-merge workflow is the canonical release evidence
   for that merged SHA. On failure, automation opens or reopens the follow-up Issue and creates a
   reviewable repository-record synchronization pull request; it never writes directly to `main`.

Humans may author branches, commits, and pull requests, but must not manually maintain Issue
title/body, labels, state, cross-links, or repository mirror state after the control plane exists.
Allowed exceptions are an external intake submitted through an Issue form and a documented emergency
incident action. An emergency exception must identify its operator, reason, affected SHA where
available, and a `manual-exception` marker; automation must reconcile it into a versioned record
before further delivery work proceeds. Comments may aid discussion, but material decisions are
captured through a repository pull request rather than left only in a comment.

### Pull request lifecycle and merge gates

A pull request normally moves through these states:

1. **Draft** — implementation, validation, or scope decisions are still in progress.
2. **Ready for review** — the proposed change is complete enough to review and all applicable
   pre-merge requirements have been satisfied.
3. **Merged** — GitHub-required checks and repository merge requirements have passed.
4. **Post-merge verification** — deployment or environment-specific behavior is verified when it
   cannot be tested against the pull request branch.

A PR may be marked ready for review when:

- the intended slice or fix is implemented;
- applicable local validation has passed;
- affected tests and documentation are updated;
- known limitations and unfinished follow-up work are disclosed;
- no known blocking defect remains within the proposed scope.

A PR may be merged when:

- GitHub reports the PR as mergeable;
- all checks required by the repository ruleset have passed;
- required approvals, if configured by repository policy, have been obtained;
- requested changes and blocking review comments have been resolved;
- the PR is no longer a draft.

An empty review decision is not by itself a merge blocker. Approval is required only when enforced
by the repository ruleset or explicitly required by the maintainers.

### Slice completion and PR closure

Each active slice has exactly one **slice-completion PR**. It may include implementation commits,
but its merge is the only event that changes that slice from active to completed in the default
branch. The completion PR must, in the same change:

- satisfy and record the slice's exit conditions and any required validation evidence, or formally
  hand off a bounded remaining condition as described below;
- move its document from `docs/slices/active/` to `docs/slices/archive/`, set its status to
  `completed`, and record the merged PR and completion date;
- update `docs/slices/README.md` so it no longer names the slice as active and lists it as
  completed; and
- update `docs/references/IMPLEMENTATION_STATUS.md` to reflect the delivered state and name the
  next approved work without activating it prematurely.

A slice-related PR that intentionally delivers only part of a slice is a **progress PR**. It keeps
the slice active and updates its progress, decisions, risks, and remaining exit conditions in the
active document. It must not claim completion in its title or description. CI checks the PR
declaration: a progress PR must update an active slice document, while a completion PR must perform
the archival and status-reference changes above. A completion PR also records its own number and
completion date in the archived document before review.

### Slice handoff

A completion PR may hand off a remaining condition only when the original slice has delivered its
core goal, the condition has a separately bounded successor slice, and treating it as incomplete
would otherwise make the archived result misleading. A handoff must not bypass a required security,
candidate-deployment, or merge gate.

The parent archive records the exact condition, its current evidence or deviation, the reason for
separation, and a link to the successor. The successor must be planned or active before the parent
is archived; it must name the parent in a `Handoff from Slice NN` section and include the transferred
condition in its scope, acceptance criteria, and dependencies. The completion PR updates both
documents, the slice index, and the implementation status reference when the approved work sequence
or delivered-state description changes. CI requires every completion archive to declare either
`Handoff: none` or an explicit handoff, and requires an explicit successor record for the latter.

Use handoff only for a genuine change of bounded responsibility. An unmerged completion PR, an
unknown future task, a failed required check, or an unresolved defect is not a handoff.

If a slice-completion PR is closed without merging, the slice remains active on `main`. Before the
work is abandoned or continued in another PR, record the disposition and exact next action in the
active slice through a separate merged documentation update. Do not move a slice to `archive/` from
an unmerged branch. If post-merge verification fails, the work-item control plane opens or reopens a
follow-up Issue and creates its versioned record through a reviewable synchronization pull request.
Address it with a focused follow-up or reopen the slice when the delivered scope itself is no longer
valid.

Pull requests from this repository deploy their merge result to the public GitHub Pages origin before
they may merge. The deployed candidate must pass the resource and browser smoke suite. This is a
production-candidate gate: the candidate is publicly visible but is not a release until its PR is
merged and the `main` deployment has completed.

The candidate workflow must restore the current `main` artifact when validation, deployment, or
candidate verification fails, and when an unmerged same-repository PR is closed. A successful
rollback must run the same deployed-origin smoke suite. Fork PRs never receive Pages write
permissions and therefore cannot become production candidates.

Do not describe deployment as complete until its post-merge checks have passed. Record a failed
post-merge check and address it through a focused follow-up change or rollback.

### Verification layers

Keep automated verification proportional to the boundary being changed:

- Pull-request validation should cover deterministic unit checks, static analysis, the production
  build, the Pages artifact's base path and required static resources. A same-repository PR then
  deploys its merge result to the public Pages origin and runs a lightweight Chromium smoke suite.
  The suite covers the normal capability loop, the unavailable-runtime editor path, and
  user-initiated selected-folder diagnostics.
- The Pages deployment workflow should independently check the deployed HTML and run the same
  lightweight Chromium smoke suite after `main` deploys for release verification.
- Browser smoke tests should confirm that the major modules load and are usable, but need not become
  a complete end-to-end test of every editor interaction or WebContainer command. Keep expensive or
  environment-sensitive flows such as package installation and dev-server startup as focused
  follow-up checks until their test environment is stable.

The production-candidate smoke suite is a pull-request merge gate. The `main` deployment smoke
suite remains release evidence. Only one production-candidate or `main` deployment workflow may run
at a time. A successful automated deployment workflow is the canonical record of its own scope and
result; update the PR or durable slice record only for a failure, deviation, or changed verification
boundary. Add deeper coverage when a regression shows that the current boundary is insufficient.

## Dependencies and browser compatibility

- Pin behavior-sensitive upgrades in a dedicated slice and record their compatibility result.
- Capability detection, rather than browser-name product modes, determines what the workbench can
  offer. WebContainer remains a current-Chromium full-runtime capability; unavailable capabilities
  must leave an honest reduced or portable workflow rather than making the editor unusable. Support
  claims require an actual browser PoC or applicable official documentation.
- GitHub Pages needs the COOP/COEP service-worker shim for this prototype. Verify service-worker
  reload, cross-origin isolation, WebContainer boot, package installation, dev-server readiness,
  and iframe preview on the deployed origin before declaring deployment complete.

## Remote credentials and network access

- No access token, refresh token, OAuth client secret, or equivalent credential may enter the
  static bundle, IndexedDB, repository, logs, or tests.
- Read-only repository import must use an explicit target and define how it interacts with a saved
  browser-local workspace and repository. It is a remote-adapter operation, not a persistence or
  local-commit prerequisite.
- Any authenticated remote write needs an explicit authorization flow, least-privilege scope, clear
  user intent, and a reviewable security design before implementation. A session-only PAT may be a
  narrowly scoped transport experiment, but credential handling must not leak into Workspace Core
  or browser-local Version Control.
