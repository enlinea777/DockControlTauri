use std::sync::Mutex;

use bollard::Docker;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub name: String,
    /// A docker host spec: a scheme such as `unix://`, `tcp://`, `ssh://`,
    /// `npipe://`, or a docker context name that will be resolved on connect.
    pub host: String,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            name: "local".to_string(),
            host: default_host(),
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

pub struct AppState {
    pub docker: Mutex<Option<Docker>>,
    pub connection: Mutex<ConnectionConfig>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            docker: Mutex::new(None),
            connection: Mutex::new(ConnectionConfig::default()),
        }
    }
}
