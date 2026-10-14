use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use tauri::Emitter;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeProject {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Status", default)]
    pub status: String,
    #[serde(rename = "ConfigFiles", default)]
    pub config_files: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ComposePsEntry {
    #[serde(rename = "ID", default)]
    pub id: String,
    #[serde(rename = "Name", default)]
    pub name: String,
    #[serde(rename = "Image", default)]
    pub image: String,
    #[serde(rename = "Service", default)]
    pub service: String,
    #[serde(rename = "State", default)]
    pub state: String,
    #[serde(rename = "Status", default)]
    pub status: String,
    #[serde(rename = "Health", default)]
    pub health: String,
    #[serde(rename = "ExitCode", default)]
    pub exit_code: i64,
    #[serde(rename = "Ports", default)]
    pub ports: String,
    #[serde(rename = "Publishers", default)]
    pub publishers: Value,
    #[serde(rename = "Command", default)]
    pub command: String,
    #[serde(rename = "CreatedAt", default)]
    pub created_at: String,
    #[serde(rename = "RunningFor", default)]
    pub running_for: String,
    #[serde(rename = "Project", default)]
    pub project: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComposeServiceSummary {
    pub name: String,
    pub image: Option<String>,
    pub build: Option<String>,
    pub ports: Vec<String>,
    pub container_name: Option<String>,
    pub restart: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComposeFile {
    pub path: String,
    pub name: Option<String>,
    pub version: Option<String>,
    pub services: Vec<ComposeServiceSummary>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub status: i32,
}

/// Build the argument list for a `docker compose` invocation.
fn base_args(files: &[String], project: Option<&str>, extra: &[String]) -> Vec<String> {
    let mut args = vec!["compose".to_string()];
    for file in files {
        args.push("-f".to_string());
        args.push(file.clone());
    }
    if let Some(name) = project {
        args.push("-p".to_string());
        args.push(name.to_string());
    }
    args.extend_from_slice(extra);
    args
}

fn working_dir(files: &[String]) -> Option<String> {
    files
        .first()
        .and_then(|f| std::path::Path::new(f).parent())
        .map(|p| p.to_string_lossy().to_string())
}

async fn run_compose(
    files: &[String],
    project: Option<&str>,
    extra: &[String],
) -> AppResult<CommandResult> {
    let args = base_args(files, project, extra);
    let cwd = working_dir(files);
    let out = crate::exec::run("docker", &args, cwd.as_deref(), &[]).await?;
    Ok(CommandResult {
        stdout: out.stdout,
        stderr: out.stderr,
        status: out.status,
    })
}

async fn run_compose_checked(
    files: &[String],
    project: Option<&str>,
    extra: &[String],
) -> AppResult<CommandResult> {
    let result = run_compose(files, project, extra).await?;
    if result.status != 0 {
        let detail = if result.stderr.trim().is_empty() {
            result.stdout.trim()
        } else {
            result.stderr.trim()
        };
        return Err(AppError::msg(detail.to_string()));
    }
    Ok(result)
}

pub async fn list() -> AppResult<Vec<ComposeProject>> {
    let args = vec![
        "compose".to_string(),
        "ls".to_string(),
        "--all".to_string(),
        "--format".to_string(),
        "json".to_string(),
    ];
    let out = crate::exec::run("docker", &args, None, &[]).await?;
    if !out.success() {
        return Err(AppError::command("docker compose ls", &out));
    }
    let projects: Vec<ComposeProject> = serde_json::from_str(out.stdout.trim()).unwrap_or_default();
    Ok(projects)
}

/// List compose files that live inside a directory.
pub async fn files_in_dir(dir: &str) -> AppResult<Vec<String>> {
    let mut result = Vec::new();
    let mut entries = tokio::fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        if !entry.file_type().await?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if is_compose_candidate(&name) {
            result.push(entry.path().to_string_lossy().to_string());
        }
    }
    result.sort();
    Ok(result)
}

fn is_compose_candidate(name: &str) -> bool {
    let lower = name.to_lowercase();
    (lower.starts_with("docker-compose") || lower.starts_with("compose"))
        && (lower.ends_with(".yml")
            || lower.ends_with(".yaml")
            || lower.ends_with(".yml.j2")
            || lower.ends_with(".yaml.tmpl"))
}

pub async fn parse(path: &str) -> AppResult<ComposeFile> {
    let raw = tokio::fs::read_to_string(path).await?;
    let value: Value = serde_yaml::from_str(&raw)?;

    let version = value
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let name = value
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut services = Vec::new();
    if let Some(mapping) = value.get("services").and_then(|s| s.as_mapping()) {
        for (key, def) in mapping {
            let service_name = key.as_str().unwrap_or_default().to_string();
            let image = def
                .get("image")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let build = match def.get("build") {
                Some(Value::String(s)) => Some(s.clone()),
                Some(Value::Mapping(m)) => m
                    .get(Value::String("context".into()))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                _ => None,
            };
            let container_name = def
                .get("container_name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let restart = def
                .get("restart")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let mut ports = Vec::new();
            if let Some(list) = def.get("ports").and_then(|v| v.as_sequence()) {
                for port in list {
                    ports.push(yaml_scalar_to_string(port));
                }
            }
            services.push(ComposeServiceSummary {
                name: service_name,
                image,
                build,
                ports,
                container_name,
                restart,
            });
        }
    }

    Ok(ComposeFile {
        path: std::path::Path::new(path)
            .canonicalize()
            .unwrap_or_else(|_| std::path::PathBuf::from(path))
            .to_string_lossy()
            .to_string(),
        name,
        version,
        services,
        raw,
    })
}

fn yaml_scalar_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Mapping(m) => {
            // long syntax ports: { target, published, protocol }
            let target = m.get(Value::String("target".into())).map(yaml_scalar_to_string);
            let published = m
                .get(Value::String("published".into()))
                .map(yaml_scalar_to_string);
            match (published, target) {
                (Some(p), Some(t)) => format!("{p}:{t}"),
                (_, Some(t)) => t,
                _ => String::new(),
            }
        }
        _ => String::new(),
    }
}

pub async fn ps(files: &[String], project: Option<&str>) -> AppResult<Vec<ComposePsEntry>> {
    let extra = vec!["ps".to_string(), "--all".to_string(), "--format".to_string(), "json".to_string()];
    let result = run_compose(files, project, &extra).await?;
    if result.status != 0 {
        let detail = if result.stderr.trim().is_empty() {
            result.stdout.trim()
        } else {
            result.stderr.trim()
        };
        return Err(AppError::msg(detail.to_string()));
    }
    let mut entries = Vec::new();
    for line in result.stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(entry) = serde_json::from_str::<ComposePsEntry>(line) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

pub async fn up(files: &[String], project: Option<&str>, detach: bool, build: bool) -> AppResult<CommandResult> {
    let mut extra = vec!["up".to_string()];
    if detach {
        extra.push("-d".to_string());
    }
    if build {
        extra.push("--build".to_string());
    }
    run_compose_checked(files, project, &extra).await
}

pub async fn down(files: &[String], project: Option<&str>, volumes: bool) -> AppResult<CommandResult> {
    let mut extra = vec!["down".to_string()];
    if volumes {
        extra.push("-v".to_string());
    }
    run_compose_checked(files, project, &extra).await
}

pub async fn start_service(files: &[String], project: Option<&str>, service: Option<&str>) -> AppResult<CommandResult> {
    let mut extra = vec!["start".to_string()];
    if let Some(s) = service {
        extra.push(s.to_string());
    }
    run_compose_checked(files, project, &extra).await
}

pub async fn stop_service(files: &[String], project: Option<&str>, service: Option<&str>) -> AppResult<CommandResult> {
    let mut extra = vec!["stop".to_string()];
    if let Some(s) = service {
        extra.push(s.to_string());
    }
    run_compose_checked(files, project, &extra).await
}

pub async fn restart_service(files: &[String], project: Option<&str>, service: Option<&str>) -> AppResult<CommandResult> {
    let mut extra = vec!["restart".to_string()];
    if let Some(s) = service {
        extra.push(s.to_string());
    }
    run_compose_checked(files, project, &extra).await
}

pub async fn build(files: &[String], project: Option<&str>, service: Option<&str>) -> AppResult<CommandResult> {
    let mut extra = vec!["build".to_string()];
    if let Some(s) = service {
        extra.push(s.to_string());
    }
    run_compose_checked(files, project, &extra).await
}

pub async fn pull(files: &[String], project: Option<&str>) -> AppResult<CommandResult> {
    run_compose_checked(files, project, &["pull".to_string()]).await
}

pub async fn validate(files: &[String], project: Option<&str>) -> AppResult<CommandResult> {
    run_compose_checked(files, project, &["config".to_string()]).await
}

pub async fn write_file(path: &str, content: &str) -> AppResult<()> {
    if let Some(parent) = std::path::Path::new(path).parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, content).await?;
    Ok(())
}

pub async fn read_file(path: &str) -> AppResult<String> {
    Ok(tokio::fs::read_to_string(path).await?)
}

/// Stream `docker compose logs` to the frontend as `docker-log` events.
pub async fn stream_logs(
    app: tauri::AppHandle,
    files: &[String],
    project: Option<&str>,
    service: Option<&str>,
    follow: bool,
    tail: u32,
) -> AppResult<String> {
    let mut extra = vec!["logs".to_string(), "--no-color".to_string()];
    if follow {
        extra.push("--follow".to_string());
    }
    extra.push("--tail".to_string());
    extra.push(if tail == 0 { "all".to_string() } else { tail.to_string() });
    if let Some(s) = service {
        extra.push(s.to_string());
    }
    let args = base_args(files, project, &extra);
    let cwd = working_dir(files);
    let stream_id = uuid::Uuid::new_v4().to_string();

    let sid = stream_id.clone();
    tokio::spawn(async move {
        use std::process::Stdio;
        let mut cmd = tokio::process::Command::new("docker");
        cmd.args(&args);
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.stdin(Stdio::null());

        match cmd.spawn() {
            Ok(mut child) => {
                use tokio::io::{AsyncBufReadExt, BufReader};
                if let Some(stdout) = child.stdout.take() {
                    let mut lines = BufReader::new(stdout).lines();
                    let app_out = app.clone();
                    let sid_out = sid.clone();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = app_out.emit(
                            "docker-log",
                            serde_json::json!({ "id": sid_out, "line": line, "source": "stdout" }),
                        );
                    }
                }
                if let Some(stderr) = child.stderr.take() {
                    let mut lines = BufReader::new(stderr).lines();
                    let app_err = app.clone();
                    let sid_err = sid.clone();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = app_err.emit(
                            "docker-log",
                            serde_json::json!({ "id": sid_err, "line": line, "source": "stderr" }),
                        );
                    }
                }
                let _ = child.wait().await;
            }
            Err(err) => {
                let _ = app.emit(
                    "docker-log",
                    serde_json::json!({ "id": sid, "line": format!("[error] {err}") }),
                );
            }
        }
        let _ = app.emit("docker-log-end", serde_json::json!({ "id": sid }));
    });

    Ok(stream_id)
}

/// Parse the services of a compose file into a name -> raw YAML map. Used by
/// the editor page to render service cards without re-parsing on the frontend.
pub async fn service_details(path: &str) -> AppResult<BTreeMap<String, Value>> {
    let raw = tokio::fs::read_to_string(path).await?;
    let value: serde_yaml::Value = serde_yaml::from_str(&raw)?;
    let mut result = BTreeMap::new();
    if let Some(mapping) = value.get("services").and_then(|s| s.as_mapping()) {
        for (key, def) in mapping {
            if let Some(name) = key.as_str() {
                result.insert(name.to_string(), def.clone());
            }
        }
    }
    Ok(result)
}
