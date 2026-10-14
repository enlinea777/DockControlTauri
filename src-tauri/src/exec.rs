use std::process::Stdio;

use tokio::process::Command;

#[derive(Debug, Clone, Default)]
pub struct CmdOutput {
    pub status: i32,
    pub stdout: String,
    pub stderr: String,
}

impl CmdOutput {
    pub fn success(&self) -> bool {
        self.status == 0
    }
}

pub async fn run(
    bin: &str,
    args: &[String],
    cwd: Option<&str>,
    envs: &[(String, String)],
) -> std::io::Result<CmdOutput> {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    for (key, value) in envs {
        cmd.env(key, value);
    }
    cmd.stdin(Stdio::null());
    cmd.kill_on_drop(true);

    let output = cmd.output().await?;
    Ok(CmdOutput {
        status: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}
