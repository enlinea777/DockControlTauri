use bollard::query_parameters::{
    ListContainersOptions, RemoveContainerOptions, StartContainerOptions, StopContainerOptions,
};
use bollard::models::{ContainerInspectResponse, ContainerSummary, ContainerTopResponse};
use tauri::Emitter;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub async fn list(state: &AppState, all: bool) -> AppResult<Vec<ContainerSummary>> {
    let docker = crate::docker::connection::current(state)?;
    let options = ListContainersOptions {
        all,
        ..Default::default()
    };
    Ok(docker.list_containers(Some(options)).await?)
}

pub async fn start(state: &AppState, id: &str) -> AppResult<()> {
    let docker = crate::docker::connection::current(state)?;
    docker
        .start_container(id, None::<StartContainerOptions>)
        .await?;
    Ok(())
}

pub async fn stop(state: &AppState, id: &str) -> AppResult<()> {
    let docker = crate::docker::connection::current(state)?;
    docker
        .stop_container(id, None::<StopContainerOptions>)
        .await?;
    Ok(())
}

pub async fn restart(state: &AppState, id: &str) -> AppResult<()> {
    let docker = crate::docker::connection::current(state)?;
    docker
        .restart_container(id, None::<bollard::query_parameters::RestartContainerOptions>)
        .await?;
    Ok(())
}

pub async fn remove(state: &AppState, id: &str, force: bool) -> AppResult<()> {
    let docker = crate::docker::connection::current(state)?;
    let options = RemoveContainerOptions {
        force,
        ..Default::default()
    };
    docker.remove_container(id, Some(options)).await?;
    Ok(())
}

pub async fn inspect(state: &AppState, id: &str) -> AppResult<ContainerInspectResponse> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker.inspect_container(id, None).await?)
}

pub async fn top_processes(state: &AppState, id: &str) -> AppResult<ContainerTopResponse> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker
        .top_processes(id, None::<bollard::query_parameters::TopOptions>)
        .await?)
}

/// Run a command inside a container and return its combined output.
pub async fn exec(
    state: &AppState,
    id: &str,
    cmd: Vec<String>,
    user: Option<String>,
) -> AppResult<String> {
    use bollard::exec::{CreateExecOptions, StartExecResults};
    use futures_util::StreamExt;

    let docker = crate::docker::connection::current(state)?;
    let config = CreateExecOptions::<String> {
        cmd: Some(cmd),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        attach_stdin: Some(false),
        tty: Some(false),
        user,
        ..Default::default()
    };
    let created = docker.create_exec(id, config).await?;
    let exec_id = created.id;

    let mut output = String::new();
    if let StartExecResults::Attached {
        output: mut stream, ..
    } = docker.start_exec(&exec_id, None).await?
    {
        while let Some(item) = stream.next().await {
            match item {
                Ok(log) => output.push_str(&log.to_string()),
                Err(e) => return Err(e.into()),
            }
        }
    }
    Ok(output)
}

/// Detect an available shell inside the container. Uses the requested binary
/// first and falls back to `bash`, `sh`, `ash`, `zsh`. Returns the binary name
/// to use (never fails; falls back to the requested name).
async fn resolve_shell(state: &AppState, id: &str, requested: &str) -> String {
    let bin = requested.split_whitespace().next().unwrap_or("sh").to_string();
    let safe = bin.replace('\'', "");
    let script = format!(
        "for s in '{safe}' bash sh ash zsh; do command -v \"$s\" >/dev/null 2>&1 && {{ echo \"$s\"; exit 0; }}; done"
    );
    match exec(state, id, vec!["sh".to_string(), "-c".to_string(), script], None).await {
        Ok(out) => out
            .lines()
            .map(|l| l.trim().trim_end_matches('\r'))
            .find(|l| !l.is_empty() && !l.contains("not found") && !l.contains("exec failed"))
            .map(|s| s.to_string())
            .unwrap_or(bin),
        Err(_) => bin,
    }
}

