# Slice 02 — Capability model and runtime boundaries

| Field        | Value                           |
| ------------ | ------------------------------- |
| Status       | active                          |
| Owner        | repository contributors         |
| Dependencies | Slice 01 completed and ADR-0002 |
| Activated    | 2026-07-23                      |

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
     These labels describe actions that delivered adapters have actually enabled; they must not imply
     that an undispatched adapter exists. Slice 02 delivers no Worker/WASM validation, archive, diff,
     or patch operation.
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

## Pre-activation research record — 2026-07-22

This record informs activation; it does not activate the slice or approve an implementation.

### Maintainer decisions

The maintainer approved the following directions on 2026-07-22:

1. Adopt the passive-detection plus intent-triggered usable-probe policy below.
2. Make current Chromium the only required initial browser evidence target. Other browsers remain
   capability-detected and explicitly unverified; they do not create separate product modes.
3. Do not select a Worker-hosted or WASM validation toolchain in Slice 02. Establish only the
   capability and result boundary, then evaluate an actual reduced validation adapter in a later
   slice against a concrete use case.
4. Treat service-worker control as the GitHub Pages COOP/COEP-shim deployment capability, not as
   an intrinsic WebContainer boot prerequisite. The WebContainer runtime prerequisite remains a
   secure, cross-origin-isolated context with `SharedArrayBuffer`; the registry reports the shim
   independently so a deployment with real response headers is not falsely rejected.
5. Use a focused `RuntimeOperationError` contract. Runtime boot, mount, command, and dev-server
   outcomes are separate from browser capability results. Dev-server startup has a 30-second
   timeout after the process is spawned, accepts an `AbortSignal`, and terminates as `ready`,
   `server-exited-before-ready`, `server-start-timeout`, or `cancelled`. The UI presents an
   explicit cancel action while startup is pending.
6. A selected-folder picker `AbortError` is reported as `not-completed`, not as a definite user
   cancellation or permission denial: the platform uses that exception for both cancellation and
   some refusal cases. Report `permission-denied` only after an obtained handle explicitly reports
   it through the permission API. Slice 02 keeps selected-folder access as a detected/probed
   adapter boundary and does not retain or write a selected folder.
7. Represent the five boundaries through focused existing or newly consumed contracts. Do not add
   a generic provider framework or a no-op Version Control adapter before Slice 04 has a concrete
   consumer; document Version Control as the reserved browser-local boundary instead.

### Approved probe policy

Use two phases rather than treating API presence as success:

1. **Passive capability detection** may check secure context, `crossOriginIsolated`,
   `SharedArrayBuffer`, service-worker support/control, IndexedDB, `navigator.storage`, workers,
   WebAssembly, OPFS API presence, and File System Access API presence. It must not open a picker,
   boot a runtime, install packages, or create workspace data.
2. **Intent-triggered usable probes** run only for the requested workflow: storage estimation and
   OPFS access for persistent storage; directory selection from an explicit click; and
   `WebContainer.boot()` only when the user starts a runtime action. Cache the result for the page
   session and report a redacted failure reason.

