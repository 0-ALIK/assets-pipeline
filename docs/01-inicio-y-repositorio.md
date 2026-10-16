# Instalación, ejecución y repositorios

[Volver al índice](README.md)

## Requisitos y formas de ejecución

El workspace declara Node.js **22.12 o superior** y pnpm **11 o superior**; fija
`pnpm@11.25.0` en el `package.json` raíz. Desde la raíz del proyecto:

```sh
pnpm install
pnpm --filter @assets-pipeline/cli build
pnpm cli version
```

`pnpm cli` ejecuta el script de desarrollo del workspace: recompila Core y ejecuta la fuente de
la CLI con `tsx`. También puedes usar `pnpm --filter @assets-pipeline/cli start` o ejecutar el
compilado con `node apps/cli/dist/index.js`.

El paquete CLI ya declara el ejecutable `assets-pipeline`. Para **enlazar este checkout** como
comando global en la máquina de desarrollo, primero compila y después, desde `apps/cli`, ejecuta
`npm link`:

```sh
pnpm --filter @assets-pipeline/cli build
cd apps/cli
npm link
assets-pipeline version
```

El enlace global apunta a esta carpeta, no es un paquete independiente publicado. Después de
cambiar TypeScript, vuelve a compilar. No muevas ni elimines el checkout mientras dependas del
enlace. `private: true` y la dependencia `@assets-pipeline/core: workspace:*` significan que la
publicación/instalación desde un registro requiere un proceso de distribución separado. En pnpm
11 no se usa `pnpm link --global`.

Los ejemplos restantes asumen que `assets-pipeline` está disponible. Si no has creado el enlace,
desde la raíz puedes sustituirlo por `pnpm cli`; conserva los argumentos que siguen.

## Ayuda y versión

```sh
assets-pipeline --help
assets-pipeline help sprite
assets-pipeline sprite add --help
assets-pipeline version
```

`version` muestra la versión del paquete CLI y no necesita repositorio. **No existe** la opción
`--version`: usa el subcomando `version`.

## Selección del repositorio

Para `info`, `status`, `ls`, `validate`, `fs`, `sprite` y `animation`, la CLI busca
`.assets-pipeline-cache/db.json` en el directorio actual y luego en sus padres. Por ejemplo,
si estás dentro de `game-assets/entities`, opera sobre `game-assets`.

También puedes elegir explícitamente una raíz existente con la opción global `--repo`, colocada
antes del subcomando:

```sh
assets-pipeline --repo ./game-assets info
assets-pipeline --repo ./game-assets sprite list entities/humans_parts.aseprite
```

`--repo` recibe una **ruta de carpeta del sistema** (relativa al directorio actual o absoluta) y
debe apuntar a la raíz exacta del repositorio; apuntar a una subcarpeta se rechaza. No se usa
para `init`: ese comando recibe su propia opción `--path`.

## `init`: inicializar

```text
assets-pipeline init <nombre> [--path <carpeta>]
```

```sh
# La carpeta actual ya existe.
assets-pipeline init "My RPG Assets"

# La carpeta game-assets ya existe.
assets-pipeline init "My RPG Assets" --path ./game-assets
```

`<nombre>` es obligatorio y no puede estar vacío o contener solo espacios. `--path` usa la
carpeta actual si se omite. La carpeta debe existir y ser un directorio real, no un enlace
simbólico; `init` no la crea. Se rechaza inicializar de nuevo una raíz existente o una carpeta
anidada dentro de otro repositorio. El comando crea `.assets-pipeline-cache/db.json`, asigna un
UUID al proyecto y guarda nombre, fechas y versión del esquema.

## `info`: información del proyecto

```sh
assets-pipeline info
assets-pipeline --repo ./game-assets info
```

Muestra nombre, ID, raíz absoluta, versión del esquema y número de **archivos con
definiciones**. Si el repositorio contiene datos heredados del esquema anterior, también indica
cuántos registros `legacy.assets` conserva.

## `status`: resumen

```sh
assets-pipeline status
```

Devuelve tres contadores: `defined`, `undefined` y `missing`. No suma los elementos `other`
(directorios, enlaces y archivos no compatibles). No es un estado Git ni compara marcas de
tiempo o hashes; informa sobre la relación entre los archivos actuales y `db.json`.

## `ls`: árbol y archivos sin definición

