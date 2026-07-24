# REQ-0801 — Versioned work-item traceability

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| Status               | planned                                                                           |
| Source Issue         | [ISSUE-0011](../issues/ISSUE-0011-governance-versioned-work-item-traceability.md) |
| Slice                | [Slice 08](../../slices/active/08-versioned-work-item-traceability.md)            |
| Delivery             | Pending Slice 08 completion PR                                                    |
| Release verification | Post-merge `Deploy GitHub Pages` workflow for the delivery SHA                    |

## Requirement

The repository must preserve a version-controlled representation of project Issue content,
material lifecycle state, and relationships, so a replacement GitHub Issue can be recreated without
treating the mutable GitHub UI as the only record. The normal lifecycle must be automation-first:
humans create code branches and review pull requests, while workflows project Issue state and
repository records without manual status maintenance.

## Acceptance criteria

1. Versioned Issue records and requirements have documented, validated identifiers, required
   fields, lifecycle states, reciprocal relationships, and restoration limits.
2. An automated, reviewable path captures external intake and post-merge failure Issue state into a
   repository record. Manual sync is allowed only for a documented emergency exception.
3. A planning PR creates the Issue record, requirement, and planned slice before implementation;
   only a merged progress PR activates a slice.
4. Pull-request validation rejects invalid work-item relations and rejects manual control-plane
   state changes outside the allowed automation and emergency paths.
5. Delivery and release verification remain distinct: the completion PR records delivery; the
   post-merge workflow identifies the same merged SHA without a synthetic success commit.

## Non-goals

- A general bidirectional mirror of every GitHub comment, reaction, notification, or user identity.
- Copying workflow artifacts, raw logs, credentials, or unredacted browser evidence into Issues or
  Git.
- Fully automating code-authoring branches or replacing human review of pull requests.

## Decisions and progress

- 2026-07-24 — GitHub Issue #11 is the only bootstrap exception. Its source snapshot is recorded
  manually because the future automation did not exist at intake; Slice 08 may not create another
  normal-path manual synchronization step.
- 2026-07-24 — A planned slice is not active until a progress PR moves it into `active/` and merges.
  The planning branch may never claim active implementation state.
- 2026-07-24 — The next implementation branch is created only after this planning record merges to
  `main`; it will add the schema validator, Issue/PR templates, and automation PoC.
