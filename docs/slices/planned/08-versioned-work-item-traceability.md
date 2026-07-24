# Slice 08 — Versioned work-item traceability

| Field        | Value                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Status       | planned                                                                                         |
| Owner        | repository contributors                                                                         |
| Dependencies | Slice 03 completed                                                                              |
| Requirement  | [REQ-0801](../../work-items/requirements/REQ-0801-versioned-work-item-traceability.md)          |
| Source Issue | [ISSUE-0011](../../work-items/issues/ISSUE-0011-governance-versioned-work-item-traceability.md) |
| Planning PR  | [#13](https://github.com/TsaoHoward/browser-dev-workbench/pull/13)                              |

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