```sh
assets-pipeline ls
assets-pipeline ls --untracked
```

`ls` lista recursivamente los elementos del repositorio, uno por línea, con su estado:

| Estado      | Significado                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `defined`   | Archivo PNG o Aseprite presente con al menos un sprite en `db.json`. En una terminal TTY se colorea de azul, salvo que esté definido `NO_COLOR`. |
| `undefined` | Archivo `.png` o `.aseprite` presente sin sprites definidos.                                                                                     |
| `missing`   | Ruta que sigue en `db.json`, pero cuyo archivo ya no aparece en el repositorio.                                                                  |
| `other`     | Directorio, enlace simbólico o archivo de otra extensión.                                                                                        |

La comparación de extensiones no distingue mayúsculas. `ls --untracked` muestra **solo** los
archivos `undefined`; no incluye `missing` ni archivos arbitrarios. La carpeta interna
`.assets-pipeline-cache` se oculta de la lista. Una línea de ejemplo es
`defined   entities/humans_parts.aseprite`.

## Rutas e identificadores

Las rutas pasadas a `fs`, `sprite`, `animation` y `validate` son relativas a la **raíz del
repositorio** y usan `/`, incluso en Windows. Usa exactamente las mayúsculas del sistema de
archivos. No se admiten rutas absolutas, `\`, `:`, segmentos vacíos, `.` ni `..`; tampoco se
permite gestionar `.assets-pipeline-cache` ni atravesar enlaces simbólicos. Para `--repo` y
`init --path`, en cambio, se usan rutas normales del sistema operativo.

Los IDs de sprites y animaciones también usan segmentos separados por `/`, por ejemplo
`npc/head/front/idle_0`. Cada segmento admite letras Unicode, dígitos, `_`, `.` y `-`, pero no
puede ser `.` ni `..`. Se rechazan segmentos especiales como `constructor`, `prototype` y
`__proto__`. Los IDs de sprites son únicos entre sprites de todo el repositorio; los de
animaciones son únicos entre animaciones. Un mismo texto puede existir como ID de un sprite y de
una animación porque son tipos distintos.

Solo `.png` y `.aseprite` son formatos de origen compatibles. Un archivo de otro tipo puede
aparecer en `ls` y formar parte del contenido de una carpeta movida o eliminada, pero no se le
pueden definir sprites ni administrarlo directamente con `fs move`, `fs rename` o `fs rm`.

## Datos persistidos

La fuente de verdad de las definiciones es `.assets-pipeline-cache/db.json`; conserva este
archivo junto con los assets en tus copias de seguridad o control de versiones. El nombre
«cache» **no** implica que se pueda regenerar a partir de los PNG/Aseprite. No edites ni muevas
la carpeta interna con los comandos `fs`.

El esquema actual es `schemaVersion: 4`. Una versión reducida del archivo tiene esta forma:

```json
{
  "schemaVersion": 4,
  "project": {
    "id": "<uuid>",
    "name": "My RPG Assets",
    "createdAt": "<fecha ISO>",
    "updatedAt": "<fecha ISO>"
  },
  "sources": {
    "entities/humans_parts.aseprite": {
      "sprites": {
        "npc/head/front/idle_0": {
          "x": 64,
          "y": 0,
          "width": 32,
          "height": 32,
          "pivot": { "x": 0.5, "y": 1 }
        }
      },
      "animations": {
        "npc/head/front/idle": {
          "playback": "loop",
          "frames": [{ "sprite": "npc/head/front/idle_0", "durationMs": 120 }]
        }
      }
    }
  },
  "atlases": {
    "characters": {
      "size": 2048,
      "gap": 2,
      "groups": ["npc"]
    }
  }
}
```

No puede persistirse una entrada de `sources` sin sprites. Si se borra el último sprite de un
archivo y no hay animaciones, se elimina también esa entrada. Una animación siempre pertenece
a un archivo que ya tiene sprites. La duración se guarda como `durationMs`, aunque la opción de
CLI se llame `--duration`.

Al leer, la CLI valida el JSON y su esquema. Los repositorios v1, v2 y v3 se migran **en memoria**;
v2 recibe `atlases: {}`, v3 recibe `gap: 0` en cada atlas y los registros antiguos de v1
(`assets` y `operationHistory`) se preservan en `legacy`. Una operación de escritura persiste la
versión actual; una lectura por sí sola no reescribe el archivo.
