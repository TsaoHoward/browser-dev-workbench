# Slice 07 — Semi-automated browser acceptance

| Field        | Value                           |
| ------------ | ------------------------------- |
| Status       | planned                         |
| Owner        | repository contributors         |
| Dependencies | Slice 02 exit evidence recorded |

## Goal

Establish a repeatable, evidence-producing browser-acceptance workflow that combines deterministic
automation with explicitly human-gated native browser actions. Evaluate an MCP-capable browser
session and a portable runner alternative so later slices can verify delivered workflows without
adding test-only product behavior or overstating browser support.

## Scope

1. Define three verification levels and their evidence requirements:
   - **Automated:** CI or local runner actions that are deterministic and do not need a native
     permission prompt.
   - **Agent-assisted:** an MCP-capable browser session, where available, navigates, inspects
     semantic UI state, captures diagnostics, and performs ordinary user-visible actions.
   - **Human-gated:** a person performs security- or platform-gated actions such as native folder
     selection, dismissal, and permission changes; the harness records the before/after state and
     browser context without attempting to bypass the prompt.
2. Evaluate at least one MCP-capable browser path and one runner fallback (for example the existing
   Playwright-based path) against deployment-origin access, user-gesture handling, observability,
   artifact capture, CI suitability, and local reproducibility. Do not assume an MCP server is
   available in every developer or CI environment.
3. Define a small acceptance-session contract: target commit and Pages URL, browser/version,
   service-worker and isolation state, actions performed, capability results, console/page errors,
   screenshots or text artifacts where useful, and an explicit human-attestation field for gated
   steps.
4. Turn Slice 02 native selected-folder evidence into the first reference scenario. Preserve the
   contract that selection is user initiated, handles are discarded, `AbortError` is
   `not-completed`, and `permission-denied` requires an obtained handle to explicitly report it.
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
  permission denial when the platform can produce it; an unreproducible platform state is recorded
  as a deviation rather than inferred from `AbortError`.
- A future-slice author can add a scenario without weakening the capability model, embedding a
  credential, or creating an undisclosed production test hook.
- Browser results describe observed capabilities and versions; unverified browsers remain marked as
  unverified.

## Validation and exit conditions

Run focused harness or service tests and `npm run validate`. Exercise the chosen primary path on the
deployed Pages origin, with a service-worker-controlled reload, and record the exact actions and
results. Perform the native folder steps with a human when required. Archive only after the tool
decision, evidence format, first reference scenario, residual privacy risks, and deviations are
recorded.

## Open decisions before activation

1. Which MCP-capable browser tool can operate against the deployed origin with useful artifact
   capture while respecting native user-activation boundaries?
2. Is the existing Playwright smoke suite the portable fallback, or should a separate browser
   protocol runner be introduced for agent-assisted sessions?
3. Where should redacted acceptance evidence live: workflow artifacts, a bounded repository record,
   or both, and what retention policy is acceptable?
4. Which evidence must be human-attested versus independently reproducible in CI?
