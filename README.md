# DockControl

Aplicación de escritorio para administrar **Docker** (contenedores, imágenes,
proyectos Compose, monitor de estadísticas, puertos y conexiones). Reescritura
moderna inspirada en DockStation, construida con **Tauri 2 + Rust** y
**React 19**.

![DockControl](show.png)

## Características

- **Contenedores**: lista con estado (verde en ejecución / gris detenido),
  acciones redondas (Web, Exec, Start/Stop, Restart, Remove, Info), consola de
  **logs** en vivo y **gráficas** de CPU, Memoria, IO de disco e IO de red.
- **Info**: árbol navegable con flechas a partir del `inspect` del contenedor.
- **Proyectos**: proyectos Compose (`docker compose ls/ps`), servicios,
  logs, editor de `docker-compose.yml` e importación desde `docker run`.
- **Stats Monitor**: tabla en vivo de contenedores con resumen del sistema
  (contenedores, running, CPU%, memoria usada), ordenable por columna, con
  selección por casillas.
- **Imágenes** y **Puertos**.
- **Conexiones**: contextos de Docker, hosts `unix://`, `tcp://`, `ssh://`,
  `npipe://` y conexiones guardadas.
- **Auto-conexión** al Docker local al iniciar (configurable en Preferencias).
- Ventana sin bordes con controles integrados y barra de menú arrastrable.

## Descarga

Los paquetes precompilados están en la página de **Releases**:

- **Debian/Ubuntu** (`.deb`): `DockControl_<versión>_amd64.deb`
- **AppImage** (`.AppImage`): `DockControl_<versión>_amd64.AppImage`

## Instalación

### Debian / Ubuntu (.deb)

```bash
sudo dpkg -i DockControl_1.0.0_amd64.deb
sudo apt -f install   # resuelve dependencias si hiciera falta
```

### AppImage (cualquier distribución)

```bash
chmod +x DockControl_1.0.0_amd64.AppImage
./DockControl_1.0.0_amd64.AppImage
```

## Compilar desde el código

Requisitos:

- Node.js 22+ y npm
- Rust (edition 2024) y Cargo
- Dependencias de Tauri en Linux (`webkit2gtk-4.1`, `gtk3`, `libsoup-3.0`)
- Docker instalado y en ejecución

```bash
npm install
npm run tauri dev            # desarrollo

npm run tauri build          # compilar binario y paquetes
# .deb      -> src-tauri/target/release/bundle/deb/
# AppImage  -> src-tauri/target/release/bundle/appimage/
```

## Versiones

| Versión | Fecha      | Notas |
| ------- | ---------- | ----- |
| 1.0.0   | 2026-10-14 | Primera versión. Contenedores, imágenes, proyectos Compose, monitor de estadísticas, puertos, conexiones, auto-conexión local. Paquetes `.deb` y `.AppImage`. |

## Tecnologías

- Tauri 2 (Rust edition 2024)
- React 19 + antd 6 + react-router 7 + zustand
- bollard (Docker API) y CLI de Docker Compose v2

## Licencia

Este proyecto se distribuye bajo la **GNU General Public License v3.0 o
posterior** (GPL-3.0-or-later). Ver el archivo [LICENSE](LICENSE).
