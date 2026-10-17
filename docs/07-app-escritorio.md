# La app de escritorio

[Volver al índice](README.md) · [Inicio y repositorio](01-inicio-y-repositorio.md)

La app de escritorio (React + Tauri) administra el mismo repositorio que la CLI. No hay dos
formatos: ambos leen y escriben `.assets-pipeline-cache/db.json` con el mismo esquema v4, las
mismas reglas y el mismo archivo de bloqueo, así que puedes alternar entre herramienta y app sin
perder nada.

## Requisitos y ejecución

La app necesita Rust y los requisitos de Tauri para tu plataforma, además de Node y pnpm. Asegúrate
de que `cargo` está en el `PATH` (`cargo --version` debe responder; rustup lo deja en
`%USERPROFILE%\.cargo\bin` en Windows y `~/.cargo/bin` en Linux/macOS).

```sh
# Desarrollo (Vite + ventana nativa)
pnpm --filter @assets-pipeline/desktop tauri dev

# Binario de producción
pnpm --filter @assets-pipeline/desktop tauri build

# Solo la interfaz en el navegador: las funciones de repositorio quedan deshabilitadas
pnpm --filter @assets-pipeline/desktop dev
```

## Pantalla principal (launcher)

- Lista los **proyectos recientes** guardados en el equipo, con la fecha de última apertura.
- **Crear proyecto** pide nombre y una carpeta existente. Hace las mismas comprobaciones que
  `assets-pipeline init`: la carpeta debe existir, no puede ser un enlace simbólico y no puede
  estar dentro de otro repositorio.
- **Abrir carpeta** busca `db.json` hacia arriba; si eliges una subcarpeta, abre la raíz del
  repositorio y lo avisa.
- Un proyecto reciente cuya carpeta ya no existe se marca como **no encontrado** y se puede
  quitar de la lista.

## Pantalla de proyecto

### Explorador (panel izquierdo)

Muestra todo el filesystem del repositorio. Los archivos con definiciones en `db.json` llevan un
punto verde y contadores de sprites y animaciones; los archivos que siguen en `db.json` pero ya no
existen llevan un aviso. La carpeta interna y las carpetas de build generadas no se recorren.

El menú de cada entrada (tres puntos) ofrece:

- **Nueva carpeta aquí** (solo carpetas).
- **Renombrar**, **Mover a…** y **Eliminar** para carpetas y para archivos `.png`/`.aseprite`.

Mover, renombrar y eliminar muestran primero el **plan de cambios** (definiciones afectadas,
archivos sin definiciones y carpetas padre que se crearán) y piden confirmación. Todo se ejecuta a
través de los mismos casos de uso que la CLI, con las mismas validaciones y reversión si algo falla.

### Board (canvas pixel perfect)

Al seleccionar un PNG o Aseprite se muestra la imagen en un canvas con zoom entero (1×–32×),
ajuste automático, paneo con rueda, espacio o botón central. Los archivos `.aseprite` se
renderizan desde su primer frame con todas las capas visibles.

- **Sprites**: la lista del panel derecho resalta cada región al pasar el mouse. Al seleccionar un
  sprite puedes arrastrarlo, redimensionarlo con las esquinas, arrastrar su pivote y ajustar
  `id`, `x`, `y`, ancho, alto y pivote con el formulario. Las flechas del teclado ajustan 1 píxel
  (con Shift, 8). Cada gesto se guarda al soltar el mouse.
- **Nuevo sprite**: desde el formulario o dibujando la región directamente sobre el canvas.
- **Duplicar** y **eliminar** sprites (eliminar exige confirmación y falla si una animación lo
  usa, igual que en la CLI).

### Animaciones

Debajo de los sprites aparece la lista de animaciones del archivo. **Nueva** abre un editor para
elegir sprites, orden y duración de cada frame y el modo `loop`/`once`. Al hacer clic en una
animación, el canvas cambia al **reproductor**: dibuja cada frame anclando su pivote en el mismo
punto, de modo que se ven de inmediato los saltos o desalineaciones.

El reproductor también es un **editor de frames**:

- cada frame muestra su índice, su sprite, su duración editable (en milisegundos) y botones para
  moverlo a izquierda/derecha, duplicarlo o eliminarlo (con confirmación; una animación no puede
  quedarse sin frames);
- **+ Frame** añade al final y el botón **+** de cada frame inserta uno antes, eligiendo el sprite
  en un selector con la duración indicada;
- en la cabecera puedes **renombrar** la animación (lápiz) y cambiar `loop`/`once` en cualquier
  momento.

### Pestaña Atlas

La cabecera del proyecto cambia entre **Espacio de trabajo** (explorador, canvas y animaciones) y
**Atlas**. La vista de atlas muestra:

- la configuración de cada atlas (nombre, tamaño de página, `gap`) con edición inline, creación y
  eliminación con confirmación;
- los **grupos derivados** (primer segmento de cada ID) con su número de sprites y un selector para
  asignarlos a un atlas o dejarlos sin asignar; los grupos sin atlas se destacan en ámbar, y los
  grupos asignados que ya no existen se marcan como obsoletos;
- una **comprobación** que ejecuta el mismo planificador del build y muestra las páginas que se
  generarían (o el motivo exacto que impediría construir: grupo sin atlas, sprite que no cabe,
  animación repartida entre atlas…).

### Generar atlas desde la app

El botón **Generar** de la cabecera abre el diálogo de build, disponible desde ambas pestañas:

