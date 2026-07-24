# Slice 08 — Versioned work-item traceability

| Field        | Value                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Status       | active                                                                                          |
| Owner        | repository contributors                                                                         |
| Dependencies | Slice 03 completed                                                                              |
| Activated    | 2026-07-24                                                                                      |
| Requirement  | [REQ-0801](../../work-items/requirements/REQ-0801-versioned-work-item-traceability.md)          |
| Source Issue | [ISSUE-0011](../../work-items/issues/ISSUE-0011-governance-versioned-work-item-traceability.md) |
| Planning PR  | [#13](https://github.com/TsaoHoward/browser-dev-workbench/pull/13)                              |
| Delivery     | Pending Slice 08 completion PR                                                                  |

## Goal

Establish a Git-first, automation-first work-item control plane that preserves the project-relevant
state of GitHub Issues and connects requirements, slices, delivery, and release verification.

## Scope

1. Define and validate versioned `ISSUE-xxxx` and `REQ-xxxx` records, including the intake state
   where an Issue may have no requirement yet, authority boundaries, lifecycle, and restoration
   limits.
2. Build a least-privilege automation path that captures external Issue intake and post-merge
   release-verification failure into reviewable repository-record synchronization PRs. It must be
   idempotent and must never commit directly to `main`.
3. Build a repository-to-GitHub projection path for Issue title/body, labels, cross-links, and
   open/closed state after a record change merges. Normal human maintenance of these fields is
   prohibited.
4. Add Issue and PR templates plus CI validation that enforce planning-before-implementation,
   reciprocal relationships, and the one-active-slice rule.
5. Bootstrap `ISSUE-0011` and `REQ-0801`, then use the automation and its exception handling to
   govern this slice through delivery and release verification.
6. Make the active control-plane relationship self-discoverable from the required contributor
   reading path. A generated, machine-validated registry must traverse `AGENTS.md` → slice index
   → active Slice → requirement → Issue record → GitHub projection, and must not become a second
   authoritative record.

## Out of scope

- Automating code authoring, branch creation, review decisions, or pull-request approval.
- Mirroring every GitHub comment, reaction, notification, user identity, or native timestamp.
- Storing workflow artifacts, raw logs, credentials, or browser evidence in repository records or
  Issue bodies.

## Acceptance criteria

- Normal Issue lifecycle changes are performed by tested, idempotent automation; manual Issue state
  mutation is rejected or reconciled as a documented exception.
- An external Issue and a release-verification failure each produce a reviewable record-sync PR;
  the same event cannot create duplicate Issues or synchronization PRs.
- A repository-record merge projects the allowed Issue fields to GitHub without embedding a token
  in source, logs, artifacts, or the static bundle.
- A fresh session can discover the active work item by following `AGENTS.md` alone. CI rejects a
  missing or inconsistent reciprocal link between the active Slice, requirement, Issue record,
  delivery relation, registry entry, and GitHub projection marker.
- Every projected GitHub Issue contains a stable link and machine-readable marker for the versioned
  Issue record, including its last known repository revision; the registry remains navigable when
  GitHub is unavailable.
- A planning PR creates the requirement and planned Slice 08; a later merged progress PR activates
  it. Only one active slice exists on `main`.
- Delivery and release verification remain distinct records, and artifact expiry leaves a redacted,
  durable workflow link and summary.

## Validation and exit conditions

Run focused schema, idempotency, redaction, and workflow-payload tests plus `npm run validate`.
Exercise controlled intake, projection, and post-merge failure scenarios against GitHub with
least-privilege permissions, then record the target SHAs, workflow URLs, synchronization PRs, and
any emergency exception. Archive only after the bootstrap follows the model through delivery and
post-merge release verification.

## Open decisions before activation

1. Which GitHub event and permission boundary can safely create the synchronization PR without
   letting untrusted Issue content execute or write directly to `main`?
2. Should repository-to-GitHub projection use an isolated `workflow_run` workflow or a dedicated
   GitHub App, given required Issue, contents, and pull-request permissions?
3. Which machine-readable record format gives strict validation without making the durable human
   review document unreadable?

## Decisions and implementation progress

- 2026-07-24 — Slice 08 was activated only after planning PR #13 merged and its post-merge Pages
  workflow passed. The implementation branch was created from that merged `main` state, not by
  rebasing the earlier bootstrap branch.
- 2026-07-24 — The first progress implementation establishes record validation and PR declaration
  contracts. The intake, repository-to-GitHub projection, and release-failure workflows remain
  explicitly incomplete until their least-privilege and untrusted-payload behavior is tested.
- 2026-07-24 — Issue #11's material follow-up comment expands this active slice only; it does not
  rewrite planning PR #13 or activation PR #14. The requirement is captured in the bootstrap Issue
  record and will be reconciled by the normal intake path once that automation exists.
- 2026-07-24 — The registry will be a checked-in generated navigation document. Its generator will
  read the primary Slice, requirement, and Issue-record links; CI will regenerate it and fail on a
  difference, so editing the registry cannot establish or override a relationship.
- 2026-07-24 — The next progress PR is ordered as: (1) a strict parser/validator plus generated
  registry and fixture tests; (2) Issue and PR templates and the planning/reciprocity checks; (3)
  least-privilege intake, projection, and release-failure workflows with controlled GitHub
  exercises. The later privileged workflows must check out only trusted default-branch code,
  treat event fields as data, and never execute Issue, comment, artifact, or pull-request content.
- 2026-07-24 — The registry-validation progress implementation adds a checked-in generated registry,
  reciprocal Markdown-link validation, a controlled pending projection state, and CI stale-output
  detection. It deliberately does not contact GitHub; a later automation PR must consume the
  generated expected marker to make the remote projection observable.

## Remaining implementation plan

1. Define the minimal primary fields and pending-state grammar for `ISSUE-xxxx`, `REQ-xxxx`, and
   Slice documents. The validator must follow their Markdown links from the contributor discovery
   chain, require reverse links, allow a pending delivery only before a completion PR, and reject
   a second active Slice.
2. Generate `docs/work-items/registry.md` from that validated graph. The entry must name the active
   Slice, requirement, Issue record, external Issue URL, delivery/release state, and the expected
   GitHub projection marker. Test missing links, mismatched identifiers, stale generated output,
   unknown projection state, and unavailable-GitHub recovery information.
3. Add an Issue form that identifies intake type and a PR declaration that identifies the linked
   work item. Extend CI with the graph/registry validator before the existing slice-lifecycle gate;
   it must accept the documented `ISSUE-0011` bootstrap state but reject a new manual normal-path
   mirror update.
4. Add isolated automation paths: an `issues`/approved material-change intake creates or updates
   one synchronization branch and PR per external Issue; a trusted default-branch projection job
   updates allowed GitHub fields and the stable record marker after a record merge; a post-merge
   verification-failure job creates or reopens the linked follow-up Issue and synchronization PR.
   Each path needs an event identity, concurrency key, desired-state comparison, and retry-safe
   branch/PR lookup to prove idempotency.
5. Exercise intake, manual-exception reconciliation, projection, and release-failure flows against
   GitHub. Record only the target SHA, workflow URL, redacted summary, and artifact-retention note;
   do not copy workflow artifacts or raw logs into repository records.
