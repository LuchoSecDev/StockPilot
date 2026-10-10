---
name: api-contract-change
description: Use before changing any endpoint the Tendero mobile app uses (routes, request or response fields, status codes, error codes) or anything listed in docs/contrato_api_app_tendero.md.
---

# Changing the API contract of the Tendero app

The Flutter app is built by another part of the team, in another repository, against
`docs/contrato_api_app_tendero.md`. A silent change here breaks their app. Changing a public contract is a
high-risk change: stop and ask first (see `CLAUDE.md`).

## Is it breaking?

- **Compatible:** adding a new field to a response, adding an optional request field.
- **Breaking:** renaming or removing a field, changing a status code or an error `code`, making a field required,
  changing a type or a format. Breaking changes need agreement with the app team before any code.

## Steps (section 12 of the contract)

1. Propose the change in the contract first, in the backend branch, saying whether it breaks the app.
2. Change the code **and** `tests/integration/contrato_app_tendero.test.js` in the same commit. Each endpoint has an
   ID (`[S2]`, `[V2]`, `[K3]`...): keep the ID in the test name.
3. Regenerate the examples in `docs/ejemplos_app_tendero/` and review the diff before committing:
   ```bash
   npx vitest run --config vitest.integration.config.js tests/integration/ejemplos_app_tendero.test.js -u
   ```
4. Tell the app team before deploying.
5. During the six weeks of the pilot only bug fixes are deployed (plan 22, section 5, block D).

## Rules that already bit this project

- Contract before client code: copy a real example from `docs/ejemplos_app_tendero/` into the client's fixtures and
  test against it; never invent a response shape (`docs/planes/reglas_proyecto.md`, rule 1).
- A known wrong behavior that is kept on purpose is documented as **COMPORTAMIENTO ACTUAL** and its test is written
  to fail when it is fixed.
- Only the sale `[V2]` is idempotent (`Idempotency-Key`). Other writes sent twice are recorded twice (P24-07):
  do not add retries to them without adding idempotency first.
- Role changes must match `docs/propuesta_matriz_roles_P22-10.md`; update that file when the matrix changes.
- After the change, update the plan and the tracker (`docs/seguimiento_planes.xlsx`).
