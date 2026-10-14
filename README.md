# DockControl

<div align="center">

![GitHub Release](https://img.shields.io/github/v/release/enlinea777/DockControlTauri)
[![release](https://github.com/enlinea777/DockControlTauri/actions/workflows/release.yml/badge.svg)](https://github.com/enlinea777/DockControlTauri/actions/workflows/release.yml)
[![built_with-Rust](https://img.shields.io/badge/built_with-Rust-dca282.svg?style=flat-square)](https://www.rust-lang.org/)

</div>

<div align="center">

[![Debian Support](https://img.shields.io/badge/Debian-E95420?style=for-the-badge&logo=debian&logoColor=white)](https://github.com/enlinea777/DockControlTauri/releases)
[![Fedora Support](https://img.shields.io/badge/fedora-0078D6?style=for-the-badge&logo=fedora&logoColor=white)](https://github.com/enlinea777/DockControlTauri/releases)
[![AppImage Support](https://img.shields.io/badge/AppImage-647d88?style=for-the-badge&logo=appimage&logoColor=white)](https://github.com/enlinea777/DockControlTauri/releases)
[![Flatpak Support](https://img.shields.io/badge/Flatpak-4A90D9?style=for-the-badge&logo=flatpak&logoColor=white)](https://github.com/enlinea777/DockControlTauri/releases)
[![MacOS Support](https://img.shields.io/badge/Macos-adb8c5?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/enlinea777/DockControlTauri/releases)
[![Windows Support](https://img.shields.io/badge/windows-00A3EE?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/enlinea777/DockControlTauri/releases)

</div>

Aplicación de escritorio para administrar **Docker** (contenedores, imágenes,
proyectos Compose, monitor de estadísticas, puertos y conexiones). Reescritura
moderna inspirada en DockStation, construida con **Tauri 2 + Rust** y
**React 19**.

![DockControl](show.png)

> ⚠️ **Un detalle importante en Ubuntu (y en otros Linux)**
>
> Para que DockControl pueda conectarse automáticamente a tus contenedores sin
> pedirte permisos de administrador (`sudo`) cada vez que abre, tu usuario debe
> pertenecer al grupo de **Docker**.
>
> Si la aplicación se queda **cargando o en gris** al iniciar, ejecuta esto en
> tu terminal, **cierra sesión** en Ubuntu y vuelve a entrar:
>
> ```bash
> sudo usermod -aG docker $USER
> ```
>
> En **macOS** (Docker Desktop) el socket lo gestiona la aplicación: asegúrate de
> que **Docker Desktop esté abierto y en ejecución** antes de lanzar DockControl.
> Si se queda en gris, abre Docker Desktop, espera a que diga “Docker is running”
> y reinicia DockControl. No es necesario `usermod`.

## Características

- **Contenedores**: lista con estado (verde en ejecución / gris detenido),
  acciones redondas (Web, Exec, Start/Stop, Restart, Remove, Info), consola de
  **logs** en vivo y **gráficas** de CPU, Memoria, IO de disco e IO de red.
- **Consola interactiva**: el botón **Exec** abre una terminal real dentro del
  contenedor (`bash`/`sh`/personalizado, configurable en Preferencias →
  Consola), o un terminal del sistema con `docker exec -it`. Si el shell
  configurado no existe en el contenedor, detecta y usa `bash`/`sh`/`ash`/`zsh`
  automáticamente.
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

📥 **Descarga la última versión aquí → [Releases](https://github.com/enlinea777/DockControlTauri/releases/latest)**

Los paquetes precompilados están en la página de **Releases** (haz clic en el
enlace de arriba y baja a **Assets**):

- **Linux**: `DockControl_<versión>_amd64.deb`, `DockControl-<versión>-1.x86_64.rpm`, `DockControl_<versión>_amd64.AppImage`, `DockControl_<versión>_x86_64.flatpak`
- **Windows**: `DockControl_<versión>_x64-setup.exe` (NSIS)
- **macOS**: `DockControl_<versión>_x64.dmg` (Intel) y `DockControl_<versión>_aarch64.dmg` (Apple Silicon)

## Instalación

### Debian / Ubuntu (.deb)

```bash
sudo dpkg -i DockControl_1.1.1_amd64.deb
sudo apt -f install   # resuelve dependencias si hiciera falta
```

### Fedora / RHEL / openSUSE (.rpm)

```bash
sudo rpm -i DockControl-1.1.1-1.x86_64.rpm
# o
sudo dnf install ./DockControl-1.1.1-1.x86_64.rpm
```

### AppImage (cualquier distribución Linux)

```bash
chmod +x DockControl_1.1.1_amd64.AppImage
./DockControl_1.1.1_amd64.AppImage
```

### Flatpak

```bash
flatpak install --user ./DockControl_1.1.1_x86_64.flatpak
flatpak run io.dockstation.app
```

> El Flatpak da acceso al socket de Docker (`/run/docker.sock`) y a la CLI
> `docker` del host para las funciones de Docker Compose.
>
> **Flathub**: el manifiesto listo para enviar está en
> [`flatpak/flathub/io.dockstation.app.yml`](flatpak/flathub/io.dockstation.app.yml)
> (descarga el `.deb` del release y lo empaqueta). Para publicar: haz *fork* de
> [`flathub/flathub`](https://github.com/flathub/flathub), crea la rama `new-pr`,
> añade el manifiesto + `io.dockstation.app.metainfo.xml` y abre un PR.

### Windows (.exe)

Ejecuta `DockControl_1.1.1_x64-setup.exe` y sigue el asistente.

> La aplicación **no está firmada** digitalmente. Windows SmartScreen puede
> avisar; pulsa "Más información" → "Ejecutar de todas formas".

### macOS (.dmg)

Abre el `.dmg` y arrastra DockControl a Aplicaciones.

> La aplicación **no está firmada/notarizada**. Al abrirla por primera vez,
> usa clic derecho → **Abrir** (o Ajustes de Sistema → Privacidad y seguridad →
> "Abrir de todas formas"). Elige el `.dmg` **x64** para Intel o **aarch64**
> para Apple Silicon.


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
| 1.1.1   | 2026-10-14 | Detección del host Docker según el SO (Windows `npipe://`, macOS/Linux `unix://`) con fallbacks; gráficas de stats con cuadrícula y ejes; iconos originales de DockStation. Releases multi-plataforma: `.deb`, `.rpm`, `.AppImage` (Linux), `.exe` (Windows), `.dmg` (macOS x64 y arm64). |
| 1.0.0   | 2026-10-14 | Primera versión. Contenedores, imágenes, proyectos Compose, monitor de estadísticas, puertos, conexiones, auto-conexión local. Paquetes `.deb` y `.AppImage`. |

## Tecnologías

- Tauri 2 (Rust edition 2024)
- React 19 + antd 6 + react-router 7 + zustand
- bollard (Docker API) y CLI de Docker Compose v2

## Licencia

Este proyecto se distribuye bajo la **GNU General Public License v3.0 o
posterior** (GPL-3.0-or-later). Ver el archivo [LICENSE](LICENSE).