/// Start an interactive (PTY) exec session inside a container.
///
/// Output is streamed through `container-exec` events carrying
/// `{ id, data }`. Input is forwarded with [`exec_write`], resize with
/// [`exec_resize`] and the session is closed with [`exec_stop`].
pub async fn exec_start(
    app: tauri::AppHandle,
    state: &AppState,
    id: &str,
    cmd: Vec<String>,
    cols: u16,
    rows: u16,
) -> AppResult<String> {
    use bollard::exec::{CreateExecOptions, ResizeExecOptions, StartExecResults};
    use futures_util::StreamExt;
    use tauri::Manager;

    // Fall back to an available shell if the requested one is missing.
    let mut cmd = cmd;
    let mut shell_notice: Option<String> = None;
    if let Some(first) = cmd.first().cloned() {
        let resolved = resolve_shell(state, id, &first).await;
        if resolved != first && !cmd.is_empty() {
            shell_notice = Some(format!(
                "[shell: {resolved}] (no se encontró '{first}' en el contenedor)"
            ));
            cmd[0] = resolved;
        }
    }

    let docker = crate::docker::connection::current(state)?;
    let config = CreateExecOptions::<String> {
        cmd: Some(cmd),
        attach_stdin: Some(true),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        tty: Some(true),
        ..Default::default()
    };
    let created = docker.create_exec(id, config).await?;
    let exec_id = created.id;

    let _ = docker
        .resize_exec(
            &exec_id,
            ResizeExecOptions {
                height: rows.max(1),
                width: cols.max(1),
            },
        )
        .await;

    let session = uuid::Uuid::new_v4().to_string();

    match docker.start_exec(&exec_id, None).await? {
        StartExecResults::Attached {
            mut output,
            mut input,
        } => {
            let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
            {
                let mut map = state
                    .exec_sessions
                    .lock()
                    .map_err(|_| AppError::msg("estado bloqueado"))?;
                map.insert(
                    session.clone(),
                    crate::state::ExecSession {
                        input: tx,
                        exec_id: exec_id.clone(),
                    },
                );
            }

            if let Some(notice) = &shell_notice {
                let _ = app.emit(
                    "container-exec",
                    serde_json::json!({
                        "id": session,
                        "data": format!("\r\n\x1b[33m{notice}\x1b[0m\r\n"),
                    }),
                );
            }

            // Forward input from the frontend to the container's stdin.
            tokio::spawn(async move {
                use tokio::io::AsyncWriteExt;
                while let Some(data) = rx.recv().await {
                    if input.write_all(&data).await.is_err() {
                        break;
                    }
                    let _ = input.flush().await;
                }
            });

            // Stream output back to the frontend.
            let app2 = app.clone();
            let sid = session.clone();
            tokio::spawn(async move {
                while let Some(item) = output.next().await {
                    match item {
                        Ok(log) => {
                            let _ = app2.emit(
                                "container-exec",
                                serde_json::json!({ "id": sid, "data": log.to_string() }),
                            );
                        }
                        Err(err) => {
                            let _ = app2.emit(
                                "container-exec",
                                serde_json::json!({
                                    "id": sid,
                                    "data": format!("\r\n[error] {err}\r\n"),
                                }),
                            );
                            break;
                        }
                    }
                }
                if let Some(state) = app2.try_state::<AppState>() {
                    if let Ok(mut map) = state.exec_sessions.lock() {
                        map.remove(&sid);
                    }
                }
                let _ = app2.emit("container-exec-end", serde_json::json!({ "id": sid }));
            });
        }
        StartExecResults::Detached => {}
    }

    Ok(session)
}

/// Write data to an interactive exec session.
pub fn exec_write(state: &AppState, session: &str, data: &str) -> AppResult<()> {
    let map = state
        .exec_sessions
        .lock()
        .map_err(|_| AppError::msg("estado bloqueado"))?;
    let handle = map
        .get(session)
        .ok_or_else(|| AppError::msg("sesión de consola no encontrada"))?;
    handle
        .input
        .send(data.as_bytes().to_vec())
        .map_err(|_| AppError::msg("la consola se cerró"))?;
    Ok(())
}

