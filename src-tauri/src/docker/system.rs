use bollard::models::{SystemDataUsageResponse, SystemInfo, SystemVersion};
use bollard::query_parameters::{DataUsageOptions, EventsOptions};
use tauri::Emitter;

use crate::error::AppResult;
use crate::state::AppState;

pub async fn version(state: &AppState) -> AppResult<SystemVersion> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker.version().await?)
}

pub async fn info(state: &AppState) -> AppResult<SystemInfo> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker.info().await?)
}

pub async fn ping(state: &AppState) -> AppResult<String> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker.ping().await?)
}

pub async fn df(state: &AppState) -> AppResult<SystemDataUsageResponse> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker.df(None::<DataUsageOptions>).await?)
}

/// Stream global docker events to the frontend as `docker-event` messages.
/// This replaces the old `bindDockerListener` behaviour from DockStation.
pub async fn stream_events(app: tauri::AppHandle, state: &AppState) -> AppResult<String> {
    use futures_util::StreamExt;

    let docker = crate::docker::connection::current(state)?;
    let stream_id = uuid::Uuid::new_v4().to_string();

    let sid = stream_id.clone();
    tokio::spawn(async move {
        let mut stream = docker.events(None::<EventsOptions>);
        while let Some(item) = stream.next().await {
            match item {
                Ok(event) => {
                    let _ = app.emit(
                        "docker-event",
                        serde_json::json!({ "id": sid, "event": event }),
                    );
                }
                Err(err) => {
                    let _ = app.emit(
                        "docker-event",
                        serde_json::json!({ "id": sid, "error": err.to_string() }),
                    );
                    break;
                }
            }
        }
    });

    Ok(stream_id)
}
