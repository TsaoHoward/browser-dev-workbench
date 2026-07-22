# Slice 02 — Capability model and runtime boundaries

| Field        | Value                           |
| ------------ | ------------------------------- |
| Status       | planned                         |
| Owner        | repository contributors         |
| Dependencies | Slice 01 completed and ADR-0002 |

## Goal

Turn the current WebContainer-first vertical slice into a capability-oriented browser workbench
without adding GitHub writes. Establish which browser capabilities are present, which workflow
steps they enable, and where runtime, storage, version-control, and remote adapters begin and end.

## Scope

1. Define a small, testable browser capability registry. It must distinguish feature presence from
   a usable probe result, and report the reason a capability is unavailable without exposing
   sensitive data.
2. Define capability requirements for the present WebContainer adapter: secure context,
   cross-origin isolation, service-worker control, and any runtime-specific boot probe. Preserve
   the single-WebContainer-per-page service constraint.
3. Define the workflow contract for three progressive outcomes, derived from the registry:
   - **Full:** available WebContainer runtime, recoverable storage, browser-local Git when it is
     delivered, selected-folder access when granted, and a runtime preview.
   - **Reduced:** editor, recoverable storage, browser-local Git and WASM validation when their
     adapters are available, without a complete Node-compatible runtime.
   - **Portable:** editor, import/export, diff, patch, and basic static checks when available.
4. Document and introduce focused service contracts for Workspace Core, Runtime Adapters, Storage
   Adapters, Version Control, and Remote Repository Adapters. Keep the present IndexedDB,
   WebContainer, and public GitHub import implementations behind their appropriate boundaries;
   do not rewrite them merely to create abstractions.
5. Build a minimal verifiable loop that reports the detected capability result and only enables
   actions whose prerequisite capability is usable. Record a deployed Pages browser matrix for the
   capabilities actually probed.

## Out of scope

- GitHub authentication, tokens, remote writes, remote fetch/pull/push, and collaboration.
- Browser-local Git implementation, archive interchange, OPFS migration, or full editor/terminal
  replacement.
- Claiming parity across browsers without a targeted PoC.

## Acceptance criteria

- Capability detection is unit-tested with present, absent, and probe-failure dependencies.
- The UI or diagnostics makes the effective workflow and unavailable prerequisites understandable
  without presenting separate hard-coded products.
- Current WebContainer and IndexedDB behavior remains functional on the verified deployment path;
  an unavailable WebContainer does not make editing unavailable.
- The five boundaries and the recovery-versus-process-state distinction are represented in code and
  in durable documentation.
- A current deployed-origin browser check records the capability probes it actually ran; any
  unverified browser remains explicitly unverified.

## Validation and exit conditions

Run focused unit tests and `npm run validate`. Verify the capability loop on the deployed Pages
origin in the current Chromium target, including a service-worker-controlled reload and a graceful
unavailable-runtime condition. Archive only after the browser evidence and any deviations are
recorded.

## Open decisions before activation

1. Which small set of capability probes is safe to run automatically versus only after explicit
   user intent (for example, a WebContainer boot or folder picker)?
2. Which browser versions are the initial evidence targets, and which reduced-capability checks are
   practical outside Chromium?
3. Should the first reduced validation adapter be a worker-hosted tool or a WASM toolchain?
