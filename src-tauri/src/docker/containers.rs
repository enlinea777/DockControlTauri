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
