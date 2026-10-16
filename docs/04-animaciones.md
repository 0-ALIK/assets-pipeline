# Animaciones (`animation`)

[Volver al índice](README.md) · [Sprites](03-sprites.md)

Una animación tiene un ID, un modo de reproducción y una lista ordenada de frames. Cada frame
referencia por ID un sprite **del mismo archivo de origen** y guarda una duración en
milisegundos. No se extraen animaciones de tags o frames de Aseprite automáticamente; aquí se
definen manualmente. Si el juego necesita mezclar sprites en tiempo de ejecución, esa lógica
corresponde al motor, no a esta CLI.

Los índices de frames empiezan en **0**. Una animación puede estar vacía mientras la editas, pero
`validate` y `build` la rechazan cuando ya hay atlas configurados. Los IDs de animaciones son
únicos entre las animaciones de todo el repositorio. `--duration` debe ser un entero positivo y
se persiste como `durationMs`.

En el build, todos los frames de una animación deben pertenecer al mismo atlas y quedan juntos en
una sola página. Las animaciones que comparten sprites forman una unidad mayor que tampoco puede
dividirse entre páginas.

## `animation add`: crear animación vacía

```text
assets-pipeline animation add <archivo> --id <id> --playback <loop|once>
```

```sh
assets-pipeline animation add entities/humans_parts.aseprite --id npc/head_male_heavy/front/idle --playback loop
```

El archivo debe tener ya **al menos un sprite definido**. `loop` y `once` son los únicos valores
de reproducción aceptados. El ID no puede estar ocupado por otra animación. La animación recién
creada tiene `frames: []`.

## `animation show`: consultar

```text
assets-pipeline animation show <id>
```

```sh
assets-pipeline animation show npc/head_male_heavy/front/idle
```

Devuelve JSON con `path`, `id` y `animation`: `playback` y `frames` en su orden actual. Cada
frame aparece como `{ "sprite": "...", "durationMs": 120 }`. Un ID desconocido produce
`NOT_FOUND`.

## `animation set`: cambiar reproducción

```text
assets-pipeline animation set <id> --playback <loop|once>
```

```sh
assets-pipeline animation set npc/head_male_heavy/front/idle --playback once
```

`--playback` es obligatorio. Cambia únicamente el modo; conserva los frames y su orden.

## `animation rename`: cambiar ID

```text
assets-pipeline animation rename <id-actual> <id-nuevo>
```

```sh
assets-pipeline animation rename npc/head_male_heavy/front/idle npc/head_male_heavy/front/stand
```

El ID nuevo debe ser válido y no estar usado por otra animación. La animación conserva archivo,
modo y frames. No renombra los sprites que usan esos frames.

## `animation rm`: eliminar animación

```text
assets-pipeline animation rm <id> [--yes]
```

```sh
assets-pipeline animation rm npc/head_male_heavy/front/idle
assets-pipeline animation rm npc/head_male_heavy/front/idle --yes
```

Pide confirmación en terminal interactiva o `--yes` en un script. Elimina únicamente la
definición de animación: no borra sprites ni el archivo de imagen.

## Frames: añadir al final

```text
assets-pipeline animation frame add <id-animación> --sprite <id-sprite> --duration <ms>
```

```sh
assets-pipeline animation frame add npc/head_male_heavy/front/idle --sprite npc/head_male_heavy/front/idle_0 --duration 120
```

El sprite debe estar definido en el archivo al que pertenece la animación. `--duration` debe
ser un entero mayor que cero. El frame se añade después del último existente.

## Frames: insertar en una posición

```text
assets-pipeline animation frame insert <id-animación> --at <índice> --sprite <id-sprite> --duration <ms>
```

```sh
assets-pipeline animation frame insert npc/head_male_heavy/front/idle --at 1 --sprite npc/head_male_heavy/front/idle_1 --duration 150
```

Inserta **antes** del frame que ocupa `--at`; los siguientes avanzan una posición. El índice
puede ir de `0` a la longitud actual de la lista, inclusive. Usar la longitud equivale a
añadir al final. Con una animación vacía, el único índice válido es `0`.

## Frames: cambiar sprite o duración

```text
assets-pipeline animation frame set <id-animación> --at <índice> [--sprite <id-sprite>] [--duration <ms>]
```

```sh
assets-pipeline animation frame set npc/head_male_heavy/front/idle --at 1 --duration 200
assets-pipeline animation frame set npc/head_male_heavy/front/idle --at 1 --sprite npc/head_male_heavy/front/idle_2
assets-pipeline animation frame set npc/head_male_heavy/front/idle --at 1 --sprite npc/head_male_heavy/front/idle_1 --duration 150
```

`--at` es obligatorio y debe señalar un frame existente (`0` a longitud menos uno). Debes
indicar al menos una de `--sprite` o `--duration`; la propiedad omitida permanece igual. El
sprite nuevo, si lo hay, debe pertenecer al mismo archivo.

## Frames: reordenar

```text
assets-pipeline animation frame move <id-animación> --from <índice> --to <índice>
```

```sh
assets-pipeline animation frame move npc/head_male_heavy/front/idle --from 0 --to 2
```

Quita el frame en `--from` y lo inserta en `--to`, desplazando los demás; conserva sprite y
duración. `--from` debe existir. `--to` admite de `0` a la **longitud previa al movimiento**,
inclusive: indicar esa longitud mueve el frame al final. Por ejemplo, con `[A,B,C]`,
`--from 0 --to 2` produce `[B,C,A]`. La CLI no reproduce la animación; solo cambia su orden
persistido.

## Frames: quitar

```text
assets-pipeline animation frame rm <id-animación> --at <índice> [--yes]
```

```sh
assets-pipeline animation frame rm npc/head_male_heavy/front/idle --at 1
assets-pipeline animation frame rm npc/head_male_heavy/front/idle --at 1 --yes
```

El índice debe apuntar a un frame existente. La operación pide confirmación en terminal
interactiva o `--yes` en un script. Quita solo ese frame; no borra el sprite referenciado. Una
animación puede quedarse con cero frames.

## Secuencia completa de ejemplo

Después de definir `idle_0`, `idle_1` e `idle_2` **en el mismo archivo**:

```sh
assets-pipeline animation add entities/humans_parts.aseprite --id npc/head/front/idle --playback loop
assets-pipeline animation frame add npc/head/front/idle --sprite npc/head/front/idle_0 --duration 120
assets-pipeline animation frame add npc/head/front/idle --sprite npc/head/front/idle_2 --duration 180
assets-pipeline animation frame insert npc/head/front/idle --at 1 --sprite npc/head/front/idle_1 --duration 150
assets-pipeline animation frame set npc/head/front/idle --at 1 --duration 200
assets-pipeline animation show npc/head/front/idle
assets-pipeline validate entities/humans_parts.aseprite
```

Si renombras un sprite con `sprite rename`, las referencias de sus frames se actualizan. Si
intentas eliminar un sprite todavía referenciado, `sprite rm` lo rechaza con `IN_USE`.
