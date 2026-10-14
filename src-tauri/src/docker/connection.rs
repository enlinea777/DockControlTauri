use bollard::{Docker, API_DEFAULT_VERSION};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::state::{AppState, ConnectionConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInfo {
    pub name: String,
    pub description: String,
    #[serde(rename = "docker_endpoint")]
    pub docker_endpoint: String,
    pub current: bool,
}

/// Turn a connection spec into a concrete docker host URI.
///
/// A spec that already contains a scheme (`unix://`, `tcp://`, `ssh://`, ...)
/// is returned untouched. Anything else is treated as a docker context name and
/// resolved through the `docker context inspect` CLI.
pub async fn resolve_host(spec: &str) -> AppResult<String> {
    if spec.contains("://") {
        return Ok(spec.to_string());
    }
    let args = vec![
        "context".to_string(),
        "inspect".to_string(),
        spec.to_string(),
        "--format".to_string(),
        "{{.Endpoints.docker.Host}}".to_string(),
    ];
    let out = crate::exec::run("docker", &args, None, &[]).await?;
    if !out.success() {
        return Err(AppError::msg(format!(
            "no se pudo resolver el contexto '{}': {}",
            spec,
            out.stderr.trim()
        )));
    }
    Ok(out.stdout.trim().to_string())
}

pub async fn connect(spec: &str) -> AppResult<Docker> {
    let host = resolve_host(spec).await?;
    let docker = Docker::connect_with_host(&host)?;
    Ok(docker)
}

pub fn current(state: &AppState) -> AppResult<Docker> {
    let guard = state
        .docker
        .lock()
        .map_err(|_| AppError::msg("estado bloqueado"))?;
    guard
        .as_ref()
        .cloned()
        .ok_or_else(|| AppError::msg("sin conexión a Docker. Conéctate a un host primero."))
}

pub fn set_current(state: &AppState, docker: Docker, config: ConnectionConfig) -> AppResult<()> {
    *state
        .docker
        .lock()
        .map_err(|_| AppError::msg("estado bloqueado"))? = Some(docker);
    *state
        .connection
        .lock()
        .map_err(|_| AppError::msg("estado bloqueado"))? = config;
    Ok(())
}

pub fn connection_config(state: &AppState) -> AppResult<ConnectionConfig> {
    let guard = state
        .connection
        .lock()
        .map_err(|_| AppError::msg("estado bloqueado"))?;
    Ok(guard.clone())
}

pub async fn list_contexts() -> AppResult<Vec<ContextInfo>> {
    let args = vec![
        "context".to_string(),
        "ls".to_string(),
        "--format".to_string(),
        "{{json .}}".to_string(),
    ];
    let out = crate::exec::run("docker", &args, None, &[]).await?;
    if !out.success() {
        return Err(AppError::command("docker context ls", &out));
    }

    #[derive(Deserialize)]
    struct RawContext {
        #[serde(rename = "Name", default)]
        name: String,
        #[serde(rename = "Description", default)]
        description: String,
        #[serde(rename = "DockerEndpoint", default)]
        docker_endpoint: String,
        #[serde(rename = "Current", default)]
        current: bool,
    }

    let mut contexts = Vec::new();
    for line in out.stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(raw) = serde_json::from_str::<RawContext>(line) {
            contexts.push(ContextInfo {
                name: raw.name,
                description: raw.description,
                docker_endpoint: raw.docker_endpoint,
                current: raw.current,
            });
        }
    }
    Ok(contexts)
}

#[allow(dead_code)]
pub async fn api_version(spec: &str) -> AppResult<String> {
    let host = resolve_host(spec).await?;
    let docker = Docker::connect_with_host(&host)?;
    let version = docker.version().await?;
    Ok(version.api_version.unwrap_or_else(|| {
        format!("{}.{}", API_DEFAULT_VERSION.major_version, API_DEFAULT_VERSION.minor_version)
    }))
}
