# Instrucciones para Claude Code en este repositorio

## Antes de ejecutar comandos que escriben o regeneran archivos

Antes de ejecutar cualquier comando que escriba o regenere archivos (`test:evidence`, `build`,
`seed`, migraciones, scripts de reporte), revisa `git status`. Si alguno de los archivos que se
van a escribir tiene cambios sin commitear, **detente y pregunta** antes de correr el comando —
no asumas que esos cambios son descartables solo porque no están commiteados.

Archivos generados automáticamente que este proyecto regenera con frecuencia (repasa igual el
`git status` antes de tocarlos, aunque en general sí es seguro sobrescribirlos):
- `evidencia_pruebas.json`
- `Documentacion/Reporte_Pruebas_StockPilot.md`
- `coverage/`

## Búsquedas exploratorias de código

Para cualquier búsqueda exploratoria de código (grep, leer varios archivos para entender algo),
delega al Agent tool con `subagent_type=Explore` en vez de hacerlo en el hilo principal — incluso
si es una sola consulta, si esperás que el resultado sea largo.
