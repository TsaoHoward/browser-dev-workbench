# Versioned work items

This directory is the Git-traceable control plane for project work. GitHub Issues are collaboration
projections; they must never be the only durable record of a requirement, delivery, or release
failure.

## Records and authority

- `issues/ISSUE-xxxx-*.md` preserves project-relevant GitHub Issue content, labels, lifecycle
  events, relationships, and restoration instructions.
- `requirements/REQ-xxxx-*.md` is the canonical versioned requirement record.
- A deployment workflow run is canonical release-verification evidence for a merged SHA. Artifacts
  remain in Actions for their configured retention period; the repository stores only redacted,
  durable links and summaries when needed.

An Issue record can recreate a replacement GitHub Issue with its title, body, labels, material
comments, and relationship history. GitHub-native Issue numbers, authorship, reactions, timestamps,
and notification state cannot be recreated exactly. A replacement therefore links the original URL
and this record rather than impersonating the original Issue.

## Automation-first lifecycle

1. An external intake form submission, or a release-verification failure, triggers an automation
   pull request that creates or updates the matching `ISSUE-xxxx` record. This synchronization PR
   is the only normal path from GitHub Issue state to Git state.
2. A planning PR creates or updates the linked `REQ-xxxx` record and, when required, a planned
   slice. The planning PR must merge before an implementation branch is created.
3. A progress PR created from the newer `main` branch may activate the planned slice and implement
   its scoped work. A completion PR records delivery and archives the slice.
4. The post-merge workflow verifies the delivery SHA. Success needs no synthetic commit. Failure
   automation creates or reopens the Issue and opens a new synchronization PR; remediation then
   re-enters the same intake-to-delivery path.

Humans do not normally edit Issue state, labels, titles, bodies, cross-links, or mirror records.
The only exceptions are external intake through an Issue form and an emergency incident action
marked `manual-exception`; both are reconciled by automation before further delivery work.

## Transitional bootstrap

`ISSUE-0011` is a recorded bootstrap exception because the control-plane automation did not yet
exist when GitHub Issue #11 was opened. Slice 08 must replace this exception with tested automation
before it can complete.
