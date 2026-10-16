# Grupos, atlas y build

[Volver al índice](README.md) · [Sprites](03-sprites.md) · [Validación](05-validacion-y-automatizacion.md)

El build agrupa todos los sprites definidos, genera páginas PNG cuadradas y escribe metadata
regenerable:

- `index.json` cumple el contrato simple `ID de sprite → archivo de atlas`.
- Cada página PNG tiene un JSON del mismo nombre con las coordenadas finales, dimensiones y
  pivots de los sprites contenidos en esa página.

## Grupos derivados de los IDs

Los grupos no se crean manualmente. Un grupo es siempre el **primer segmento** de un ID de
sprite:

| ID                                 | Grupo         |
| ---------------------------------- | ------------- |
| `npc/head_male_heavy/front/idle_0` | `npc`         |
| `player/body/run_0`                | `player`      |
| `environment`                      | `environment` |

Renombrar un sprite puede cambiar su grupo. El grupo desaparece cuando ya no quedan sprites con
ese primer segmento. Las asignaciones de atlas que queden obsoletas se detectan mediante
`validate` y `build` para evitar generar una salida parcial silenciosamente.

### `group list`

```sh
assets-pipeline group list
```

Devuelve JSON con todos los grupos, ordenados por nombre, y los IDs de sprites de cada uno.

### `group show`

```sh
assets-pipeline group show npc
```

Muestra un grupo y sus sprites. Recibe solo el primer segmento, no un patrón como `npc/**`.

## Configurar atlas

Un atlas tiene un nombre de archivo base, un tamaño de página cuadrado, un `gap` y una lista de grupos.
El nombre admite letras, números, `_` y `-`, pero no rutas ni extensión. Los nombres no pueden
duplicarse aunque solo cambien mayúsculas. El tamaño es un entero entre 1 y 8192 y representa
tanto ancho como alto. El `gap` es un entero entre `0` y `size - 1`; representa píxeles
transparentes entre sprites y entre filas, no un margen exterior. Cada grupo puede pertenecer a
un solo atlas.

### Crear y consultar

```sh
assets-pipeline atlas add characters --size 2048
assets-pipeline atlas add interface --size 1024 --gap 2
assets-pipeline atlas list
assets-pipeline atlas show characters
```

`--gap` es opcional al crear y vale `0` por defecto. `atlas add` crea inicialmente un atlas sin
grupos. `atlas list` y `atlas show` producen JSON e incluyen `size`, `gap` y `groups`.
Un atlas vacío puede existir mientras se configura, pero `validate` y `build` lo rechazan.

### Cambiar el tamaño o el gap

```sh
assets-pipeline atlas set characters --size 4096
assets-pipeline atlas set characters --gap 4
assets-pipeline atlas set characters --size 2048 --gap 2
```

Debe indicarse al menos una de las dos opciones. El `gap` debe seguir siendo menor que el tamaño
resultante, incluso cuando solo se cambia `--size`.
El cambio se guarda aunque algún sprite ya no quepa; `validate` o `build` señalarán el ID y sus
dimensiones. Reducir el tamaño o aumentar el gap puede crear más páginas en el siguiente build.

### Asignar y quitar grupos

```sh
assets-pipeline atlas group add characters npc
assets-pipeline atlas group add characters player

assets-pipeline atlas group rm characters player
assets-pipeline atlas group rm characters player --yes
```

Solo se puede asignar un grupo que exista actualmente. Asignarlo de nuevo, incluso a otro atlas,
falla. Quitar un grupo pide confirmación y lo deja sin atlas; mientras existan sus sprites,
`validate` y `build` fallarán hasta que se reasigne.

### Eliminar un atlas

```sh
assets-pipeline atlas rm characters
assets-pipeline atlas rm characters --yes
```

Elimina su configuración y pide confirmación. No elimina sprites ni salidas ya generadas. Sus
grupos quedan sin asignación y deben incorporarse a otro atlas antes del próximo build válido.

## Construir

```sh
# Salida predeterminada: dist/assets dentro del repositorio.
assets-pipeline build

# Otra subcarpeta del mismo repositorio.
assets-pipeline build --output generated/game-assets

# Fuerza semántica de reconstrucción completa; actualmente todos los builds ya son completos.
assets-pipeline build --clean
```

