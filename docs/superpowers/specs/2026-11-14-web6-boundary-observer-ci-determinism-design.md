# WEB6 Boundary Observer CI Determinism Design

## Intent

Remove the recurrent CI-only wall-clock timeout in `web6BoundaryObserver.test.ts` without changing any product, browser, controller, request, or selector deadline. The test advances a 59.1-second fake-clock scenario through one-second polling increments; under a 90-worker CI run, processing roughly sixty asynchronous poll cycles can consume the test's 15-second real-time allowance even though the observer contract is correct.

## Chosen approach

Keep the existing fake-clock scenario and all 35/50/65-second boundary deadlines, but make the injected test poll adapter sample every five fake seconds, clamped exactly at its logical deadline. The long sequential context-plus-eligibility case then requires about twelve presentation observations instead of about sixty. Add an observable presentation-count assertion so a later change back to high-overhead polling fails deterministically.

Rejected alternatives:

- Increasing the Vitest wall-clock timeout alone would mask the adapter overhead and repeat the previous incomplete correction.
- Reducing the simulated HTTP delays would weaken the regression that proves both requests can legitimately exceed the former five-second assumption.
- Changing production/browser deadlines is outside scope and prohibited.

## Verification

Use TDD: first assert a bounded presentation count and observe the current one-second adapter fail; then change only the test adapter interval and expected fake-clock completion point. Run the focused file repeatedly, the full unit suite, typecheck/build, and protected CI. No live candidate is authorized by this correction.