- resumen previo del plan (páginas, sprites, animaciones) o el error que lo bloquea;
- carpeta de salida editable (por defecto `dist/assets`, como la CLI);
- al construir se escriben las páginas PNG, el JSON de cada página y `index.json`, con las mismas
  reglas que `assets-pipeline build`: la salida debe ser una subcarpeta real del repositorio, se
  rechaza reemplazar una carpeta sin la marca `.assets-pipeline-build` y la publicación es atómica
  (carpeta temporal y respaldo). Al terminar se listan los archivos y puedes abrir la carpeta.

La disposición y la metadata son **idénticas** a las de la CLI porque ambas usan el plan de Core;
la diferencia es que la app compone los `.aseprite` con `asefile` y respeta **todos** los modos de
mezcla, mientras el build de la CLI rechaza los distintos de «normal».

### Cabecera del proyecto

- **Generar**: abre el diálogo de build (ver arriba).
- **Recargar**: vuelve a leer `db.json` y el listado (también se refresca automáticamente al
  recuperar el foco de la ventana, útil si la CLI modificó el repositorio).
- **Validar**: ejecuta la misma validación que `assets-pipeline validate` y lista los problemas.
- **Carpeta**: abre la raíz del repositorio en el explorador del sistema.

## Diseño de la interfaz (pixel art)

La interfaz usa un design system pixel art sobre **Tailwind CSS 4** y componentes de
[Pixelact UI](https://pixelactui.com) (registry de shadcn/ui, MIT) copiados en
`src/components/ui/pixelact-ui/`; los archivos base de shadcn viven en `src/components/ui/` y se
configuran con `components.json` y `src/lib/utils.ts`.

- **Fuentes** (vendoreadas con `@fontsource`, sin red en ejecución):
  `Press Start 2P` para títulos, botones y badges; `Pixelify Sans` para texto y formularios;
  `VT323` para IDs, rutas y datos monoespaciados.
- **Iconos**: [pixelarticons](https://pixelarticons.com) (MIT) renderizados a 24×24 — múltiplo de la
  rejilla de 24 para que los píxeles queden cuadrados — usando import por icono.
- **Tokens**: paleta verde existente (`#9bd79c` sobre `#151719`), sin radios de esquina, bordes de
  2px y sombras duras de 4px (`--pixel-box-shadow`). Los botones de Pixelact aportan su borde
  interno y el desplazamiento al pulsar.
- El registry original importa la fuente desde Google Fonts en runtime; en este repo esa línea se
  sustituyó por `@fontsource` para que la app funcione offline dentro de Tauri.

Para añadir un componente nuevo: `npx shadcn@latest add https://pixelactui.com/r/<nombre>.json`
dentro de `apps/desktop` (si la web limita peticiones, el mismo archivo está en el
[repo del proyecto](https://github.com/pixelact-ui/pixelact-ui)).

## Abrir la app desde la CLI

```sh
# Dentro de un repositorio: abre la app en ese proyecto.
assets-pipeline

# Igual, pero explícito, y con opción de ver la URL sin lanzar nada.
assets-pipeline open
assets-pipeline --repo ./game-assets open
assets-pipeline open --print
```

La CLI lanza el enlace `assets-pipeline://open?repo=<carpeta>`; la app registra ese esquema al
arrancar (en Windows y Linux también en desarrollo) y, si ya está abierta, la **instancia única**
recibe la petición, abre el proyecto y trae la ventana al frente. Si la app no está registrada
todavía, `open` lo indica: basta con abrirla una vez o instalar el binario.

En desarrollo también puedes pasar el repositorio directamente al ejecutable:

```sh
pnpm --filter @assets-pipeline/desktop tauri dev -- --repo ./game-assets
```

### Desarrollo vs producción (Windows y Linux)

El registro del esquema apunta al **último ejecutable que arrancó**, así que conviene entender los
dos flujos:

- **Desarrollo** (`tauri dev`): el binario de `target/debug` carga la interfaz desde el servidor de
  Vite (`http://localhost:5173`). Mientras `tauri dev` siga corriendo, `assets-pipeline` abre la app
  de desarrollo con normalidad. Si ejecutas ese binario debug **sin** el servidor, la ventana
  muestra `ERR_CONNECTION_REFUSED` aunque la CLI haya lanzado el enlace correctamente.
- **Producción** (`tauri build` + instalador): el ejecutable instalado lleva el frontend embebido y
  no necesita servidor. Instalar el bundle re-registra `assets-pipeline://` apuntando a ese
  ejecutable; además, cada arranque de la app vuelve a registrar el esquema por si cambió de sitio.

El primer `tauri build` descarga NSIS y WiX (requiere red) y tarda varios minutos. Los artefactos
quedan en `apps/desktop/src-tauri/target/release/bundle/nsis/` y `.../msi/`.

## Modelo compartido y bloqueos

- La metadata es siempre `.assets-pipeline-cache/db.json`; conserva ese archivo junto a tus assets.
- Toda operación de escritura de la app usa el mismo lock que la CLI. Si el repositorio está
  ocupado verás el error `IN_USE`, igual que en la terminal.
- Los cambios se publican de forma atómica: si una escritura falla, el estado anterior se mantiene.

## Alcance actual de la app

- Los Aseprite se muestran y validan por su **primer frame**; no hay selector de frames ni edición
  de capas.
- El build de la app no admite todavía `--clean` explícito (siempre reconstruye por completo,
  como la CLI actual) ni reporta progreso por página.
- No hay deshacer/rehacer en el editor de sprites ni en las operaciones de archivos.
- Los enlaces simbólicos se listan pero no se administran, igual que en la CLI.
