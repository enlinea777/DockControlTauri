import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CloudDownloadOutlined,
  CodeOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { open } from "@tauri-apps/plugin-dialog";
import { api, type ComposeProject, type ComposePsEntry } from "../api";
import { useStore } from "../store";
import LogViewer from "../components/LogViewer";
import Workbench from "../components/Workbench";
import SideList from "../components/SideList";

function filesOf(row: ComposeProject): string[] {
  return row.ConfigFiles.split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

function ProjectServices({ files, project }: { files: string[]; project: string }) {
  const [rows, setRows] = useState<ComposePsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const eventTick = useStore((s) => s.eventTick);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.composePs(files, project));
    } catch (e) {
      message.error(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [files, project]);

  useEffect(() => {
    load();
  }, [load, eventTick]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      message.error(String(e));
    }
  };

  return (
    <Table
      rowKey={(row) => row.ID || row.Service}
      loading={loading}
      dataSource={rows}
      pagination={false}
      size="small"
      columns={[
        {
          title: "Servicio",
          dataIndex: "Service",
          render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
        },
        {
          title: "Imagen",
          dataIndex: "Image",
          render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
        },
        {
          title: "Estado",
          render: (_: unknown, row: ComposePsEntry) => (
            <Tag color={row.State === "running" ? "green" : "default"}>
              {row.Status || row.State}
            </Tag>
          ),
        },
        { title: "Puertos", dataIndex: "Ports" },
        {
          title: "Acciones",
          render: (_: unknown, row: ComposePsEntry) => (
            <Space>
              <a onClick={() => run(() => api.composeStart(files, row.Project, row.Service))}>
                Iniciar
              </a>
              <a onClick={() => run(() => api.composeStop(files, row.Project, row.Service))}>
                Detener
              </a>
              <a onClick={() => run(() => api.composeRestart(files, row.Project, row.Service))}>
                Reiniciar
              </a>
            </Space>
          ),
        },
      ]}
    />
  );
}

