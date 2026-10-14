use bollard::models::{
    ContainerInspectResponse, ContainerSummary, ContainerTopResponse, ImageInspect, ImageSummary,
    SystemDataUsageResponse, SystemInfo, SystemVersion,
};
use serde_yaml::Value;
use std::collections::BTreeMap;
use tauri::State;

use crate::docker::compose::{
    self, CommandResult, ComposeFile, ComposeProject, ComposePsEntry,
};
use crate::docker::connection::{self, ContextInfo};
use crate::docker::{containers, images, run_parser, system};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, ConnectionConfig};

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn connect_host(
    state: State<'_, AppState>,
    host: String,
    name: Option<String>,
) -> AppResult<ConnectionConfig> {
    crate::state::cleanup_temp_sockets();
    let docker = connection::connect(&host).await?;
    docker.ping().await?;
    let config = ConnectionConfig::with_host(name.unwrap_or_else(|| host.clone()), host);
    connection::set_current(&state, docker, config.clone())?;
    Ok(config)
}

#[tauri::command]
pub async fn connect_context(
    state: State<'_, AppState>,
    context: String,
) -> AppResult<ConnectionConfig> {
    connect_host(state, context.clone(), Some(context)).await
}

/// Auto-connect to the local docker socket (or the `DOCKER_HOST` value).
/// Tries the OS-specific default host and known fallbacks.
#[tauri::command]
pub async fn connect_local(state: State<'_, AppState>) -> AppResult<ConnectionConfig> {
    crate::state::cleanup_temp_sockets();
    let mut last_error: Option<crate::error::AppError> = None;
    for host in crate::state::local_host_candidates() {
        match connection::connect(&host).await {
            Ok(docker) => match docker.ping().await {
                Ok(_) => {
                    let config = ConnectionConfig::with_host("local".to_string(), host);
                    connection::set_current(&state, docker, config.clone())?;
                    return Ok(config);
                }
                Err(err) => last_error = Some(err.into()),
            },
            Err(err) => last_error = Some(err),
        }
    }
    Err(last_error
        .unwrap_or_else(|| crate::error::AppError::msg("no se encontró un Docker local")))
}

/// Remove stale temporary socket files (prefix `temp_socket`).
#[tauri::command]
pub fn cleanup_temp_sockets() -> usize {
    crate::state::cleanup_temp_sockets()
}

#[tauri::command]
pub fn frontend_log(level: Option<String>, message: String) {
    match level.as_deref() {
        Some("error") => tracing::error!(target: "frontend", "{message}"),
        Some("warn") => tracing::warn!(target: "frontend", "{message}"),
        _ => tracing::info!(target: "frontend", "{message}"),
    }
}

#[tauri::command]
pub fn current_connection(state: State<'_, AppState>) -> AppResult<ConnectionConfig> {
    connection::connection_config(&state)
}

#[tauri::command]
pub async fn list_contexts() -> AppResult<Vec<ContextInfo>> {
    connection::list_contexts().await
}

