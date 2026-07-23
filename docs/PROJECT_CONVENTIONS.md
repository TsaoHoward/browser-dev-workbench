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

Include non-goals, linked slices or decision records, risks, rollout notes, and follow-up work when
they materially apply to the change. Do not require empty or irrelevant sections for small,
self-contained changes.

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

GitHub Pages deployment and deployed-origin browser verification can only run after a change reaches
`main`; they are post-merge release checks. The pull-request workflow must instead run its browser
smoke suite against a locally served production artifact. This is a pre-merge gate for the artifact,
not a claim that the public Pages origin has been deployed. Post-merge deployed-origin checks remain
required before describing deployment as complete.

Do not describe deployment as complete until its post-merge checks have passed. Record a failed
post-merge check and address it through a focused follow-up change or rollback.

### Verification layers

Keep automated verification proportional to the boundary being changed:

- Local and pull-request validation should cover deterministic unit checks, static analysis, the
  production build, the Pages artifact's base path and required static resources, and a lightweight
  Chromium smoke suite served from that built artifact. The suite covers the normal capability loop,
  the unavailable-runtime editor path, and user-initiated selected-folder diagnostics.
- The Pages deployment workflow should independently check the deployed HTML and run the same
  lightweight Chromium smoke suite against the public origin for release verification.
- Browser smoke tests should confirm that the major modules load and are usable, but need not become
  a complete end-to-end test of every editor interaction or WebContainer command. Keep expensive or
  environment-sensitive flows such as package installation and dev-server startup as focused
  follow-up checks until their test environment is stable.

The artifact-preview suite is a pull-request merge gate; deployed-origin checks are post-merge
release evidence. A successful automated deployment workflow is the canonical record of its own
scope and result; update the PR or durable slice record only for a failure, deviation, or changed
verification boundary. Add deeper coverage when a regression shows that the current boundary is
insufficient.

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
