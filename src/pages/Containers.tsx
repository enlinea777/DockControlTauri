import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CodeOutlined,
  DeleteOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  BarChartOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, type ContainerSummary } from "../api";
import { useStore } from "../store";
import LogViewer from "../components/LogViewer";
import StatsView from "../components/StatsView";
import Workbench from "../components/Workbench";
import SideList from "../components/SideList";
import InfoTree from "../components/InfoTree";

function cleanName(c: ContainerSummary): string {
  const raw = c.Names?.[0] ?? c.Id?.slice(0, 12) ?? "?";
  return raw.replace(/^\//, "");
}

function projectOf(c: ContainerSummary): string | undefined {
  return c.Labels?.["com.docker.compose.project"];
}

export default function Containers() {
  const [rows, setRows] = useState<ContainerSummary[]>([]);
  const [selected, setSelected] = useState<ContainerSummary | null>(null);
  const [pane, setPane] = useState<"logs" | "stats">("logs");
  const [infoOpen, setInfoOpen] = useState(false);
  const [info, setInfo] = useState<unknown>(null);
  const [execOpen, setExecOpen] = useState(false);
  const [execCmd, setExecCmd] = useState("ls -la");
  const [execOut, setExecOut] = useState("");
  const [execRunning, setExecRunning] = useState(false);
  const eventTick = useStore((s) => s.eventTick);
  const showStopped = useStore((s) => s.showStopped);
  const refreshTick = useStore((s) => s.refreshTick);

  const load = useCallback(async () => {
    try {
      const data = await api.containersList(showStopped);
      setRows(data);
      setSelected((prev) =>
        prev ? (data.find((c) => c.Id === prev.Id) ?? null) : null,
      );
    } catch (e) {
      message.error(String(e));
    }
  }, [showStopped]);

  useEffect(() => {
    load();
  }, [load, eventTick, refreshTick]);

  const ordered = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (a.State === "running" ? 0 : 1) - (b.State === "running" ? 0 : 1),
      ),
    [rows],
  );

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      message.error(String(e));
    }
  };

  const containerId = selected?.Id ?? "";
  const startLogs = useCallback(
    () => api.containerLogs(containerId, 200, true),
    [containerId],
  );
  const startStats = useCallback(
    () => api.containerStats(containerId),
    [containerId],
  );

  const openWeb = () => {
    const port = selected?.Ports?.find((p) => p.PublicPort)?.PublicPort;
    if (!port) {
      message.warning("El contenedor no publica ningún puerto");
      return;
    }
    openUrl(`http://localhost:${port}`).catch((e) => message.error(String(e)));
  };

  const openInfo = async () => {
    if (!selected) return;
    setInfoOpen(true);
    setInfo(null);
    try {
      setInfo(await api.containerInspect(selected.Id!));
    } catch (e) {
      message.error(String(e));
    }
  };

  const runExec = async () => {
    if (!selected) return;
    setExecRunning(true);
    setExecOut("");
    try {
      const out = await api.containerExec(selected.Id!, ["sh", "-c", execCmd]);
      setExecOut(out || "(sin salida)");
    } catch (e) {
      setExecOut(String(e));
    } finally {
      setExecRunning(false);
    }
  };

  const list = (
    <SideList
      placeholder="Buscar contenedor"
      items={ordered}
      keyOf={(c) => c.Id ?? cleanName(c)}
      searchText={(c) => `${cleanName(c)} ${c.Image ?? ""}`}
      selectedKey={selected?.Id ?? null}
      onSelect={(c) => {
        setSelected(c);
        setPane("logs");
      }}
      renderItem={(c) => (
        <>
          <span className="side-item-name">
            <span
              className={
                "status-dot" + (c.State === "running" ? " status-dot-running" : "")
              }
            />
            {cleanName(c)}
          </span>
          <span className="side-item-meta">{c.Image}</span>
          <span className="side-item-meta">{c.Status || c.State}</span>
        </>
      )}
    />
  );

  return (
    <Workbench list={list}>
      {selected ? (
        <>
          <div className="detail-toolbar">
            <div className="action-bar">
              <div className="action">
                <Tooltip title="Web">
                  <Button
                    className="round-btn"
                    shape="circle"
                    icon={<GlobalOutlined />}
                    onClick={openWeb}
                  />
                </Tooltip>
                <span className="action-label">Web</span>
              </div>
              <div className="action">
                <Tooltip title="Exec">
                  <Button
                    className="round-btn"
                    shape="circle"
                    icon={<CodeOutlined />}
                    onClick={() => {
                      setExecOut("");
                      setExecOpen(true);
                    }}
                  />
                </Tooltip>
                <span className="action-label">Exec</span>
              </div>
              <div className="action">
                {selected.State === "running" ? (
                  <Tooltip title="Stop">
                    <Button
                      className="round-btn"
                      shape="circle"
                      icon={<StopOutlined />}
                      onClick={() => act(() => api.containerStop(selected.Id!))}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title="Start">
                    <Button
                      className="round-btn"
                      shape="circle"
                      icon={<PlayCircleOutlined />}
                      onClick={() => act(() => api.containerStart(selected.Id!))}
                    />
                  </Tooltip>
                )}
                <span className="action-label">
                  {selected.State === "running" ? "Stop" : "Start"}
                </span>
              </div>
              <div className="action">
                <Tooltip title="Restart">
                  <Button
                    className="round-btn"
                    shape="circle"
                    icon={<ReloadOutlined />}
                    onClick={() => act(() => api.containerRestart(selected.Id!))}
                  />
                </Tooltip>
                <span className="action-label">Restart</span>
              </div>
              <div className="action">
                <Popconfirm
                  title="¿Eliminar contenedor?"
                  onConfirm={() => act(() => api.containerRemove(selected.Id!, true))}
                >
                  <Tooltip title="Remove">
                    <Button
                      className="round-btn"
                      shape="circle"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
                <span className="action-label">Remove</span>
              </div>
              <div className="action">
                <Tooltip title="Info">
                  <Button
                    className="round-btn"
                    shape="circle"
                    icon={<InfoCircleOutlined />}
                    onClick={openInfo}
                  />
                </Tooltip>
                <span className="action-label">Info</span>
              </div>
            </div>

            <Space size="large">
              <span
                className={
                  "pane-toggle" + (pane === "logs" ? " pane-toggle-active" : "")
                }
                onClick={() => setPane("logs")}
              >
                <ReadOutlined /> logs
              </span>
              <span
                className={
                  "pane-toggle" + (pane === "stats" ? " pane-toggle-active" : "")
                }
                onClick={() => setPane("stats")}
              >
                <BarChartOutlined /> stats
              </span>
            </Space>
          </div>

          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color={selected.State === "running" ? "green" : "default"}>
              {selected.State === "running" ? "en ejecución" : selected.State}
            </Tag>
            {projectOf(selected) && <Tag color="blue">{projectOf(selected)}</Tag>}
          </Space>

          {pane === "logs" ? (
            <LogViewer key={`logs-${selected.Id}`} start={startLogs} />
          ) : (
            <StatsView key={`stats-${selected.Id}`} start={startStats} />
          )}
        </>
      ) : (
        <div className="center-empty">
          <Empty description="Selecciona un contenedor de la lista" />
        </div>
      )}

      <Drawer
        open={infoOpen}
        width={720}
        title={selected ? cleanName(selected) : ""}
        onClose={() => setInfoOpen(false)}
      >
        {info ? (
          <InfoTree value={info} />
        ) : (
          <Typography.Text type="secondary">Cargando…</Typography.Text>
        )}
      </Drawer>

      <Modal
        open={execOpen}
        title="Ejecutar comando"
        onCancel={() => setExecOpen(false)}
        onOk={runExec}
        okText="Ejecutar"
        confirmLoading={execRunning}
        width={640}
      >
        <Input
          value={execCmd}
          onChange={(e) => setExecCmd(e.target.value)}
          placeholder="ls -la"
          onPressEnter={runExec}
        />
        <pre
          style={{
            marginTop: 12,
            maxHeight: 320,
            overflow: "auto",
            background: "#0b0f14",
            color: "#c9d1d9",
            padding: 8,
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {execRunning ? "Ejecutando…" : execOut}
        </pre>
      </Modal>
    </Workbench>
  );
}
