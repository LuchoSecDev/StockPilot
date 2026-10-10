---
name: refactor-with-characterization
description: Use before moving or restructuring existing backend or frontend code in StockPilot (controllers to services, splitting pages, renaming modules) when the behavior must stay the same.
---

# Refactoring without changing behavior

Refactoring means moving code without changing what it does (plan 21, section 3). In R1 a first attempt changed
six behaviors and nothing noticed until the characterization tests from R0 failed: a 500 became a 200, a 404
became a 500, a prompt was shortened, a broken import left the AI in "maintenance" forever. Several of those
behaviors had no test at all.

## Before moving anything

1. **Pin the current behavior with integration tests** (`supertest` against `stockpilot_test`, pattern in
   `tests/integration/`). Cover the **error branches** too (400, 403, 404, 409, 500 without an OpenAI key,
   "no candidates", empty lists), not only the happy path.
2. Run the suites and write down the numbers: `npm test`, `npm run test:integration` and
   `npm run test:coverage:combinada`.

## While moving

- One module per branch and per merge. No mass refactors.
- If you find a bug, do not fix it inside the refactor: fix it in a separate commit, with its own test.
- Services receive data and return data: never `req`, `res` or `session` inside `services/` (so they can be unit
  tested and later moved to the `ia-service`).
- Replace `console.*` with the pino `logger` in the files you touch.
- Moving a file changes its path: search `docs/` and the plans for the old path and update them.

## Done means

- All unit and integration tests pass; coverage did not go down. The thresholds in `vitest.config.js` only go up,
  never down.
- Mutation check: break the moved code on purpose in a few places; at least one test must fail each time.
- Prompts sent to OpenAI and response shapes are byte-identical when the refactor should not change them
  (compare against `HEAD`).
- The report says what was run, what was not (for example, the app was not started with `node app.js`) and which
  behaviors remain untested.
