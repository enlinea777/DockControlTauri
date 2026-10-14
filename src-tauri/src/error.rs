use serde::Serialize;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
    Docker(bollard::errors::Error),
    Yaml(serde_yaml::Error),
    Json(serde_json::Error),
    Message(String),
}

impl AppError {
    pub fn msg(message: impl Into<String>) -> Self {
        AppError::Message(message.into())
    }

    pub fn command(context: &str, out: &crate::exec::CmdOutput) -> Self {
        let detail = if out.stderr.trim().is_empty() {
            out.stdout.trim()
        } else {
            out.stderr.trim()
        };
        AppError::Message(format!("{context}: {detail}"))
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "{e}"),
            AppError::Docker(e) => write!(f, "{e}"),
            AppError::Yaml(e) => write!(f, "{e}"),
            AppError::Json(e) => write!(f, "{e}"),
            AppError::Message(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for AppError {}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        AppError::Io(value)
    }
}

impl From<bollard::errors::Error> for AppError {
    fn from(value: bollard::errors::Error) -> Self {
        AppError::Docker(value)
    }
}

impl From<serde_yaml::Error> for AppError {
    fn from(value: serde_yaml::Error) -> Self {
        AppError::Yaml(value)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        AppError::Json(value)
    }
}

pub type AppResult<T> = Result<T, AppError>;
