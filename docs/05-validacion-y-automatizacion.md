# Validación, scripts y errores

[Volver al índice](README.md)

## `validate`: repositorio completo o un archivo

```text
assets-pipeline validate [archivo]
```

```sh
assets-pipeline validate
assets-pipeline validate entities/humans_parts.aseprite
assets-pipeline --repo ./game-assets validate
```

Sin argumento, revisa todos los PNG/Aseprite presentes y todas las rutas de origen registradas
en `db.json`. Con un argumento, revisa **solo ese archivo**; la ruta es relativa a la raíz del
repositorio y debe terminar en `.png` o `.aseprite`. Si no hay problemas, imprime
`Validación correcta.`. Si encuentra problemas, imprime cada uno por stderr, resume cuántos
encontró y termina con error.

Al leer `db.json`, la CLI valida la versión del esquema, los datos del proyecto, los IDs, la
forma y valores de sprites y animaciones, y que cada frame referencie un sprite del mismo
archivo. Para los archivos fuente, `validate` lee **solo las cabeceras necesarias** para obtener
el tamaño y comprueba que los rectángulos registrados quepan en el lienzo. También informa
rutas registradas cuyos archivos faltan o tienen cabecera inválida. Un PNG/Aseprite presente y
sin definiciones puede validarse correctamente: `validate` no exige que todo archivo tenga
sprites.

Cuando existe al menos un atlas configurado, `validate` también exige que todos los grupos de
sprites estén asignados, que no haya grupos inexistentes o repetidos y que cada sprite quepa en
el tamaño de página correspondiente. También rechaza animaciones vacías, animaciones cuyos frames
pertenezcan a atlas diferentes y conjuntos de frames conectados que no puedan caber juntos en una
página. Si todavía no hay ningún atlas, estas reglas de build no invalidan un repositorio que solo
está definiendo sprites.

### Lo que `validate` no comprueba

- No decodifica píxeles, capas, cels ni todos los chunks de Aseprite.
- No comprueba CRCs ni todo el contenido de un PNG.
- No determina si la región contiene visualmente el sprite deseado, ni si los frames forman
  una animación coherente.
- No genera atlas ni reparaciones automáticas; para generar salidas usa `build`.

Por eso, una validación correcta garantiza la integridad **modelada por esta versión**, no la
integridad completa del formato de imagen ni su sentido artístico.

## Confirmaciones y automatización

Las operaciones que pueden borrar o desplazar datos piden confirmación: `fs move`, `fs rename`,
`fs rm`, `sprite rm`, `animation rm`, `animation frame rm`, `atlas rm` y `atlas group rm`. En una terminal interactiva se
acepta `s`, `si`, `sí`, `y` o `yes`; la respuesta por defecto es **no**. En scripts no hay
pregunta interactiva: usa `--yes` en cada operación que lo requiera. `--yes` **no** evita
validaciones ni permite sobreescrituras ilegales.

`fs move`, `fs rename` y `fs rm` ofrecen `--dry-run`. Es una vista previa sin mutación. Para
eliminar una carpeta no vacía se necesita además `--recursive`, incluso si ya se pasó `--yes`.
Los comandos de lectura (`version`, `info`, `status`, `ls`, `sprite list/show`,
`animation show`, `validate`) no necesitan confirmación.

En un script, comprueba el código de salida de **cada** comando; no encadenes operaciones
suponiendo que el último resultado demuestra que los anteriores funcionaron. Ejemplo POSIX:

```sh
set -e
assets-pipeline --repo ./game-assets fs move entities/player.aseprite entities/hero.aseprite --dry-run
assets-pipeline --repo ./game-assets fs move entities/player.aseprite entities/hero.aseprite --yes
assets-pipeline --repo ./game-assets validate
```

En PowerShell, después de un ejecutable nativo, `$LASTEXITCODE` contiene su código de salida.
Al pasar valores con comas, usa comillas, por ejemplo `--rect '0,0,32,32'` y
`--pivot '0.5,1.0'`.

## Errores y códigos de salida

Los errores de dominio se imprimen en stderr como `CÓDIGO: mensaje` y terminan con código de
salida `1`. Los casos principales son:

| Código               | Causas habituales                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`      | Ruta/ID/índice/rectángulo/pivot/duración inválidos, falta `--yes` en script o una operación no permitida.                              |
| `NOT_FOUND`          | No existe el repositorio, la ruta solicitada, el sprite o la animación.                                                                |
| `ALREADY_EXISTS`     | El ID o destino ya existe, o se intenta inicializar un repositorio existente/anidado.                                                  |
| `IN_USE`             | Un sprite es usado por frames, hay animaciones que impiden quitar el último sprite o el repositorio está bloqueado por otra operación. |
| `INVALID_SOURCE`     | Cabecera de PNG/Aseprite inválida o problemas encontrados por `validate`.                                                              |
| `INVALID_REPOSITORY` | JSON o esquema inválido, carpeta interna insegura, referencias persistidas incoherentes o reversión incompleta.                        |

Los fallos de argumentos que detecta el analizador de comandos también terminan con error; usa
`--help` para confirmar opciones obligatorias. La CLI no ofrece todavía salida `--json` global,
ni garantiza que los mensajes de presentación sean una API estable para scripts. Las consultas
`sprite list`, `sprite show` y `animation show` sí imprimen JSON.

## Diagnóstico habitual

| Síntoma                                                    | Qué revisar                                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `No hay repositorio`                                       | Ejecuta `init` en una carpeta existente o usa `--repo` apuntando a la raíz exacta.                                                         |
| `ls` muestra `undefined`                                   | El archivo existe, pero aún no tiene sprites definidos; usa `sprite add`.                                                                  |
| `ls` muestra `missing`                                     | `db.json` conserva una ruta cuyo archivo se movió o borró fuera de la CLI; restaura o corrige la ubicación.                                |
| `INVALID_INPUT: --rect usa x,y,width,height` en PowerShell | Encierra toda la tupla entre comillas: `--rect '3,3,15,15'`.                                                                               |
| Un sprite no se puede eliminar                             | Busca sus frames con `animation show`; quita/cambia las referencias primero.                                                               |
| Un `fs rm` de carpeta falla                                | Comprueba si está vacía; para una no vacía usa `--recursive` y confirma o añade `--yes`.                                                   |
| `db.json` inválido                                         | Restaura una copia válida; la CLI valida al leer y no repara JSON corrupto automáticamente.                                                |
| `El repositorio está ocupado`                              | Hay un lock de escritura en `.assets-pipeline-cache/lock`; comprueba primero si otra operación sigue activa. No elimines el lock a ciegas. |

## Alcance actual

La CLI implementa definición, administración local y builds de atlas. No existe aún `watch`.
El proyecto Desktop tampoco forma parte de este manual. Para el build consulta
[Grupos, atlas y build](06-atlas-y-build.md); para el modelo persistido y su migración, consulta
[Datos persistidos](01-inicio-y-repositorio.md#datos-persistidos).