function ComposeEditor({ files }: { files: string[] }) {
  const [path, setPath] = useState(files[0] ?? "");
  const [content, setContent] = useState("");
  const [runCommand, setRunCommand] = useState("");
  const [generated, setGenerated] = useState("");

  const loadFile = useCallback(async (p: string) => {
    if (!p) return;
    try {
      setContent(await api.composeReadFile(p));
    } catch (e) {
      message.error(String(e));
    }
  }, []);

  useEffect(() => {
    setPath(files[0] ?? "");
  }, [files]);

  useEffect(() => {
    loadFile(path);
  }, [path, loadFile]);

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space wrap>
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          style={{ width: 380 }}
        />
        <Button onClick={() => loadFile(path)}>Recargar</Button>
        <Button
          type="primary"
          onClick={async () => {
            try {
              await api.composeWriteFile(path, content);
              message.success("Guardado");
            } catch (e) {
              message.error(String(e));
            }
          }}
        >
          Guardar
        </Button>
      </Space>
      <Input.TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoSize={{ minRows: 16, maxRows: 28 }}
        style={{ fontFamily: "monospace" }}
      />
      <Typography.Title level={5}>
        Importar desde <code>docker run</code>
      </Typography.Title>
      <Space wrap>
        <Input
          value={runCommand}
          onChange={(e) => setRunCommand(e.target.value)}
          placeholder="docker run -p 8080:80 -e FOO=bar nginx"
          style={{ width: 380 }}
        />
        <Button
          onClick={async () => {
            try {
              setGenerated(await api.composeFromRun(runCommand));
            } catch (e) {
              message.error(String(e));
            }
          }}
        >
          Convertir
        </Button>
      </Space>
      {generated && (
        <Input.TextArea
          value={generated}
          readOnly
          autoSize={{ minRows: 6, maxRows: 12 }}
          style={{ fontFamily: "monospace" }}
        />
      )}
    </Space>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<ComposeProject[]>([]);
  const [selected, setSelected] = useState<ComposeProject | null>(null);
  const eventTick = useStore((s) => s.eventTick);

  const reload = useCallback(async () => {
    try {
      const data = await api.composeLs();
      setProjects(data);
      setSelected((prev) =>
        prev ? (data.find((p) => p.Name === prev.Name) ?? null) : null,
      );
    } catch (e) {
      message.error(String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload, eventTick]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      message.error(String(e));
    }
  };

  const addProject = async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (!dir || Array.isArray(dir)) return;
      const files = await api.composeFilesInDir(dir as string);
      if (files.length === 0) {
        message.warning("No se encontraron archivos compose en el directorio");
        return;
      }
      const parsed = await api.composeParse(files[0]);
      await api.composeUp(files, parsed.name);
      message.success(`Proyecto levantado (${parsed.services.length} servicios)`);
      await reload();
    } catch (e) {
      message.error(String(e));
    }
  };

  const selectedFiles = selected ? filesOf(selected) : [];

  const list = (
    <SideList
      placeholder="Buscar proyecto"
      items={projects}
      keyOf={(p) => p.Name}
      searchText={(p) => `${p.Name} ${p.ConfigFiles}`}
      selectedKey={selected?.Name ?? null}
      onSelect={(p) => setSelected(p)}
      renderItem={(p) => (
        <>
          <span className="side-item-name">
            <span
              className={
                "status-dot" +
                (p.Status?.includes("running")
                  ? " status-dot-running"
                  : "")
              }
            />
            {p.Name}
          </span>
          <span className="side-item-meta">{p.Status || "parado"}</span>
        </>
      )}
    />
  );

  return (
    <Workbench list={list}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button type="primary" icon={<FolderOpenOutlined />} onClick={addProject}>
          Añadir proyecto
        </Button>
        <Button icon={<ReloadOutlined />} onClick={reload}>
          Refrescar
        </Button>
        <Popconfirm
          title="¿Detener todos los proyectos?"
          onConfirm={async () => {
            for (const p of projects) {
              try {
                await api.composeDown(filesOf(p), p.Name);
              } catch {
                /* ignore */
              }
            }
            await reload();
          }}
        >
          <Button danger icon={<StopOutlined />}>
            Detener todos
          </Button>
        </Popconfirm>
      </Space>

      {selected ? (
        <>
          <div className="detail-toolbar">
            <Space>
              <Tag color={selected.Status?.includes("running") ? "green" : "default"}>
                {selected.Status || "parado"}
              </Tag>
            </Space>
            <Space wrap>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => run(() => api.composeUp(selectedFiles, selected.Name))}
              >
                Up
              </Button>
              <Button
                icon={<StopOutlined />}
                onClick={() => run(() => api.composeDown(selectedFiles, selected.Name))}
              >
                Down
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => run(() => api.composeRestart(selectedFiles, selected.Name))}
              >
                Reiniciar
              </Button>
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={() => run(() => api.composePull(selectedFiles, selected.Name))}
              >
                Pull
              </Button>
            </Space>
          </div>
          <Tabs
            items={[
              {
                key: "services",
                label: "Servicios",
                children: (
                  <ProjectServices files={selectedFiles} project={selected.Name} />
                ),
              },
              {
                key: "logs",
                label: "Logs",
                children: (
                  <LogViewer
                    start={() =>
                      api.composeLogs(selectedFiles, selected.Name, undefined, true, 200)
                    }
                  />
                ),
              },
              {
                key: "editor",
                label: (
                  <span>
                    <CodeOutlined /> Editor
                  </span>
                ),
                children: (
                  <ComposeEditor files={selectedFiles} />
                ),
              },
            ]}
          />
        </>
      ) : (
        <div className="center-empty">
          <Empty description="Selecciona un proyecto de la lista" />
        </div>
      )}
    </Workbench>
  );
}
