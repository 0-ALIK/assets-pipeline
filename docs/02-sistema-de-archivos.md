# Sistema de archivos (`fs`)

[Volver al índice](README.md) · [Rutas y repositorios](01-inicio-y-repositorio.md#rutas-e-identificadores)

Los comandos `fs` mantienen sincronizadas las rutas físicas con las claves de `sources` en
`.assets-pipeline-cache/db.json`. Todas las rutas siguientes son relativas a la raíz del
repositorio y se escriben con `/`. Puedes ejecutarlos desde cualquier subcarpeta de esa raíz o
seleccionarla antes del grupo: `assets-pipeline --repo ./game-assets fs ...`.

`fs move`, `fs rename` y `fs rm` muestran el plan, piden confirmación en una terminal interactiva
y aceptan `--yes` para scripts. En una entrada no interactiva, sin `--yes`, fallan sin ejecutar el
cambio. `--yes` confirma, pero **no** evita comprobaciones de integridad. `--dry-run` muestra el
plan sin cambiar archivos ni `db.json` y no pide confirmación. `fs mkdir` no es destructivo y no
lleva esas opciones.

## `fs mkdir`: crear carpeta

```text
assets-pipeline fs mkdir <ruta>
```

```sh
assets-pipeline fs mkdir entities/humans
```

Crea la carpeta y los padres que falten. Si la ruta ya existe, informa `ALREADY_EXISTS`. No
añade entradas a `sources`: solo un sprite definido convierte un archivo en `defined`.

## `fs rename`: cambiar nombre dentro de la misma carpeta

```text
assets-pipeline fs rename <ruta-actual> <nombre-nuevo> [--dry-run] [--yes]
```

```sh
assets-pipeline fs rename entities/player.aseprite hero.aseprite --dry-run
assets-pipeline fs rename entities/player.aseprite hero.aseprite
assets-pipeline fs rename entities/player.aseprite hero.aseprite --yes
```

`<nombre-nuevo>` es **solo el nombre final**, sin carpetas ni separadores. El resultado del
ejemplo es `entities/hero.aseprite`. Funciona tanto para archivos compatibles como para
carpetas. Si el archivo tiene definiciones, se actualiza su clave de origen; si se renombra una
carpeta, se actualizan todas las claves de origen bajo ella. Para un archivo, la extensión debe
mantener el mismo formato (por ejemplo, `.aseprite` no puede pasar a `.png`). No sobrescribe
una ruta existente.

## `fs move`: mover archivo o carpeta

```text
assets-pipeline fs move <ruta-actual> <ruta-destino> [--dry-run] [--yes]
```

```sh
# Archivo; el destino incluye su nombre final.
assets-pipeline fs move entities/player.aseprite entities/humans/player.aseprite

# Carpeta completa, con todos sus contenidos.
assets-pipeline fs move entities/humans entities/npcs/humans

# Vista previa, útil antes de cambios amplios.
assets-pipeline fs move entities/humans entities/npcs/humans --dry-run

# Confirmación explícita para un script.
assets-pipeline fs move entities/humans entities/npcs/humans --yes
```

El destino es una ruta completa **dentro del mismo repositorio**, no solo una carpeta a la que
«meter» el origen. Los padres del destino que no existan se crean y aparecen en el plan. El
plan lista las definiciones cuyas claves cambiarán y los archivos afectados que no tienen
definiciones. Mover una carpeta incluye también archivos de otras extensiones. No se puede
sobrescribir el destino, mover una carpeta dentro de sí misma ni cambiar de formato un archivo.

La operación cambia el sistema de archivos y `db.json`; si falla la escritura de metadata, la
CLI intenta devolver la ruta a su origen. Si la reversión también falla, informa
`INVALID_REPOSITORY` y pide revisar manualmente archivo y base de datos.

## `fs rm`: eliminar

```text
assets-pipeline fs rm <ruta> [--recursive] [--dry-run] [--yes]
```

```sh
# Ver primero qué se eliminaría.
assets-pipeline fs rm entities/humans --dry-run

# Archivo compatible.
assets-pipeline fs rm entities/player.aseprite

# Carpeta vacía.
assets-pipeline fs rm entities/humans --yes

# Carpeta no vacía: hacen falta --recursive y confirmación.
assets-pipeline fs rm entities/humans --recursive --yes
```

`--recursive` permite eliminar una carpeta **no vacía**; no sustituye a `--yes` en scripts.
`--dry-run` puede usarse para archivos o carpetas y no borra nada. El plan muestra qué
definiciones desaparecerán y qué archivos sin definiciones se incluyen. Al eliminar una carpeta
se elimina **todo su contenido**, incluso archivos de otras extensiones; al eliminar directamente
un archivo, solo se admiten `.png` y `.aseprite`. La CLI retira las definiciones asociadas.

La eliminación se prepara temporalmente dentro de `.assets-pipeline-cache/trash` para poder
revertir un error al escribir `db.json`, pero, una vez completada, los archivos se **borran**:
no es una papelera recuperable. Conserva copias de seguridad antes de operaciones amplias.

## Reglas y límites comunes

- `.assets-pipeline-cache` está reservada y no se puede administrar con `fs`.
- Se rechazan rutas absolutas, rutas que salgan del repositorio y el recorrido de enlaces
  simbólicos. Respeta las mayúsculas exactas de cada segmento.
- No hay comando para copiar, crear archivos fuente ni editar los píxeles. `fs` tampoco admite
  mover o borrar directamente un archivo de extensión no compatible.
- `--dry-run` es una fotografía del estado actual, no una reserva: antes de la operación real la
  CLI vuelve a comprobar rutas y metadata.

Si un archivo cambia de ubicación **por fuera** de la herramienta, su definición conserva la
ruta anterior y `ls` puede mostrarla como `missing`. Para mantener las referencias correctas,
usa `fs move`/`fs rename` o restaura el archivo a la ruta registrada.
