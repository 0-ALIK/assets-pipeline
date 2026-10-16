# Sprites (`sprite`)

[Volver al índice](README.md) · [Repositorios y rutas](01-inicio-y-repositorio.md)

Un sprite es una **región rectangular definida manualmente** sobre un archivo `.png` o
`.aseprite`. La CLI lee las dimensiones de la cabecera para comprobar que el rectángulo cabe en
el lienzo; no detecta automáticamente sprites, cels ni capas. Un archivo aparece como `defined`
en `ls` cuando tiene al menos un sprite. Las definiciones viven en `db.json`, no alteran los
píxeles del archivo fuente.

## Coordenadas, IDs y pivot

`--rect` recibe `x,y,width,height` en **píxeles**. El origen `(0,0)` es la esquina superior
izquierda del lienzo; `x` e `y` son enteros no negativos, y `width` y `height` son enteros
positivos. La región debe caber en la imagen. `--pivot` recibe `x,y` **normalizados dentro de
esa región**, ambos entre `0` y `1` inclusive: `0,0` es arriba a la izquierda; `0.5,1` es el
centro del borde inferior. No hay conversión automática de coordenadas de píxeles a pivot.

En PowerShell, encierra los valores con comas entre comillas para que lleguen como un solo
argumento: `--rect '64,0,32,32' --pivot '0.5,1.0'`.

Un ID como `npc/head_male_heavy/front/idle_0` debe ser único entre todos los sprites del
repositorio, aunque estén en archivos distintos. Consulta las [reglas de IDs](01-inicio-y-repositorio.md#rutas-e-identificadores).

## `sprite list`: listar sprites de un archivo

```text
assets-pipeline sprite list <archivo>
```

```sh
assets-pipeline sprite list entities/humans_parts.aseprite
```

Devuelve un arreglo JSON con `path`, `id` y `sprite` para cada definición de ese archivo. Si
todavía no tiene definiciones, devuelve `[]`. El argumento es una ruta de origen relativa al
repositorio, no un ID.

## `sprite show`: consultar por ID

```text
assets-pipeline sprite show <id>
```

```sh
assets-pipeline sprite show npc/head_male_heavy/front/idle_0
```

Devuelve un objeto JSON con archivo de origen (`path`), `id` y definición (`sprite`), incluida
la región y el pivot. Si no existe, informa `NOT_FOUND`.

## `sprite add`: definir una región

```text
assets-pipeline sprite add <archivo> --id <id> --rect <x,y,width,height> --pivot <x,y>
```

```sh
assets-pipeline sprite add entities/humans_parts.aseprite --id npc/head_male_heavy/front/idle_0 --rect '64,0,32,32' --pivot '0.5,1.0'
```

Las tres opciones son obligatorias. El archivo debe existir y ser PNG o Aseprite con cabecera
válida. Se rechaza un ID ya usado por otro sprite, un pivot fuera de `[0,1]` o un rectángulo
que sobresalga del lienzo. La primera definición crea la entrada del archivo en `sources`.

## `sprite set`: cambiar región, pivot o ambos

```text
assets-pipeline sprite set <id> [--rect <x,y,width,height>] [--pivot <x,y>]
```

```sh
assets-pipeline sprite set npc/head_male_heavy/front/idle_0 --rect '96,0,32,32'
assets-pipeline sprite set npc/head_male_heavy/front/idle_0 --pivot '0.5,0.9'
assets-pipeline sprite set npc/head_male_heavy/front/idle_0 --rect '64,0,32,32' --pivot '0.5,1.0'
```

Al menos una opción debe estar presente. La región resultante se vuelve a comprobar contra las
dimensiones actuales del archivo. La opción no indicada conserva su valor anterior. El comando
no cambia el ID ni el archivo de origen.

## `sprite rename`: cambiar ID

```text
assets-pipeline sprite rename <id-actual> <id-nuevo>
```

```sh
assets-pipeline sprite rename npc/head_male_heavy/front/idle_0 npc/head_male_heavy/front/stand_0
```

El nuevo ID debe ser válido y no estar ocupado por otro sprite. Se actualizan automáticamente
los frames de animaciones del **mismo archivo** que referencian el ID anterior. No se renombran
archivos físicos ni IDs de animación.

## `sprite duplicate`: copiar una definición

```text
assets-pipeline sprite duplicate <id-origen> --id <id-nuevo>
```

```sh
assets-pipeline sprite duplicate npc/head_male_heavy/front/idle_0 --id npc/head_male_heavy/front/idle_1
```

Copia región y pivot al **mismo archivo de origen** bajo un ID nuevo y libre. No copia píxeles,
no crea un nuevo `.png`/`.aseprite` y no añade frames a ninguna animación.

## `sprite rm`: eliminar definición

```text
assets-pipeline sprite rm <id> [--yes]
```

```sh
assets-pipeline sprite rm npc/head_male_heavy/front/idle_0
assets-pipeline sprite rm npc/head_male_heavy/front/idle_0 --yes
```

Pide confirmación interactiva; usa `--yes` en scripts. No borra el archivo de imagen. Si un
frame usa el sprite, falla con `IN_USE`: cambia o elimina primero esos frames. Tampoco permite
quitar el último sprite mientras el archivo conserve animaciones. Al quitar el último sprite sin
animaciones, se elimina de `db.json` la entrada completa de ese archivo y volverá a figurar
como `undefined` en `ls`.

## Ejemplo mínimo con tres sprites

Suponiendo un archivo `3-sprites.aseprite` cuyo lienzo contiene esas tres regiones:

```sh
assets-pipeline sprite add 3-sprites.aseprite --id demo/sprite_0 --rect '3,3,15,15' --pivot '0.5,1.0'
assets-pipeline sprite add 3-sprites.aseprite --id demo/sprite_1 --rect '22,3,11,15' --pivot '0.5,1.0'
assets-pipeline sprite add 3-sprites.aseprite --id demo/sprite_2 --rect '36,2,12,16' --pivot '0.5,1.0'
assets-pipeline sprite list 3-sprites.aseprite
assets-pipeline validate 3-sprites.aseprite
```

Los rectángulos del ejemplo corresponden solo al archivo de prueba del repositorio; para otro
archivo debes medir sus regiones reales.
