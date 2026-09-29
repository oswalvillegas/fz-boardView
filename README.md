# FZ BoardView

<img src="https://www.youtube.com/watch?v=Q9v26KJvNIo">

Visor de placas de circuitos impresos (PCB) para archivos **.fz** de las placas de
ASUS / FlexBV, además de formatos abiertos derivados.

Carga el archivo, dibuja la placa en un canvas, y permite navegar por **componentes**,
**pines**, **redes (nets)** y **vías**, con panel de información, inspector de conexiones
y colores por red. Funciona como página web local y como aplicación de escritorio
(Electron).

![Electron + servidor Node.js local](https://img.shields.io/badge/stack-Node.js%20%2B%20Canvas-Electron-2f814f)
![Formato principal](https://img.shields.io/badge/formato-.fz%20%7C%20.tvw%20%7C%20.cad-ff5722)

---

## Qué hace

- **Abre archivos de placa** `.fz`, `.tvw`, `.brd`, `.bdv`, `.cad` (arrastrando, con el
  botón *Abrir* o desde la lista de archivos del servidor).
- **Renderiza la placa** con zoom, desplazamiento, ajuste a la ventana y rotación de 90°.
- **Filtra por lado** ( superior / inferior) y puede **voltear** la vista.
- **Colorea por red**: cada red (net) con un color calculado de forma estable a partir de
  su nombre, para seguir el rastro de una señal a simple vista.
- **Muestra u oculta clavos** (vías de transición).
- **Etiquetas de pin configurables**: por índice de red, por nombre de red o por número de pin.
- **Inspecciona piezas**: tipo, lado, número de pines, tamaño en mils, descripción / *part number*,
  cantidad y la lista de redes a las que conecta.
- **Inspecciona conexiones**: al seleccionar un pin, la pestaña *Conexión* lista todos los
  pines de esa red (referencia, pin, nombre, lado) y permite saltar a cualquiera con un clic.
- **Detecta los pines de masa (GND)**: los pines sin red o con una única conexión se marcan como
  negativo / tierra.
- **Buscador** por refdes o red, con coincidencia anterior/siguiente y contador.
- **Panel lateral redimensionable** y **ocultable**, con tres pestañas: *Placa*, *Parte*, *Conexión*.
- **Barra de estado** con zoom, centro de vista y red marcada, en unidades mils.
- **Multi-idioma**: español, inglés, francés y chino.
- **Tema oscuro** con colores por lado de la placa.
- **Lista de archivos recientes** (los 30 últimos), persistida en `recent.json`.

## Requisitos

| Requisito | Versión |
| --------- | ------- |
| Windows   | 10 o superior |
| Node.js   | 18 LTS o superior (probado con v24) |

No hay dependencias de red más allá de `npm install`: el visor usa solo módulos nativos de
Node (`http`, `fs`, `zlib`) y un `<canvas>` en el navegador. El runtime es 100 % local,
no envía nada a internet.

## Instalación

Opción recomendada — doble clic en:

```text
instalar.bat
```

Comprueba que Node.js esté instalado y ejecuta `npm install`.

## Ejecución

Doble clic en:

```text
ejecutar.bat
```

El script ofrece dos modos:

1. **Navegador** — levanta el servidor y abre <http://localhost:9000>. Es el modo más
   cómodo para desarrollo: recargas la página con `Ctrl+R` tras cada cambio.
2. **App Electron** — abre la misma interfaz en una ventana de escritorio con su propio icono.

Para detener el programa, cierra la ventana o pulsa `Ctrl+C` en la consola.

### Manualmente

```bash
npm install        # instalar dependencias
npm start          # servidor web  -> http://localhost:9000
npm run app        # ventana de Electron
node server.js --board-root "C:\placas"   # buscar placas en otra carpeta
```

### Scripts disponibles

| Script                  | Qué hace                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm start`             | Servidor web local en el puerto 9000.                                     |
| `npm run app`           | Abre la interfaz en una ventana de Electron.                              |
| `npm run build:sea`     | Empaqueta en un único `.exe` usando *Single Executable App* de Node.       |
| `npm run build:app`     | Genera la aplicación de Windows con `electron-packager` e icono propio.    |
| `npm run build:app:linux` | Lo mismo para Linux.                                                    |
| `npm run build:app:all` | Windows + Linux en una sola pasada.                                       |

---

## Atajos de teclado

| Tecla | Acción                          |
| ----- | ------------------------------- |
| `O`   | Abrir archivo                   |
| `F`   | Ajustar la placa a la ventana   |
| `+` / `-` | Zoom alrededor del centro |
| `S`   | Cambiar de lado (arriba/abajo)  |
| `R`   | Voltear la vista                |
| `N`   | Mostrar / ocultar clavos        |
| `X`   | Colorear por red                |
| `I`   | Cambiar etiqueta de pin         |
| `C`   | Limpiar selección y búsqueda    |
| `Esc` | Limpiar selección y búsqueda    |

Ratón: rueda para zoom, arrastre para desplazar, clic para seleccionar,
doble clic para ampliar sobre el punto, clic derecho para deseleccionar.

---

## Configuración

| Variable / argumento | Default                        | Descripción                                     |
| -------------------- | ------------------------------ | ----------------------------------------------- |
| `PORT`               | `9000`                         | Puerto del servidor.                            |
| `BOARD_ROOT`         | carpeta padre del proyecto      | Dónde se buscan los archivos de placa.          |
| `--board-root <dir>` | —                              | Alternativa por línea de comandos.               |

Archivos que genera el programa:

- `recent.json` — historial de placas abiertas (máx. 30).
- `uploads/` — archivos arrastrados que no existen en `BOARD_ROOT`.

## API HTTP

El servidor es una API mínima sin dependencias; el front-end la consume tal cual.

| Método | Ruta              | Descripción                                                      |
| ------ | ----------------- | ---------------------------------------------------------------- |
| `GET`  | `/api/list`       | Lista recursiva de placas (`.fz`, `.brd`, `.bdv`, `.tvw`, `.cad`). |
| `GET`  | `/api/load?path=` | Carga una placa por ruta absoluta en disco.                      |
| `POST` | `/api/load-bytes` | Carga una placa desde bytes subidos (`name=` = nombre sugerido).  |
| `GET`  | `/api/recent`     | Devuelve el historial de archivos recientes.                     |

Ejemplo:

```bash
curl "http://localhost:9000/api/list"
curl "http://localhost:9000/api/load?path=C:/placas/board.fz"
```

## Cómo funciona

```
┌───────────┐   HTTP    ┌──────────────────┐   JSON    ┌────────────────────┐
│  public/  │ ────────► │  server.js       │ ────────► │  canvas + panel    │
│  app.js   │           │  + lib/fz.js     │           │  (visualizador)    │
└───────────┘           └──────────────────┘           └────────────────────┘
```

1. **`server.js`** — servidor HTTP sin framework: sirve `public/`, expone la API y devuelve
   la placa ya parseada en JSON.
2. **`lib/fz.js`** — el parser. Según la firma del archivo:
   - Si empieza por `$` (0x24) es un **`.cad`** de texto.
   - Si el texto contiene `BRDOUT:` es un **`.brd`** plano.
   - Si el archivo viene comprimido con zlib se descomprime directamente; si no, se
     **descifra con RC6** (clave embebida en `FZ_KEY`, validada con paridad) y luego se
     descomprime con zlib en dos bloques: *contenido* (componentes, pines, redes, vías) y
     *descrripción* (nombre de pieza, parte, cantidad...).
   - Los **`.tvw`** tienen su propio lector, que localiza pads, partes y redes por
     estructura binaria en vez de por texto.
3. **`public/app.js`** — renderizador en canvas 2D: cachea las capas, dibuja piezas, pines,
   vías y etiquetas, y gestiona selección, búsqueda, zoom y rotación.

## Estructura del proyecto

```
web/
├── instalar.bat            <- instalador para probar el programa
├── ejecutar.bat            <- lanzador (navegador o Electron)
├── main.cjs                <- ventana de Electron
├── server.js               <- servidor HTTP + API
├── lib/fz.js               <- parser de .fz / .tvw / .brd / .cad
├── public/
│   ├── index.html          <- estructura de la interfaz
│   ├── app.js              <- visor en canvas, panel, búsqueda, i18n
│   └── style.css           <- tema oscuro
├── tools/
│   ├── embed-public.js     <- incrusta public/ en embedded-assets.js
│   ├── apply-icon.js       <- aplica icono.ico al ejecutable
│   └── debug-tvw.js        <- volca el contenido de un .tvw (depuración)
├── recent.json             <- historial
└── package.json
```

## Cómo modificarlo

- **Cambiar el aspecto:** `public/style.css` (variables de color al principio).
- **Añadir o quitar botones:** `public/index.html` + `public/app.js` (sección *controls*).
- **Añadir un idioma:** objeto `I18N` en `public/app.js` y una opción en `lang-select`.
- **Soportar otro formato:** añade un cargador en `lib/fz.js` y expónlo en
  `module.exports`; `server.js` lo elegirá por extensión.
- **Cambiar la API:** todo está en `server.js`, sin frameworks de por medio.
- **Recargar:** `Ctrl+R` en el navegador; si empaquetaste con Electron, vuelve a ejecutar
  `ejecutar.bat` (no usa caché en modo desarrollo).

## Notas

- Herramienta orientada a pruebas, inspección y adaptación propia; el formato `.fz`
  pertenece a FlexBV/ASUS, así que úsala únicamente con archivos que tengas derecho a abrir.
- Los archivos `.fz` están cifrados con RC6: si la clave embebida deja de coincidir
  (algunos modelos cambian la clave), el parser avisa con `invalid FZ key`.
- No se envía telemetría ni se requiere conexión a internet una vez instalado.