La salida debe ser una subcarpeta real del repositorio, nunca la raíz, una ruta externa,
`.assets-pipeline-cache` ni una ruta que atraviese enlaces simbólicos. La CLI marca las carpetas
que genera y se niega a reemplazar una carpeta preexistente que no tenga esa marca. Publica la
nueva salida de forma conjunta para no mezclar páginas nuevas y antiguas.
Las carpetas marcadas como builds generados no se recorren como fuentes: sus PNG no aparecen
como `undefined` en `status` ni en `ls --untracked`.

Antes de leer píxeles, `build` exige:

- al menos un sprite y un atlas;
- todos los atlas con al menos un grupo existente;
- todos los grupos asignados exactamente una vez;
- todos los sprites dentro del tamaño de página asignado;
- todas las animaciones con al menos un frame;
- todos los frames de cada animación asignados al mismo atlas y capaces de caber juntos en una
  sola página;
- fuentes presentes, regiones vigentes y decodificables.

Los sprites se ordenan y empacan de forma determinista por filas. El `gap` configurado se aplica
solo entre sprites contiguos y entre filas; no se reserva en los bordes de la página. No se
escala, rota ni recorta transparencia. Si una página se llena, se abre otra automáticamente:
`characters_0.png`, `characters_1.png`, etc. Las páginas siempre conservan el tamaño cuadrado
configurado y las zonas libres son transparentes.

Los sprites enlazados por una animación se empaquetan como una unidad indivisible. Si varias
animaciones comparten sprites, forman un único conjunto conectado y todos sus frames quedan en
la misma página. El conjunto completo puede trasladarse a una página nueva, pero nunca dividirse.
Si no cabe ni siquiera en una página vacía, el build falla y enumera las animaciones implicadas;
no aumenta el tamaño ni descarta frames automáticamente.

Para PNG se decodifica la imagen RGBA. Para Aseprite se renderiza el primer frame; actualmente se
admiten documentos RGBA de 32 bits, capas visibles con mezcla normal y cels normales, comprimidos
o enlazados. Un tilemap, otro modo de mezcla o profundidad indexada/grayscale produce un error
explícito en vez de generar píxeles incorrectos.

## `index.json`

Contiene **todos los IDs de sprites** del repositorio, ordenados, cada uno asociado a la página
PNG en la que fue empacado:

```json
{
  "npc/head_male_heavy/front/idle_0": "sprite_atlas_0.png",
  "npc/head_male_heavy/front/idle_1": "sprite_atlas_0.png",
  "player/body/run_0": "characters_1.png"
}
```

Las animaciones no son regiones físicas y por eso no aparecen como claves de `index.json`.

## JSON de cada página

Cada página tiene un archivo homónimo: `sprite_atlas_0.png` se acompaña de
`sprite_atlas_0.json`. El JSON separa `sprites` y `animations`. Ningún sprite incluye una
propiedad `atlas`, porque el nombre del propio archivo ya identifica la página:

```json
{
  "sprites": {
    "npc/head_male_heavy/front/idle_0": {
      "x": 0,
      "y": 0,
      "width": 32,
      "height": 32,
      "pivot": { "x": 0.5, "y": 1 }
    },
    "npc/head_male_heavy/front/idle_1": {
      "x": 34,
      "y": 0,
      "width": 32,
      "height": 32,
      "pivot": { "x": 0.5, "y": 1 }
    }
  },
  "animations": {
    "npc/head_male_heavy/front/idle": {
      "playback": "loop",
      "frames": [
        { "sprite": "npc/head_male_heavy/front/idle_0", "durationMs": 120 },
        { "sprite": "npc/head_male_heavy/front/idle_1", "durationMs": 150 }
      ]
    }
  }
}
```

Las coordenadas son las de la página construida, no las coordenadas originales del archivo
fuente. Un JSON contiene únicamente los sprites de su PNG y las animaciones cuyos frames están
completamente en esa página. Los sprites repetidos en varios frames se almacenan una sola vez en
`sprites`. Las animaciones se copian como metadata regenerable; `db.json` sigue siendo la fuente
editable.
