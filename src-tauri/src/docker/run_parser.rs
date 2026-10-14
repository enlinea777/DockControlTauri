use serde_yaml::{Mapping, Value};

use crate::error::{AppError, AppResult};

/// Convert a `docker run ...` command line into an equivalent compose service
/// definition, mirroring DockStation's "import docker run" feature.
pub fn docker_run_to_compose(command: &str) -> AppResult<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err(AppError::msg("comando vacío"));
    }

    let tokens = shell_words::split(trimmed)
        .map_err(|e| AppError::msg(format!("no se pudo parsear el comando: {e}")))?;

    let mut it = tokens.into_iter().peekable();

    if let Some(first) = it.peek() {
        if first == "docker" {
            it.next();
        }
    }
    if let Some(next) = it.peek() {
        if next == "run" {
            it.next();
        }
    }

    let mut ports: Vec<Value> = Vec::new();
    let mut volumes: Vec<Value> = Vec::new();
    let mut environment: Vec<Value> = Vec::new();
    let mut labels: Vec<Value> = Vec::new();
    let mut image: Option<String> = None;
    let mut restart: Option<String> = None;
    let mut network: Option<String> = None;
    let mut name: Option<String> = None;
    let mut working_dir: Option<String> = None;
    let mut hostname: Option<String> = None;
    let mut entrypoint: Option<String> = None;
    let mut command_parts: Vec<String> = Vec::new();

    fn value_for(
        inline: Option<String>,
        it: &mut std::iter::Peekable<std::vec::IntoIter<String>>,
    ) -> Option<String> {
        inline.or_else(|| it.next())
    }

    while let Some(token) = it.next() {
        if image.is_some() {
            command_parts.push(token);
            continue;
        }

        let (flag, inline) = match token.split_once('=') {
            Some((f, v)) if f.starts_with('-') => (f.to_string(), Some(v.to_string())),
            _ => (token.clone(), None),
        };

        match flag.as_str() {
            "--name" => name = value_for(inline, &mut it),
            "-p" | "--publish" => {
                if let Some(v) = value_for(inline, &mut it) {
                    ports.push(Value::String(v));
                }
            }
            "-v" | "--volume" => {
                if let Some(v) = value_for(inline, &mut it) {
                    volumes.push(Value::String(v));
                }
            }
            "-e" | "--env" => {
                if let Some(v) = value_for(inline, &mut it) {
                    environment.push(Value::String(v));
                }
            }
            "-l" | "--label" => {
                if let Some(v) = value_for(inline, &mut it) {
                    labels.push(Value::String(v));
                }
            }
            "--network" | "--net" => network = value_for(inline, &mut it),
            "--restart" => restart = value_for(inline, &mut it),
            "-w" | "--workdir" => working_dir = value_for(inline, &mut it),
            "--hostname" | "-h" => hostname = value_for(inline, &mut it),
            "--entrypoint" => entrypoint = value_for(inline, &mut it),
            "-i" | "-t" | "-it" | "-ti" | "-d" | "--detach" | "--rm" | "--interactive"
            | "--tty" | "--privileged" => {}
            "--pull" | "--platform" | "--user" | "-u" | "--env-file" | "--add-host"
            | "--dns" | "--health-cmd" | "--stop-signal" | "--memory" | "-m" | "--cpus"
            | "--log-driver" | "--log-opt" => {
                let _ = value_for(inline, &mut it);
            }
            _ if flag.starts_with('-') => {}
            _ => image = Some(token),
        }
    }

    let image = image.ok_or_else(|| AppError::msg("no se encontró una imagen en el comando"))?;
    let service_name = name
        .clone()
        .unwrap_or_else(|| sanitize_service_name(&image));

    let mut service = Mapping::new();
    insert_str(&mut service, "image", image);
    if let Some(n) = name {
        insert_str(&mut service, "container_name", n);
    }
    if let Some(r) = restart {
        insert_str(&mut service, "restart", r);
    }
    if let Some(w) = working_dir {
        insert_str(&mut service, "working_dir", w);
    }
    if let Some(h) = hostname {
        insert_str(&mut service, "hostname", h);
    }
    if let Some(e) = entrypoint {
        insert_str(&mut service, "entrypoint", e);
    }
    if let Some(net) = network {
        insert_str(&mut service, "network_mode", net);
    }
    if !ports.is_empty() {
        insert_seq(&mut service, "ports", ports);
    }
    if !volumes.is_empty() {
        insert_seq(&mut service, "volumes", volumes);
    }
    if !environment.is_empty() {
        insert_seq(&mut service, "environment", environment);
    }
    if !labels.is_empty() {
        insert_seq(&mut service, "labels", labels);
    }
    if !command_parts.is_empty() {
        insert_seq(
            &mut service,
            "command",
            command_parts.into_iter().map(Value::String).collect(),
        );
    }

    let mut services = Mapping::new();
    services.insert(Value::String(service_name), Value::Mapping(service));
    let mut root = Mapping::new();
    root.insert(Value::String("services".into()), Value::Mapping(services));

    let yaml = serde_yaml::to_string(&Value::Mapping(root))?;
    Ok(yaml)
}

fn insert_str(map: &mut Mapping, key: &str, value: String) {
    map.insert(Value::String(key.to_string()), Value::String(value));
}

fn insert_seq(map: &mut Mapping, key: &str, value: Vec<Value>) {
    map.insert(Value::String(key.to_string()), Value::Sequence(value));
}

fn sanitize_service_name(image: &str) -> String {
    let base = image.rsplit('/').next().unwrap_or(image);
    let base = base.split(':').next().unwrap_or(base);
    base.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}
