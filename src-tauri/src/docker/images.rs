use bollard::models::{CreateImageInfo, ImageInspect, ImageSummary};
use bollard::query_parameters::{
    CreateImageOptions, ListImagesOptions, RemoveImageOptions, TagImageOptions,
};
use tauri::Emitter;

use crate::error::AppResult;
use crate::state::AppState;

pub async fn list(state: &AppState, all: bool) -> AppResult<Vec<ImageSummary>> {
    let docker = crate::docker::connection::current(state)?;
    let options = ListImagesOptions {
        all,
        ..Default::default()
    };
    Ok(docker.list_images(Some(options)).await?)
}

pub async fn inspect(state: &AppState, name: &str) -> AppResult<ImageInspect> {
    let docker = crate::docker::connection::current(state)?;
    Ok(docker.inspect_image(name).await?)
}

pub async fn remove(state: &AppState, id: &str, force: bool) -> AppResult<()> {
    let docker = crate::docker::connection::current(state)?;
    let options = RemoveImageOptions {
        force,
        noprune: false,
        platforms: None,
    };
    docker.remove_image(id, Some(options), None).await?;
    Ok(())
}

pub async fn tag(state: &AppState, id: &str, repo: &str, tag: &str) -> AppResult<()> {
    let docker = crate::docker::connection::current(state)?;
    let options = TagImageOptions {
        repo: Some(repo.to_string()),
        tag: Some(tag.to_string()),
    };
    docker.tag_image(id, Some(options)).await?;
    Ok(())
}

/// Pull an image, streaming progress as `docker-pull` events.
pub async fn pull(app: tauri::AppHandle, state: &AppState, name: &str) -> AppResult<String> {
    use futures_util::StreamExt;

    let docker = crate::docker::connection::current(state)?;
    let stream_id = uuid::Uuid::new_v4().to_string();

    let (from_image, tag) = match name.split_once(':') {
        Some((image, tag)) => (image.to_string(), tag.to_string()),
        None => (name.to_string(), "latest".to_string()),
    };

    let options = CreateImageOptions {
        from_image: Some(from_image),
        tag: Some(tag),
        ..Default::default()
    };

    let sid = stream_id.clone();
    tokio::spawn(async move {
        let mut stream = docker.create_image(Some(options), None, None);
        let mut last: Option<CreateImageInfo> = None;
        while let Some(item) = stream.next().await {
            match item {
                Ok(info) => {
                    let _ = app.emit(
                        "docker-pull",
                        serde_json::json!({ "id": sid, "info": info, "stage": "progress" }),
                    );
                    last = Some(info);
                }
                Err(err) => {
                    let _ = app.emit(
                        "docker-pull",
                        serde_json::json!({ "id": sid, "stage": "error", "message": err.to_string() }),
                    );
                    return;
                }
            }
        }
        let _ = last;
        let _ = app.emit(
            "docker-pull",
            serde_json::json!({ "id": sid, "stage": "done" }),
        );
    });

    Ok(stream_id)
}
