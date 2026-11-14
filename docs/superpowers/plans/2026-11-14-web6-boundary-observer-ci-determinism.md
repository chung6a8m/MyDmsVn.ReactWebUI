# WEB6 Boundary Observer CI Determinism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the long WEB6 boundary observer unit case deterministic under parallel CI without changing any acceptance deadline.

**Architecture:** Retain the real observer and fake HTTP harness. Reduce only the injected unit-test polling frequency and expose a count of presentation observations as a regression boundary.

**Tech Stack:** TypeScript, Vitest fake timers, npm

**Spec:** `docs/superpowers/specs/2026-11-14-web6-boundary-observer-ci-determinism-design.md`

## Global Constraints

- No product, Playwright, named-pipe, request, selector, controller, or aggregate deadline changes.
- Preserve sequential 29-second context plus 29-second eligibility delays.
- Do not replace the observer with mocks or skip the eligibility500 case.

## Review Focus

- The test still proves no false PASS after five seconds.
- The two 29-second request paths remain sequential and complete before the 65-second eligibility500 deadline.
- Polling clamps exactly at the logical deadline.
- The wall-clock timeout is not merely widened.
- No runtime source changes.

---

### Task 1: Bound fake-clock polling overhead

**Files:**
- Modify: `tests/unit/http/web6BoundaryObserver.test.ts`

**Interfaces:**
- Consumes: injected `poll` callback used only by the observer unit harness.
- Produces: a bounded presentation-observation count for long sequential cases.

- [x] Add a failing assertion that each long sequential case uses at most fourteen presentation observations.
- [x] Run the focused file and verify RED from the current one-second polling loop.
- [x] Change the injected polling interval to five fake seconds, advance nested sequential timers explicitly, and keep the 15-second Vitest timeout unchanged.
- [x] Run focused repetition, full unit, typecheck and build; review the diff and commit.
