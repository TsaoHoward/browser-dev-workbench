# ISSUE-0011 — Governance: add versioned work-item traceability

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Status          | planned                                                                  |
| GitHub state    | open                                                                     |
| GitHub issue    | [#11](https://github.com/TsaoHoward/browser-dev-workbench/issues/11)     |
| Requirement     | [REQ-0801](../requirements/REQ-0801-versioned-work-item-traceability.md) |
| Slice           | [Slice 08](../../slices/active/08-versioned-work-item-traceability.md)   |
| Last synced     | 2026-07-24                                                               |
| Synchronization | Bootstrap exception — automation unavailable at intake                   |

## Source snapshot

**Title:** Governance: add versioned work-item traceability

**Labels:** `documentation`

### Original GitHub body

## Source

- Slice 03 closeout commit: `a3b5de4 ci(slices): enforce lifecycle closeout`
- Observation: the closeout introduced enforced slice lifecycle and handoff rules, but requirements,
  issue discussion, slices, branches, PRs, commits, and post-merge verification still lack one
  versioned relationship model.

## Goal

Create a Git-first, version-controlled work-item model. GitHub Issues remain the collaboration and
intake surface; canonical requirement state and relationships live in the repository.

## Proposed direction

- Define a versioned `REQ-xxxx` work-item schema and lifecycle.
- Link work items to slices, ADRs, Issues, PRs, validation evidence, and formal handoffs.
- Add Issue and PR templates plus CI validation.
- Use the governance slice itself as the bootstrap example; later governance/process changes must
  also carry a work item and an executable example.

## Required lifecycle distinction: delivery vs release verification

A completion PR merge and post-merge deployment verification are separate events and must not be
represented as one mutable closeout state.

- **Delivery** is a Git-traceable event: a completion PR, merge commit, versioned work-item state,
  and slice closeout.
- **Release verification** is an external workflow event against the merged SHA. Its deployed-origin
  result, evidence artifacts, and workflow URL cannot be added to the already-merged PR commit.
- A successful post-merge workflow is canonical release evidence; it should link to the delivery
  record without requiring a synthetic documentation commit.
- A failed post-merge workflow must reopen or create a traceable follow-up Issue that records the
  target SHA, source PR/work item/slice where available, workflow/artifact links, failure summary,
  and next action. Its fix then re-enters the normal Issue → REQ → branch → PR → delivery →
  release-verification chain.
- The model must distinguish artifact retention from durable release evidence, retain redaction
  requirements, and define what is recorded when an artifact expires.
- Automation is a design question for the slice: any failure-Issue path must be idempotent and use
  least privilege. Do not assume Dependabot is the right mechanism.

## Initial scope

Create and complete a planned governance slice (proposed as Slice 08 — Versioned work-item
traceability) with its own `REQ-0801`.

## Blocking

No. Slice 03 remains complete with `Handoff: none`; this is a tracked follow-up, not a transferred
Slice 03 exit condition.

## Exact next action

Open a new session from this issue, create the versioned `REQ-0801` record and planned Slice 08,
then define the bootstrap validation path and the delivery/release-verification relationship.

## Material GitHub comments

### 2026-07-24 — Self-discoverable information flow

Source: [Issue comment](https://github.com/TsaoHoward/browser-dev-workbench/issues/11#issuecomment-5068645785)

The active Slice 08 scope additionally requires a mandatory discovery chain:
`AGENTS.md` → slice index → the one active Slice → REQ → ISSUE record → GitHub projection. The
control plane must add a machine-validated registry/navigation entry that derives and validates the
active Issue, requirement, Slice, and external projection relationship without becoming a second
source of truth. It must enforce reciprocal links through the delivery relation and projection
marker. Each projected GitHub Issue needs a stable link back to the repository Issue record; the
registry must remain discoverable if GitHub is unavailable, and the GitHub marker must identify the
last known record if the repository is unavailable. A future session must need only the required
`AGENTS.md` reading path, not a hand-written Issue number or file path.

This expands active Slice 08 only. It does not alter the already merged planning or activation
history, and is to be implemented in a later Slice 08 progress PR.

## Lifecycle events

- 2026-07-24 — GitHub Issue #11 opened as a documentation-labelled governance follow-up.
- 2026-07-24 — This repository record captured the full source content. It is a documented bootstrap
  exception: future Issue-to-repository synchronization must be automation-created and reviewable.
- 2026-07-24 — The material scope amendment above was captured as part of the same pre-automation
  `ISSUE-0011` bootstrap record. Once intake automation is available, it must reconcile this record;
  this does not authorize another normal-path manual mirror update.

## Restoration notes

If GitHub Issue #11 becomes unavailable, automation must create a replacement from this source
snapshot, apply the recorded label, and link this file plus the original URL. It must preserve the
lifecycle events and relationship records, but must not represent the replacement as the original
Issue number or authorship.