This boundary follows the platform constraints: File System Access pickers require transient user
activation, while WebContainer documents `boot()` as expensive and allows only one concurrent
instance. WebContainer also requires `SharedArrayBuffer` and cross-origin isolation. See the
[WebContainer quickstart](https://webcontainers.io/guides/quickstart),
[WebContainer API](https://webcontainers.io/api), and
[MDN user-activation guidance](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation).

### Existing implementation alignment

The current runtime service already keeps the expensive runtime load on the intent path:
`WebContainerRuntime` imports `@webcontainer/api` dynamically only inside its private `#boot()`
method, and `#boot()` is reached through existing runtime actions rather than application mount.
The service also preserves the required one-container-per-page reuse and rejects a boot when
`crossOriginIsolated` is false. Slice 02 should retain those properties, place capability discovery
ahead of the generic runtime error text, and add a small result model that distinguishes
unavailable, not-yet-probed, user-action-required, ready, and failed states. It should not rewrite
the runtime merely to introduce an abstraction.

Code review also identifies a runtime-adapter contract risk for activation: installation rejects
when its process exits non-zero, but dev-server startup currently resolves only on `server-ready`.
If that process exits before readiness, the service logs the exit but does not reject the pending
startup promise. Slice 02 must define an explicit terminal result for server-ready, early process
exit, cancellation, and bounded timeout. This is an operational failure after a usable runtime
probe, not evidence that the browser capability itself is unavailable.

### Candidate result matrix

The registry should report a capability result and keep operation outcomes separate. The following
is the approved activation contract, not a final type design:

| Capability or operation           | Passive result                                                                     | Intent-triggered terminal result                                              | Required user-facing outcome                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Editor / Workspace Core           | `ready` once the application mounts                                                | n/a                                                                           | Editing remains usable whenever the page itself loads.                                                        |
| Recoverable IndexedDB workspace   | `not-probed` if API presence is unknown; otherwise `available`                     | `ready`, `failed`, or `quota-exceeded` after load/save                        | Keep the in-memory workspace usable; offer actionable recovery or export guidance on failure.                 |
| OPFS workspace/repository storage | `unavailable` or `available` by API presence                                       | `ready` or `failed` after the storage action                                  | Do not imply persistence merely from API presence.                                                            |
| Selected local folder             | `unavailable` or `user-action-required`                                            | `ready`, `not-completed`, `permission-denied`, or `failed`                    | Open a picker only from a trusted user action; a picker `AbortError` is not a definite cancellation/denial.   |
| WebContainer runtime              | `unavailable` if required isolation/SAB prerequisites fail; otherwise `not-probed` | `ready` after boot, or `boot-failed`                                          | Keep editor and portable actions available; give reload/deployment guidance only for the failed prerequisite. |
| Runtime mount / install           | n/a after runtime is ready                                                         | `mount-failed`, `command-failed`, `cancelled`, or `ready`                     | Report the operation and retain the browser workspace unchanged.                                              |
| Dev server                        | n/a after runtime is ready                                                         | `ready`, `server-exited-before-ready`, `server-start-timeout`, or `cancelled` | Never leave the UI indefinitely in “starting”; preserve log context without treating it as capability loss.   |
| Worker or WASM fallback           | `unavailable` or `available` by API presence                                       | `ready` or adapter-specific `failed` when later requested                     | Present only actions the delivered adapter can actually run.                                                  |

`unavailable` means an observed prerequisite is absent; `not-probed` means it may be usable but no
costly or permission-gated action has run; `available` is a passive indication only; and `ready`
requires the applicable usable probe. Raw exceptions remain internal diagnostic data and must be
mapped to redacted actionable messages. The matrix deliberately does not use a browser name as a
state.

### Initial local Chromium PoC

On 2026-07-22, a headless Chromium page loaded the current local Vite workbench after the
COI-service-worker reload. It reported `true` for secure context, cross-origin isolation,
`SharedArrayBuffer`, service-worker support and control, IndexedDB, StorageManager,
`StorageManager.estimate`, `StorageManager.getDirectory`, `showDirectoryPicker`, Worker, and
WebAssembly. `navigator.storage.estimate()` returned a finite origin quota. This is evidence that
the current local path exposes the candidate APIs; it is not a cross-browser compatibility claim,
a storage durability guarantee, a user-folder permission grant, or deployed-Pages verification.

The same passive snapshot then ran on the current deployed Pages origin in headless Chromium after
service-worker control and reported the same `true` results plus a finite storage estimate. That
confirms the currently deployed build's candidate API exposure and COI-shim outcome in this test
environment only. It did not call a directory picker or boot a WebContainer, and it does not verify
this unmerged branch's deployment.

### Deployed intent-triggered runtime PoC

Also on 2026-07-22, headless Chromium loaded the current deployed Pages build, waited for
service-worker control and cross-origin isolation, then used the existing **Install & run dev**
button. WebContainer booted and mounted the eight-file fixture within the first five-second sample.
`npm install` remained the active command through the forty-second sample; the dev command started
at roughly forty-five seconds, and the workbench reached `running` with a WebContainer preview URL
by fifty seconds. The browser reported no console or page errors.

This establishes one end-to-end full-runtime path for the current small fixture on the published
build. It does not establish package-manager timing guarantees, support for arbitrary dependency
graphs, process recovery after reload, other browsers, or the unmerged Slice 02 deployment.

### Reduced-path primitive PoC

On the same deployed-origin Chromium session, an in-page probe created a Blob-backed Web Worker,
exchanged a message, and then terminated it. It also instantiated the minimal valid WASM binary.
Both operations completed successfully. This is evidence that the worker and WASM primitives are
usable in that environment; it neither selects a validation toolchain nor proves any language
service, package, or reduced-runtime workflow.

The Storage API can estimate usage/quota and request best-effort persistent storage, but quota and
eviction behavior remain browser-controlled; OPFS access can fail under storage or private-browsing
constraints. See [StorageManager](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager),
[OPFS `getDirectory()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/getDirectory),
and [storage quota and eviction guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

An additional deployed-origin Chromium probe successfully obtained the OPFS root
`FileSystemDirectoryHandle` without creating a file. In that clean headless profile,
`navigator.storage.persisted()` returned `false`; the probe intentionally did not call
`navigator.storage.persist()`. Treat this as an available OPFS operation with best-effort storage,
not a persistence grant or protection from eviction.

### Evidence still required

- Repeat passive and runtime probes on the Slice 02 deployment after service-worker control.
- Verify the deployed unavailable-runtime smoke path keeps the editor usable. Keep runtime boot
  failure mapping covered by the injected runtime unit tests unless a stable browser-level failure
  setup is available without a production test backdoor.
- Establish the initial browser evidence matrix; WebContainer's support guidance continues to make
  Chromium the strongest starting point, while other browser behavior must be measured separately.
- Complete native Chromium selected-folder selection, cancellation, and post-selection
  permission-denial checks. The deployed smoke test covers only the button-triggered path with an
  injected picker stub; it does not claim native-picker behavior.

## Acceptance criteria

- Capability detection is unit-tested with present, absent, and probe-failure dependencies.
- Unit tests cover the proposed result matrix, including the distinction between unavailable,
  not-probed, picker `not-completed`, runtime boot failure, command failure, early dev-server exit,
  and timeout.
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

## Implementation progress

- 2026-07-23 — Activated with the maintainer decisions above. The activation environment uses
  Playwright 1.61.1 and Chromium 149.0.7827.55. Implement the focused registry and runtime
  lifecycle contract before repeating the deployed-origin evidence on this slice's deployment.
- 2026-07-23 — Added the passive capability registry, an explicit storage/OPFS usable probe,
  capability diagnostics, and deploy-smoke output for the capabilities it actually checks. The
  Pages service-worker shim is reported separately from WebContainer runtime prerequisites.
- 2026-07-23 — Added structured runtime failures and a cancellable 30-second dev-server startup
  bound. Early process exit, timeout, cancellation, and `server-ready` are unit-tested; the editor
  remains usable when the runtime is unavailable or boot fails.
- 2026-07-23 — Added a selected-folder diagnostic that discards the handle after probing it and
  maps picker `AbortError`, explicit permission denial, and operational failure without exposing
  raw exceptions. The Pages workflow now includes lightweight unavailable-runtime and
  user-initiated-folder-diagnostic smoke paths; the full runtime flow remains opt-in.

### Validation to date

- Local Chromium smoke verification passed after the COI service-worker reload. It recorded ready
  Workspace Core, IndexedDB, OPFS (after explicit probe), and Pages isolation shim; selected folder
  remained correctly `user-action-required`, and Worker/WASM remained passive `available` results.
- A local production-preview Chromium check blocked the COI shim and confirmed the runtime action
  was unavailable while the editor remained editable. A separate injected-picker check confirmed
  that folder selection was not called during page load and ran exactly once from the diagnostic
  button.
- The deployed-origin verification remains an exit condition and must run only after this branch is
  deployed to Pages.
