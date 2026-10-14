import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ConnectionConfig {
  name: string;
  host: string;
}

export interface ContextInfo {
  name: string;
  description: string;
  docker_endpoint: string;
  current: boolean;
}

export interface ComposeProject {
  Name: string;
  Status: string;
  ConfigFiles: string;
}

export interface ComposePsEntry {
  ID: string;
  Name: string;
  Image: string;
  Service: string;
  State: string;
  Status: string;
  Health: string;
  ExitCode: number;
  Ports: string;
  Publishers: unknown[];
  RunningFor: string;
  Project: string;
}

export interface ComposeServiceSummary {
  name: string;
  image?: string;
  build?: string;
  ports: string[];
  container_name?: string;
  restart?: string;
}

export interface ComposeFile {
  path: string;
  name?: string;
  version?: string;
  services: ComposeServiceSummary[];
  raw: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  status: number;
}

export interface PortSummary {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type?: string;
}

export interface ContainerSummary {
  Id?: string;
  Names?: string[];
  Image?: string;
  ImageID?: string;
  Command?: string;
  Created?: number;
  State?: string;
  Status?: string;
  Ports?: PortSummary[];
  Labels?: Record<string, string>;
}

export interface ImageSummary {
  Id: string;
  RepoTags?: string[];
  RepoDigests?: string[];
  Created: number;
  Size: number;
}

