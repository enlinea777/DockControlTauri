import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { api, onPull, type ImageSummary } from "../api";
import Workbench from "../components/Workbench";
import SideList from "../components/SideList";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function imageName(img: ImageSummary): string {
  return img.RepoTags?.[0] ?? img.Id.replace("sha256:", "").slice(0, 12);
}

export default function Images() {
  const [rows, setRows] = useState<ImageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ImageSummary | null>(null);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullLines, setPullLines] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const pullId = useRef<string | null>(null);
  const [pullForm] = Form.useForm();
  const [tagForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.imagesList(true);
      setRows(data);
      setSelected((prev) =>
        prev ? (data.find((i) => i.Id === prev.Id) ?? null) : null,
      );
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    onPull((event) => {
      if (!active || event.id !== pullId.current) return;
      const info = event.info ?? {};
      const text = info.status ?? info.error ?? JSON.stringify(event);
      const progress = info.progress ? ` ${info.progress}` : "";
      setPullLines((lines) => [...lines, `${text}${progress}`]);
      if (event.stage === "done") {
        message.success("Descarga completada");
        load();
      }
      if (event.stage === "error") message.error(event.message ?? "Error");
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [load]);

  const ordered = useMemo(
    () =>
      [...rows].sort((a, b) =>
        imageName(a).localeCompare(imageName(b)),
      ),
    [rows],
  );

  const doPull = async (values: { image: string }) => {
    setPullLines([]);
    setPullOpen(true);
    try {
      pullId.current = await api.imagePull(values.image);
    } catch (e) {
      message.error(String(e));
    }
  };

  const list = (
    <SideList
      placeholder="Buscar imagen"
      items={ordered}
      keyOf={(i) => i.Id}
      searchText={(i) => `${i.RepoTags?.join(" ") ?? ""} ${i.Id}`}
      selectedKey={selected?.Id ?? null}
      onSelect={(i) => setSelected(i)}
      renderItem={(img) => (
        <>
          <span className="side-item-name">
            <span className="status-dot status-dot-running" />
            {imageName(img)}
          </span>
          <span className="side-item-meta">{formatSize(img.Size)}</span>
        </>
      )}
    />
  );

  return (
    <Workbench list={list}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refrescar
        </Button>
        <Button
          type="primary"
          icon={<CloudDownloadOutlined />}
          onClick={() => {
            pullForm.resetFields();
            setPullOpen(true);
          }}
        >
          Descargar imagen
        </Button>
      </Space>

      {selected ? (
        <>
          <div className="detail-toolbar">
            <Space wrap>
              <Button
                icon={<TagOutlined />}
                onClick={() => {
                  setTagOpen(true);
                  tagForm.resetFields();
                }}
              >
                Etiquetar
              </Button>
              <Popconfirm
                title="¿Eliminar imagen?"
                onConfirm={async () => {
                  try {
                    await api.imageRemove(selected.Id, true);
                    setSelected(null);
                    await load();
                  } catch (e) {
                    message.error(String(e));
                  }
                }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Eliminar
                </Button>
              </Popconfirm>
            </Space>
          </div>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="ID">{selected.Id}</Descriptions.Item>
            <Descriptions.Item label="Tamaño">
              {formatSize(selected.Size)}
            </Descriptions.Item>
            <Descriptions.Item label="Tags">
              <Space wrap>
                {(selected.RepoTags ?? []).length
                  ? selected.RepoTags!.map((t) => <Tag key={t}>{t}</Tag>)
                  : "<none>"}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Digests">
              <Space direction="vertical" size={0}>
                {(selected.RepoDigests ?? []).length
                  ? selected.RepoDigests!.map((d) => (
                      <Typography.Text key={d} style={{ fontSize: 12 }}>
                        {d}
                      </Typography.Text>
                    ))
                  : "-"}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </>
      ) : (
        <div className="center-empty">
          <Empty description="Selecciona una imagen de la lista" />
        </div>
      )}

      <Modal
        title="Descargar imagen"
        open={pullOpen}
        footer={null}
        onCancel={() => setPullOpen(false)}
      >
        <Form form={pullForm} layout="inline" onFinish={doPull}>
          <Form.Item
            name="image"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="nginx:latest" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Descargar
          </Button>
        </Form>
        <div
          style={{
            marginTop: 12,
            maxHeight: 260,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {pullLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </Modal>

      <Modal
        open={tagOpen}
        title="Etiquetar imagen"
        onCancel={() => setTagOpen(false)}
        onOk={async () => {
          const values = await tagForm.validateFields();
          try {
            await api.imageTag(selected!.Id, values.repo, values.tag);
            message.success("Etiquetada");
            setTagOpen(false);
            await load();
          } catch (e) {
            message.error(String(e));
          }
        }}
      >
        <Form form={tagForm} layout="vertical">
          <Form.Item name="repo" label="Repositorio" rules={[{ required: true }]}>
            <Input placeholder="usuario/imagen" />
          </Form.Item>
          <Form.Item name="tag" label="Tag" initialValue="latest">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Workbench>
  );
}
