# Slice 07 — Semi-automated browser acceptance

| Field        | Value                           |
| ------------ | ------------------------------- |
| Status       | active                          |
| Owner        | repository contributors         |
| Dependencies | Slice 02 deterministic evidence |
| Activated    | 2026-07-23                      |

## Goal

Establish a repeatable, evidence-producing browser-acceptance workflow that combines deterministic
automation with explicitly human-gated native browser actions. Use the existing Playwright runner
as the portable primary path; evaluate an MCP-capable browser session only as an optional
agent-assisted path. Later slices must be able to verify delivered workflows without adding
test-only product behavior or overstating browser support.

## Scope

1. Define three verification levels and their evidence requirements:
   - **Automated:** CI or local runner actions that are deterministic and do not need a native
     permission prompt.
   - **Agent-assisted:** an MCP-capable browser session, where available, navigates, inspects
     semantic UI state, captures diagnostics, and performs ordinary user-visible actions.
   - **Human-gated:** a person performs security- or platform-gated actions such as native folder
     selection, dismissal, and permission changes; the harness records the before/after state and
     browser context without attempting to bypass the prompt.
2. Use Playwright as the primary local and CI runner. It must write a schema-versioned, redacted
   acceptance-session JSON report and webpage screenshots; CI stores them as a 14-day workflow
   artifact, including any report produced before a failure. Evaluate an MCP-capable browser path
   against deployment-origin access, user-gesture handling, observability, artifact capture, and
   local reproducibility, but do not make it an acceptance gate or assume it is available in every
   developer or CI environment.
3. Define a small acceptance-session contract: target commit and Pages URL, browser/version,
   service-worker and isolation state, timestamped actions performed, capability results,
   redacted console/page errors, and webpage screenshots where useful. Human-gated scenarios must
   encode the expected outcome in the runner command (`selected` or `dismissed`) and verify the UI
   result; no free-text human attestation or folder path is recorded.
4. Turn Slice 02 native selected-folder evidence into the first reference scenario. Preserve the
   contract that selection is user initiated, handles are discarded, `AbortError` is
   `not-completed`, and `permission-denied` requires an obtained handle to explicitly report it.
   A headed runner opens the native dialog after the deterministic preflight; the person only
   selects a folder or dismisses the dialog, then the runner captures the observed web state.
   Do not retain a handle or add a test-only pause merely to force post-selection permission denial.
5. Propose how future slices add scenarios through stable accessibility-facing locators and focused
   service seams. Test instrumentation may observe or stub browser boundaries in isolated test
   contexts, but production code must not contain a test backdoor, disabled permission check, or
   synthetic success path.

## Out of scope

- Bypassing user activation, native pickers, browser permission prompts, cross-origin isolation, or
  WebContainer's runtime requirements.
- Shipping an MCP server, test runner, credential, remote-control endpoint, or browser extension as
  a workbench runtime dependency.
- Collecting repository contents, folder paths, credentials, or browser profiles as acceptance
  artifacts.
- Declaring browser parity or replacing targeted unit, integration, deployment, or security tests
  with broad end-to-end automation.

## Acceptance criteria

- A documented recommendation identifies the primary semi-automated path and its fallback, with a
  deployed-origin proof for the capabilities it actually exercises.
- The acceptance-session contract distinguishes automated observations from human-gated actions and
  stores only redacted, reviewable evidence.
- The native selected-folder scenario covers successful selection, dismissal, and post-selection
  permission denial when the platform can produce it without retaining a handle; an unreproducible
  platform state is recorded as a deviation rather than inferred from `AbortError`.
- A future-slice author can add a scenario without weakening the capability model, embedding a
  credential, or creating an undisclosed production test hook.
- Browser results describe observed capabilities and versions; unverified browsers remain marked as
  unverified.

## Validation and exit conditions

Run focused harness or service tests and `npm run validate`. Exercise the chosen primary path on the
deployed Pages origin, with a service-worker-controlled reload, and record the exact actions and
results. Perform the native folder steps through the headed runner with a human only when required.
Archive only after the MCP evaluation, evidence format, first reference scenario, residual privacy
risks, and deviations are recorded.

For the reference scenarios, run one command at a time against the deployed Pages URL. The runner
opens the dialog and verifies the declared result; the person performs only the action inside the
browser-native dialog:

```sh
npm run test:pages:browser:folder:selected -- <pages-url> --evidence-dir acceptance-evidence/selected
npm run test:pages:browser:folder:dismissed -- <pages-url> --evidence-dir acceptance-evidence/dismissed
```

## Remaining exit decision

1. Which MCP-capable browser tool can operate against the deployed origin with useful artifact
   capture while respecting native user-activation boundaries?
2. Can an MCP session add material diagnostic value beyond the Playwright evidence without becoming
   a CI or release dependency?

## Decisions and implementation progress

- 2026-07-23 — Playwright is the primary portable acceptance runner. The existing three deployed
  Chromium smoke paths now emit schema-versioned JSON and page screenshots, uploaded by CI as a
  redacted 14-day artifact. This preserves deterministic merge evidence even where MCP is absent.
- 2026-07-23 — Native selected-folder acceptance uses `--native-folder selected|dismissed --headed`.
  The runner completes navigation, service-worker/isolation checks, and UI assertions; the person
  only completes the native dialog. The command declares the expected outcome, so there is no
  free-text attestation to mistype.
- 2026-07-23 — The `permission-denied` branch remains covered by focused injected-boundary tests.
  It is not a required native human path because a successful picker result is checked and discarded
  immediately. If a target browser exposes a real denied result at that moment, record it; otherwise
  record the limitation as a deviation.
- 2026-07-23 — The new harness passed all three deterministic paths against the current deployed
  Pages origin in Chromium 149.0.7827.55: capability loop, unavailable runtime, and injected folder
  diagnostic. Each produced a redacted JSON session record and webpage screenshot with no console
  or page errors. Native selected and dismissed runs remain the required human-gated reference
  evidence before this slice can exit.
