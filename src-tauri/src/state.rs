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
        let host = std::env::var("DOCKER_HOST")
            .ok()
            .filter(|h| !h.is_empty())
            .unwrap_or_else(|| "unix:///var/run/docker.sock".to_string());
        Self {
            name: "local".to_string(),
            host,
        }
    }
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