export const api = {
  connectHost: (host: string, name?: string) =>
    invoke<ConnectionConfig>("connect_host", { host, name }),
  connectContext: (context: string) =>
    invoke<ConnectionConfig>("connect_context", { context }),
  connectLocal: () => invoke<ConnectionConfig>("connect_local"),
  frontendLog: (level: string, message: string) =>
    invoke<void>("frontend_log", { level, message }),
  currentConnection: () => invoke<ConnectionConfig>("current_connection"),
  listContexts: () => invoke<ContextInfo[]>("list_contexts"),
  resolveHost: (spec: string) => invoke<string>("resolve_host", { spec }),

  dockerVersion: () => invoke<Record<string, unknown>>("docker_version"),
  dockerInfo: () => invoke<Record<string, any>>("docker_info"),
  dockerPing: () => invoke<string>("docker_ping"),
  dockerDf: () => invoke<any>("docker_df"),
  dockerEvents: () => invoke<string>("docker_events"),

  containersList: (all: boolean) =>
    invoke<ContainerSummary[]>("containers_list", { all }),
  containerStart: (id: string) => invoke<void>("container_start", { id }),
  containerStop: (id: string) => invoke<void>("container_stop", { id }),
  containerRestart: (id: string) => invoke<void>("container_restart", { id }),
  containerRemove: (id: string, force: boolean) =>
    invoke<void>("container_remove", { id, force }),
  containerInspect: (id: string) =>
    invoke<any>("container_inspect", { id }),
  containerTop: (id: string) => invoke<any>("container_top", { id }),
  containerLogs: (id: string, tail?: number, follow?: boolean) =>
    invoke<string>("container_logs", { id, tail, follow }),
  containerStats: (id: string) => invoke<string>("container_stats", { id }),
  containerExec: (id: string, cmd: string[], user?: string) =>
    invoke<string>("container_exec", { id, cmd, user }),
  containerExecStart: (id: string, cmd: string[], cols: number, rows: number) =>
    invoke<string>("container_exec_start", { id, cmd, cols, rows }),
  containerExecWrite: (session: string, data: string) =>
    invoke<void>("container_exec_write", { session, data }),
  containerExecResize: (session: string, cols: number, rows: number) =>
    invoke<void>("container_exec_resize", { session, cols, rows }),
  containerExecStop: (session: string) =>
    invoke<void>("container_exec_stop", { session }),
  containerExecSystem: (id: string, shell: string) =>
    invoke<void>("container_exec_system", { id, shell }),
  cleanupTempSockets: () => invoke<number>("cleanup_temp_sockets"),

  imagesList: (all: boolean) => invoke<ImageSummary[]>("images_list", { all }),
  imageInspect: (name: string) => invoke<any>("image_inspect", { name }),
  imageRemove: (id: string, force: boolean) =>
    invoke<void>("image_remove", { id, force }),
  imageTag: (id: string, repo: string, tag: string) =>
    invoke<void>("image_tag", { id, repo, tag }),
  imagePull: (name: string) => invoke<string>("image_pull", { name }),

  composeLs: () => invoke<ComposeProject[]>("compose_ls"),
  composeFilesInDir: (dir: string) =>
    invoke<string[]>("compose_files_in_dir", { dir }),
  composeParse: (path: string) => invoke<ComposeFile>("compose_parse", { path }),
  composePs: (files: string[], project?: string) =>
    invoke<ComposePsEntry[]>("compose_ps", { files, project }),
  composeUp: (files: string[], project?: string, detach = true, build = false) =>
    invoke<CommandResult>("compose_up", { files, project, detach, build }),
  composeDown: (files: string[], project?: string, volumes = false) =>
    invoke<CommandResult>("compose_down", { files, project, volumes }),
  composeStart: (files: string[], project?: string, service?: string) =>
    invoke<CommandResult>("compose_start", { files, project, service }),
  composeStop: (files: string[], project?: string, service?: string) =>
    invoke<CommandResult>("compose_stop", { files, project, service }),
  composeRestart: (files: string[], project?: string, service?: string) =>
    invoke<CommandResult>("compose_restart", { files, project, service }),
  composeBuild: (files: string[], project?: string, service?: string) =>
    invoke<CommandResult>("compose_build", { files, project, service }),
  composePull: (files: string[], project?: string) =>
    invoke<CommandResult>("compose_pull", { files, project }),
  composeValidate: (files: string[], project?: string) =>
    invoke<CommandResult>("compose_validate", { files, project }),
  composeLogs: (
    files: string[],
    project?: string,
    service?: string,
    follow = true,
    tail = 200,
  ) =>
    invoke<string>("compose_logs", { files, project, service, follow, tail }),
  composeReadFile: (path: string) =>
    invoke<string>("compose_read_file", { path }),
  composeWriteFile: (path: string, content: string) =>
    invoke<void>("compose_write_file", { path, content }),
  composeServiceDetails: (path: string) =>
    invoke<Record<string, unknown>>("compose_service_details", { path }),
  composeFromRun: (command: string) =>
    invoke<string>("compose_from_run", { command }),

  connectionsList: () => invoke<ConnectionConfig[]>("connections_list"),
  connectionSave: (connection: ConnectionConfig) =>
    invoke<void>("connection_save", { connection }),
  connectionRemove: (name: string) =>
    invoke<void>("connection_remove", { name }),
};

export interface LogEvent {
  id: string;
  line: string;
  source?: string;
}

export interface StatsEvent {
  id: string;
  stats: any;
}

export function onLog(
  handler: (event: LogEvent) => void,
): Promise<UnlistenFn> {
  return listen<LogEvent>("docker-log", (e) => handler(e.payload));
}

export function onLogEnd(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<{ id: string }>("docker-log-end", (e) => handler(e.payload.id));
}

export function onStats(
  handler: (event: StatsEvent) => void,
): Promise<UnlistenFn> {
  return listen<StatsEvent>("docker-stats", (e) => handler(e.payload));
}

export interface ExecEvent {
  id: string;
  data: string;
}

export function onExec(
  handler: (event: ExecEvent) => void,
): Promise<UnlistenFn> {
  return listen<ExecEvent>("container-exec", (e) => handler(e.payload));
}

export function onExecEnd(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<{ id: string }>("container-exec-end", (e) =>
    handler(e.payload.id),
  );
}

export function onDockerEvent(
  handler: (event: any) => void,
): Promise<UnlistenFn> {
  return listen<any>("docker-event", (e) => handler(e.payload));
}

export function onPull(
  handler: (event: any) => void,
): Promise<UnlistenFn> {
  return listen<any>("docker-pull", (e) => handler(e.payload));
}
