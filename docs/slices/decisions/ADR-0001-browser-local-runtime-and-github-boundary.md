# ADR-0001 — Browser-local runtime and GitHub boundary

| Field  | Value      |
| ------ | ---------- |
| Status | accepted   |
| Date   | 2026-07-21 |

## Context

The first product slice must establish whether a static GitHub Pages application can host a small
browser-local Svelte development loop without prematurely becoming a full IDE or privileged GitHub
client.

## Decision

The UI remains a static Svelte application. Project files, package installation, and the dev server
run in a single browser-local WebContainer. IndexedDB holds a temporary workspace snapshot. GitHub
integration stays behind a service boundary and is non-privileged until a later approved slice
defines explicit authorization and security behavior.

GitHub Pages uses the COOP/COEP service-worker shim as a feasibility mechanism because Pages does
not provide custom response headers. Actual deployed-origin behavior remains a verification item.

## Consequences

- The application must retain Chromium-focused compatibility and cross-origin-isolation constraints.
- A browser snapshot is not durable repository history and needs explicit conflict behavior before
  repository import or future writes.
- The implementation avoids OAuth, commits, pull requests, and Actions dispatch in the current
  milestone.
- Future capability expansion must preserve service boundaries and cannot embed credentials.