#[tauri::command]
pub async fn resolve_host(spec: String) -> AppResult<String> {
    connection::resolve_host(&spec).await
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn docker_version(state: State<'_, AppState>) -> AppResult<SystemVersion> {
    system::version(&state).await
}

#[tauri::command]
pub async fn docker_info(state: State<'_, AppState>) -> AppResult<SystemInfo> {
    system::info(&state).await
}

#[tauri::command]
pub async fn docker_ping(state: State<'_, AppState>) -> AppResult<String> {
    system::ping(&state).await
}

#[tauri::command]
pub async fn docker_df(state: State<'_, AppState>) -> AppResult<SystemDataUsageResponse> {
    system::df(&state).await
}

#[tauri::command]
pub async fn docker_events(app: tauri::AppHandle, state: State<'_, AppState>) -> AppResult<String> {
    system::stream_events(app, &state).await
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn containers_list(
    state: State<'_, AppState>,
    all: bool,
) -> AppResult<Vec<ContainerSummary>> {
    containers::list(&state, all).await
}

#[tauri::command]
pub async fn container_start(state: State<'_, AppState>, id: String) -> AppResult<()> {
    containers::start(&state, &id).await
}

#[tauri::command]
pub async fn container_stop(state: State<'_, AppState>, id: String) -> AppResult<()> {
    containers::stop(&state, &id).await
}

#[tauri::command]
pub async fn container_restart(state: State<'_, AppState>, id: String) -> AppResult<()> {
    containers::restart(&state, &id).await
}

#[tauri::command]
pub async fn container_remove(
    state: State<'_, AppState>,
    id: String,
    force: bool,
) -> AppResult<()> {
    containers::remove(&state, &id, force).await
}

#[tauri::command]
pub async fn container_inspect(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<ContainerInspectResponse> {
    containers::inspect(&state, &id).await
}

#[tauri::command]
pub async fn container_top(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<ContainerTopResponse> {
    containers::top_processes(&state, &id).await
}

#[tauri::command]
pub async fn container_logs(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
    tail: Option<u32>,
    follow: Option<bool>,
) -> AppResult<String> {
    containers::stream_logs(app, &state, &id, tail.unwrap_or(200), follow.unwrap_or(false)).await
}

#[tauri::command]
pub async fn container_stats(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<String> {
    containers::stream_stats(app, &state, &id).await
}

#[tauri::command]
pub async fn container_exec(
    state: State<'_, AppState>,
    id: String,
    cmd: Vec<String>,
    user: Option<String>,
) -> AppResult<String> {
    containers::exec(&state, &id, cmd, user).await
}

#[tauri::command]
pub async fn container_exec_start(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
    cmd: Vec<String>,
    cols: u16,
    rows: u16,
) -> AppResult<String> {
    containers::exec_start(app, &state, &id, cmd, cols, rows).await
}

#[tauri::command]
pub fn container_exec_write(
    state: State<'_, AppState>,
    session: String,
    data: String,
) -> AppResult<()> {
    containers::exec_write(&state, &session, &data)
}

#[tauri::command]
pub async fn container_exec_resize(
    state: State<'_, AppState>,
    session: String,
    cols: u16,
    rows: u16,
) -> AppResult<()> {
    containers::exec_resize(&state, &session, cols, rows).await
}

#[tauri::command]
pub fn container_exec_stop(state: State<'_, AppState>, session: String) -> AppResult<()> {
    containers::exec_stop(&state, &session)
}

/// Open the container's console in an external system terminal
/// (`docker exec -it <id> <shell>`).
#[tauri::command]
pub async fn container_exec_system(
    state: State<'_, AppState>,
    id: String,
    shell: String,
) -> AppResult<()> {
    use std::process::{Command, Stdio};

    let config = connection::connection_config(&state)?;
    let host = connection::resolve_host(&config.host)
        .await
        .unwrap_or_else(|_| config.host.clone());

    let inner = ["docker", "exec", "-it", id.as_str(), shell.as_str()];

    let candidates: &[(&str, &[&str])] = &[
        ("gnome-terminal", &["--"]),
        ("x-terminal-emulator", &["-e"]),
        ("konsole", &["-e"]),
        ("xfce4-terminal", &["-e"]),
        ("tilix", &["-e"]),
        ("alacritty", &["-e"]),
        ("kitty", &[]),
        ("xterm", &["-e"]),
    ];

    for (term, prefix) in candidates {
        let mut args: Vec<String> = prefix.iter().map(|s| s.to_string()).collect();
        args.extend(inner.iter().map(|s| s.to_string()));
        let spawned = Command::new(term)
            .args(&args)
            .env("DOCKER_HOST", &host)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        if spawned.is_ok() {
            return Ok(());
        }
    }

    Err(crate::error::AppError::msg(
        "no se encontró un emulador de terminal en el sistema",
    ))
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn images_list(
    state: State<'_, AppState>,
    all: bool,
) -> AppResult<Vec<ImageSummary>> {
    images::list(&state, all).await
}

#[tauri::command]
pub async fn image_inspect(state: State<'_, AppState>, name: String) -> AppResult<ImageInspect> {
    images::inspect(&state, &name).await
}

#[tauri::command]
pub async fn image_remove(
    state: State<'_, AppState>,
    id: String,
    force: bool,
) -> AppResult<()> {
    images::remove(&state, &id, force).await
}

#[tauri::command]
pub async fn image_tag(
    state: State<'_, AppState>,
    id: String,
    repo: String,
    tag: String,
) -> AppResult<()> {
    images::tag(&state, &id, &repo, &tag).await
}

#[tauri::command]
pub async fn image_pull(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> AppResult<String> {
    images::pull(app, &state, &name).await
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn compose_ls() -> AppResult<Vec<ComposeProject>> {
    compose::list().await
}

#[tauri::command]
pub async fn compose_files_in_dir(dir: String) -> AppResult<Vec<String>> {
    compose::files_in_dir(&dir).await
}

#[tauri::command]
pub async fn compose_parse(path: String) -> AppResult<ComposeFile> {
    compose::parse(&path).await
}

#[tauri::command]
pub async fn compose_ps(
    files: Vec<String>,
    project: Option<String>,
) -> AppResult<Vec<ComposePsEntry>> {
    compose::ps(&files, project.as_deref()).await
}

#[tauri::command]
pub async fn compose_up(
    files: Vec<String>,
    project: Option<String>,
    detach: Option<bool>,
    build: Option<bool>,
) -> AppResult<CommandResult> {
    compose::up(&files, project.as_deref(), detach.unwrap_or(true), build.unwrap_or(false)).await
}

#[tauri::command]
pub async fn compose_down(
    files: Vec<String>,
    project: Option<String>,
    volumes: Option<bool>,
) -> AppResult<CommandResult> {
    compose::down(&files, project.as_deref(), volumes.unwrap_or(false)).await
}

#[tauri::command]
pub async fn compose_start(
    files: Vec<String>,
    project: Option<String>,
    service: Option<String>,
) -> AppResult<CommandResult> {
    compose::start_service(&files, project.as_deref(), service.as_deref()).await
}

#[tauri::command]
pub async fn compose_stop(
    files: Vec<String>,
    project: Option<String>,
    service: Option<String>,
) -> AppResult<CommandResult> {
    compose::stop_service(&files, project.as_deref(), service.as_deref()).await
}

#[tauri::command]
pub async fn compose_restart(
    files: Vec<String>,
    project: Option<String>,
    service: Option<String>,
) -> AppResult<CommandResult> {
    compose::restart_service(&files, project.as_deref(), service.as_deref()).await
}

#[tauri::command]
pub async fn compose_build(
    files: Vec<String>,
    project: Option<String>,
    service: Option<String>,
) -> AppResult<CommandResult> {
    compose::build(&files, project.as_deref(), service.as_deref()).await
}

#[tauri::command]
pub async fn compose_pull(
    files: Vec<String>,
    project: Option<String>,
) -> AppResult<CommandResult> {
    compose::pull(&files, project.as_deref()).await
}

#[tauri::command]
pub async fn compose_validate(
    files: Vec<String>,
    project: Option<String>,
) -> AppResult<CommandResult> {
    compose::validate(&files, project.as_deref()).await
}

#[tauri::command]
pub async fn compose_logs(
    app: tauri::AppHandle,
    files: Vec<String>,
    project: Option<String>,
    service: Option<String>,
    follow: Option<bool>,
    tail: Option<u32>,
) -> AppResult<String> {
    compose::stream_logs(
        app,
        &files,
        project.as_deref(),
        service.as_deref(),
        follow.unwrap_or(true),
        tail.unwrap_or(200),
    )
    .await
}

#[tauri::command]
pub async fn compose_read_file(path: String) -> AppResult<String> {
    compose::read_file(&path).await
}

#[tauri::command]
pub async fn compose_write_file(path: String, content: String) -> AppResult<()> {
    compose::write_file(&path, &content).await
}

#[tauri::command]
pub async fn compose_service_details(path: String) -> AppResult<BTreeMap<String, Value>> {
    compose::service_details(&path).await
}

#[tauri::command]
pub fn compose_from_run(command: String) -> AppResult<String> {
    run_parser::docker_run_to_compose(&command)
}

// ---------------------------------------------------------------------------
// Saved connections (persisted to disk)
// ---------------------------------------------------------------------------

fn connections_file(app: &tauri::AppHandle) -> AppResult<std::path::PathBuf> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::msg(e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("connections.json"))
}

#[tauri::command]
pub fn connections_list(app: tauri::AppHandle) -> AppResult<Vec<ConnectionConfig>> {
    let path = connections_file(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

#[tauri::command]
pub fn connection_save(app: tauri::AppHandle, connection: ConnectionConfig) -> AppResult<()> {
    let path = connections_file(&app)?;
    let mut list: Vec<ConnectionConfig> = if path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&path)?).unwrap_or_default()
    } else {
        Vec::new()
    };
    list.retain(|c| c.name != connection.name);
    list.push(connection);
    std::fs::write(path, serde_json::to_string_pretty(&list)?)?;
    Ok(())
}

#[tauri::command]
pub fn connection_remove(app: tauri::AppHandle, name: String) -> AppResult<()> {
    let path = connections_file(&app)?;
    if !path.exists() {
        return Ok(());
    }
    let mut list: Vec<ConnectionConfig> =
        serde_json::from_str(&std::fs::read_to_string(&path)?).unwrap_or_default();
    list.retain(|c| c.name != name);
    std::fs::write(path, serde_json::to_string_pretty(&list)?)?;
    Ok(())
}
