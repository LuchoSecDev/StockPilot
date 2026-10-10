# Instrucciones para Claude Code en este repositorio

## Antes de ejecutar comandos que escriben o regeneran archivos

Antes de ejecutar cualquier comando que escriba o regenere archivos (`test:evidence`, `build`,
`seed`, migraciones, scripts de reporte), revisa `git status`. Si alguno de los archivos que se
van a escribir tiene cambios sin commitear, **detente y pregunta** antes de correr el comando —
no asumas que esos cambios son descartables solo porque no están commiteados.

Archivos generados automáticamente que este proyecto regenera con frecuencia (repasa igual el
`git status` antes de tocarlos, aunque en general sí es seguro sobrescribirlos):
- `evidencia_pruebas.json`
- `evidencia_pruebas_integration.json` (solo si `npm run test:evidence` alcanzó a correr la integración)
- `docs/Reporte_Pruebas_StockPilot.md`
- `coverage/`

## Búsquedas exploratorias de código

Para cualquier búsqueda exploratoria de código (grep, leer varios archivos para entender algo),
delega al Agent tool con `subagent_type=Explore` en vez de hacerlo en el hilo principal — incluso
si es una sola consulta, si esperás que el resultado sea largo.

## When to stop and ask

Before implementing, stop and ask the user if any of the following applies. Do not improvise or pick an interpretation on your own.

**Unclear requirements**
- The task allows two or more reasonable interpretations that would lead to different results.
- Necessary information is missing (scope, inputs, outputs, error cases) and cannot be inferred from the code or from these rules.
- The request contradicts a rule in this document or the existing code.

**High-risk changes**
- It affects persistent data: migrations, deletions, schema changes.
- It touches security: authentication, permissions, secrets, input validation.
- It changes public contracts (APIs, formats) or modifies many files at once.
- It is hard to revert or hard to verify with tests.

**How to ask**
1. Summarize in one line what you understood.
2. State exactly what is ambiguous or risky.
3. Propose 2 or 3 options with their trade-offs and indicate which one you recommend.
4. Wait for the answer before writing code.

**When not to ask**
- If the doubt can be resolved by reading the code or these rules, resolve it yourself.
- If it is a minor, reversible detail, choose the most reasonable option and mention it at the end.
