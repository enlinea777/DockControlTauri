use std::collections::HashMap;
use std::sync::Mutex;

use bollard::Docker;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

/// Prefix used for temporary socket files. Any file in the temp directory that
/// starts with this prefix is considered garbage and is removed on connect.
pub const TEMP_SOCKET_PREFIX: &str = "temp_socket";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub name: String,
    /// A docker host spec: a scheme such as `unix://`, `tcp://`, `ssh://`,
    /// `npipe://`, or a docker context name that will be resolved on connect.
    pub host: String,
    /// Unique temporary socket name proposed for this connection. Old files
    /// with the `temp_socket` prefix are removed on each new connection.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temp_socket: Option<String>,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            name: "local".to_string(),
            host: default_host(),
            temp_socket: None,
        }
    }
}

impl ConnectionConfig {
    pub fn with_host(name: String, host: String) -> Self {
        let temp_socket = Some(new_temp_socket_name(&host));
        Self {
            name,
            host,
            temp_socket,
        }
    }
}

/// Default Docker host for the current operating system (or `DOCKER_HOST`).
///
/// - Windows: `npipe:////./pipe/docker_engine` (Docker Desktop).
/// - macOS/Linux: `unix:///var/run/docker.sock`.
pub fn default_host() -> String {
    if let Ok(host) = std::env::var("DOCKER_HOST") {
        if !host.is_empty() {
            return host;
        }
    }
    if cfg!(target_os = "windows") {
        "npipe:////./pipe/docker_engine".to_string()
    } else {
        "unix:///var/run/docker.sock".to_string()
    }
}

/// Candidate local hosts to try when auto-connecting, in order.
pub fn local_host_candidates() -> Vec<String> {
    let mut hosts = vec![default_host()];
    if cfg!(target_os = "macos") {
        if let Some(home) = std::env::var_os("HOME") {
            let sock = std::path::Path::new(&home).join(".docker/run/docker.sock");
            hosts.push(format!("unix://{}", sock.display()));
        }
    } else if !cfg!(target_os = "windows") {
        hosts.push("unix:///run/user/0/docker.sock".to_string());
    }
    hosts.dedup();
    hosts
}

/// Generate a unique temporary socket name, e.g. `temp_socket_xeon_4434234`.
pub fn new_temp_socket_name(host: &str) -> String {
    let tag: String = host
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(8)
        .collect();
    let rand = uuid::Uuid::new_v4().simple().to_string();
    format!(
        "{}_{}_{}",
        TEMP_SOCKET_PREFIX,
        if tag.is_empty() { "local" } else { &tag },
        &rand[..8]
    )
}

/// Remove every stale temporary socket file (prefix `temp_socket`) in the
/// system temp directory. Best effort: returns how many were removed.
pub fn cleanup_temp_sockets() -> usize {
    let dir = std::env::temp_dir();
    let mut removed = 0;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with(TEMP_SOCKET_PREFIX) {
                    let path = entry.path();
                    if std::fs::remove_file(&path).is_ok() {
                        removed += 1;
                    }
                }
            }
        }
    }
    removed
}

/// A live interactive exec (PTY) session.
pub struct ExecSession {
    pub input: UnboundedSender<Vec<u8>>,
    pub exec_id: String,
}

pub struct AppState {
    pub docker: Mutex<Option<Docker>>,
    pub connection: Mutex<ConnectionConfig>,
    pub exec_sessions: Mutex<HashMap<String, ExecSession>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            docker: Mutex::new(None),
            connection: Mutex::new(ConnectionConfig::default()),
            exec_sessions: Mutex::new(HashMap::new()),
        }
    }
}
