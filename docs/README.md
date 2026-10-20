# Manual de la CLI de Assets Pipeline

Esta documentación describe **la CLI implementada actualmente**. Se centra en administrar un
repositorio local, definir regiones de sprites, componer animaciones, configurar atlas y generar
salidas para el motor. El comando `watch` no existe todavía.

## Por dónde empezar

1. [Instalación, ejecución y repositorios](01-inicio-y-repositorio.md): requisitos, comando global,
   `--repo`, `init`, `version`, `info`, `status`, `ls` y formato de `db.json`.
2. [Sistema de archivos](02-sistema-de-archivos.md): `fs mkdir`, `fs rename`, `fs move`, `fs rm`,
   previsualización y confirmaciones.
3. [Sprites](03-sprites.md): `sprite list`, `show`, `add`, `auto`, `set`, `rename`, `duplicate` y `rm`.
4. [Animaciones](04-animaciones.md): definición y todos los subcomandos de `animation frame`.
5. [Validación, scripts y errores](05-validacion-y-automatizacion.md): `validate`, límites de las
   comprobaciones, códigos de error y uso no interactivo.
6. [Grupos, atlas y build](06-atlas-y-build.md): grupos derivados, configuración, paginación,
   `gap`, `index.json` y el JSON de cada página.
7. [La app de escritorio](07-app-escritorio.md): launcher de proyectos, explorador de archivos,
   canvas pixel perfect, editor de sprites y reproductor de animaciones.

## Inventario de comandos

| Grupo       | Comandos disponibles                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| General     | `version`, `open`, `init`, `info`, `status`, `ls`, `validate`, `help`                                                     |
| Archivos    | `fs mkdir`, `fs rename`, `fs move`, `fs rm`                                                                               |
| Sprites     | `sprite list`, `sprite show`, `sprite add`, `sprite auto`, `sprite set`, `sprite rename`, `sprite duplicate`, `sprite rm` |
| Animaciones | `animation add`, `animation show`, `animation set`, `animation rename`, `animation rm`                                    |
| Frames      | `animation frame add`, `insert`, `set`, `move`, `rm`                                                                      |
| Grupos      | `group list`, `group show`                                                                                                |
| Atlas       | `atlas list`, `show`, `add`, `set`, `rm`, `atlas group add`, `atlas group rm`                                             |
| Build       | `build`, `build --output`, `build --clean`                                                                                |

En los ejemplos se usa `assets-pipeline`, el ejecutable declarado por el paquete CLI. Para
consultar la sintaxis instalada en tu equipo, usa `assets-pipeline --help` o añade `--help` a un
subcomando, por ejemplo `assets-pipeline animation frame insert --help`.

Todos los ejemplos de rutas de assets usan `/` y son relativos a la raíz del repositorio, no al
directorio de trabajo desde el que se invoca la CLI. Consulta [rutas e identificadores](01-inicio-y-repositorio.md#rutas-e-identificadores)
antes de usarlos en scripts.