/// Resize an interactive exec session's PTY.
pub async fn exec_resize(
    state: &AppState,
    session: &str,
    cols: u16,
    rows: u16,
) -> AppResult<()> {
    use bollard::exec::ResizeExecOptions;
    let exec_id = {
        let map = state
            .exec_sessions
            .lock()
            .map_err(|_| AppError::msg("estado bloqueado"))?;
        map.get(session)
            .map(|s| s.exec_id.clone())
            .ok_or_else(|| AppError::msg("sesión de consola no encontrada"))?
    };
    let docker = crate::docker::connection::current(state)?;
    docker
        .resize_exec(
            &exec_id,
            ResizeExecOptions {
                height: rows.max(1),
                width: cols.max(1),
            },
        )
        .await?;
    Ok(())
}

/// Close an interactive exec session.
pub fn exec_stop(state: &AppState, session: &str) -> AppResult<()> {
    let mut map = state
        .exec_sessions
        .lock()
        .map_err(|_| AppError::msg("estado bloqueado"))?;
    map.remove(session);
    Ok(())
}

/// Stream the logs of a container to the frontend. Emits `docker-log` events
/// carrying `{ id, line }` and a final `docker-log-end` event with `{ id }`.
pub async fn stream_logs(
    app: tauri::AppHandle,
    state: &AppState,
    id: &str,
    tail: u32,
    follow: bool,
) -> AppResult<String> {
    use futures_util::StreamExt;

    let docker = crate::docker::connection::current(state)?;
    let stream_id = uuid::Uuid::new_v4().to_string();
    let options = bollard::query_parameters::LogsOptions {
        follow,
        stdout: true,
        stderr: true,
        timestamps: false,
        tail: if tail == 0 {
            "all".to_string()
        } else {
            tail.to_string()
        },
        ..Default::default()
    };

    let sid = stream_id.clone();
    let container = id.to_string();
    tokio::spawn(async move {
        let mut stream = docker.logs(&container, Some(options));
        while let Some(item) = stream.next().await {
            match item {
                Ok(output) => {
                    let line = output.to_string();
                    let _ = app.emit(
                        "docker-log",
                        serde_json::json!({ "id": sid, "line": line }),
                    );
                }
                Err(err) => {
                    let _ = app.emit(
                        "docker-log",
                        serde_json::json!({ "id": sid, "line": format!("[error] {err}") }),
                    );
                    break;
                }
            }
        }
        let _ = app.emit("docker-log-end", serde_json::json!({ "id": sid }));
    });

    Ok(stream_id)
}

/// Stream live resource stats for a container. Emits `docker-stats` events.
pub async fn stream_stats(
    app: tauri::AppHandle,
    state: &AppState,
    id: &str,
) -> AppResult<String> {
    use futures_util::StreamExt;

    let docker = crate::docker::connection::current(state)?;
    let stream_id = uuid::Uuid::new_v4().to_string();
    let options = bollard::query_parameters::StatsOptions {
        stream: true,
        one_shot: false,
    };

    let sid = stream_id.clone();
    let container = id.to_string();
    tokio::spawn(async move {
        let mut stream = docker.stats(&container, Some(options));
        while let Some(item) = stream.next().await {
            match item {
                Ok(stats) => {
                    let _ = app.emit(
                        "docker-stats",
                        serde_json::json!({ "id": sid, "stats": stats }),
                    );
                }
                Err(_) => break,
            }
        }
    });

    Ok(stream_id)
}

#[allow(dead_code)]
pub fn ensure_exists(summaries: &[ContainerSummary], id: &str) -> AppResult<()> {
    if summaries.iter().any(|c| c.id.as_deref() == Some(id)) {
        Ok(())
    } else {
        Err(AppError::msg(format!("contenedor {id} no encontrado")))
    }
}
