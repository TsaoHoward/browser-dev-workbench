# Slice 00 — AI repository foundation

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Status       | completed                                                              |
| Owner        | repository contributors                                                |
| Completed    | 2026-07-21                                                             |
| Dependencies | Existing WebContainer vertical slice and its README architecture notes |

## Scope and outcome

This slice created durable instructions and planning documents for contributors and coding agents.
It did not add GitHub import, OAuth, write operations, or runtime features.

Delivered:

- Root `AGENTS.md` with mission, reading order, safety rules, validation, and handoff expectations.
- `docs/PROJECT_CONVENTIONS.md` with engineering, persistence, compatibility, and credential rules.
- Slice index, archive guidance, and a decision record for the current architecture boundary.
- A planned read-only GitHub import slice with its open product and technical decisions recorded.
- README links to the durable documentation rather than a duplicated planning specification.

## Validation

`npm run format:check` and `npm run validate` passed on 2026-07-21. The validation suite completed
with zero lint errors, zero Svelte diagnostics, and 4 passing tests; the production build completed
successfully.

## Handoff

The exact next action is to agree the five open decisions in the planned read-only GitHub import
slice before moving it into `active/`.
