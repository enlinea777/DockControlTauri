mod commands;
mod docker;
mod error;
mod exec;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // connection
            commands::connect_host,
            commands::connect_context,
            commands::connect_local,
            commands::frontend_log,
            commands::current_connection,
            commands::list_contexts,
            commands::resolve_host,
            // system
            commands::docker_version,
            commands::docker_info,
            commands::docker_ping,
            commands::docker_df,
            commands::docker_events,
            // containers
            commands::containers_list,
            commands::container_start,
            commands::container_stop,
            commands::container_restart,
            commands::container_remove,
            commands::container_inspect,
            commands::container_top,
            commands::container_logs,
            commands::container_stats,
            commands::container_exec,
            commands::container_exec_start,
            commands::container_exec_write,
            commands::container_exec_resize,
            commands::container_exec_stop,
            commands::container_exec_system,
            commands::cleanup_temp_sockets,
            // images
            commands::images_list,
            commands::image_inspect,
            commands::image_remove,
            commands::image_tag,
            commands::image_pull,
            // compose
            commands::compose_ls,
            commands::compose_files_in_dir,
            commands::compose_parse,
            commands::compose_ps,
            commands::compose_up,
            commands::compose_down,
            commands::compose_start,
            commands::compose_stop,
            commands::compose_restart,
            commands::compose_build,
            commands::compose_pull,
            commands::compose_validate,
            commands::compose_logs,
            commands::compose_read_file,
            commands::compose_write_file,
            commands::compose_service_details,
            commands::compose_from_run,
            // saved connections
            commands::connections_list,
            commands::connection_save,
            commands::connection_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
