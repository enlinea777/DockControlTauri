import { useEffect, useState } from "react";
import {
  Button,
  Col,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ApiOutlined,
  CloudOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { api, type ConnectionConfig, type ContextInfo } from "../api";
import { useStore } from "../store";

export default function Connect() {
  const setConnection = useStore((s) => s.setConnection);
  const setVersion = useStore((s) => s.setVersion);
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [saved, setSaved] = useState<ConnectionConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    try {
      setContexts(await api.listContexts());
    } catch {
      setContexts([]);
    }
    try {
      setSaved(await api.connectionsList());
    } catch {
      setSaved([]);
    }
  };

  const finishConnect = async (name: string) => {
    const version = await api.dockerVersion();
    setVersion(
      String(version.Version ?? ""),
      String(version["ApiVersion"] ?? version.ApiVersion ?? ""),
    );
    setConnection({ name, host: "" });
    message.success(`Conectado a ${name}`);
  };

  const connectContext = async (ctx: string) => {
    setLoading(true);
    try {
      const conn = await api.connectContext(ctx);
      await finishConnect(conn.name);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const connectHost = async (values: { name: string; host: string }) => {
    setLoading(true);
    try {
      const conn = await api.connectHost(values.host, values.name);
      await api.connectionSave(conn);
      await finishConnect(conn.name);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const removeSaved = async (name: string) => {
    await api.connectionRemove(name);
    load();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
      <Row gutter={24}>
      <Col span={12}>
        <Typography.Title level={4}>
          <CloudOutlined /> Contextos de Docker
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Los contextos reemplazan a Docker Machine. Selecciona un host local o
          remoto administrado por <code>docker context</code>.
        </Typography.Paragraph>
        <Space direction="vertical" style={{ width: "100%" }}>
          {contexts.map((ctx) => (
            <Space key={ctx.name}>
              <Tag color={ctx.current ? "green" : "default"}>
                {ctx.current ? "actual" : "contexto"}
              </Tag>
              <Typography.Text strong>{ctx.name}</Typography.Text>
              <Typography.Text type="secondary">
                {ctx.docker_endpoint}
              </Typography.Text>
              <a onClick={() => connectContext(ctx.name)}>Conectar</a>
            </Space>
          ))}
        </Space>

        <Typography.Title level={4} style={{ marginTop: 24 }}>
          Conexiones guardadas
        </Typography.Title>
        <Space direction="vertical" style={{ width: "100%" }}>
          {saved.map((conn) => (
            <Space key={conn.name}>
              <ApiOutlined />
              <Typography.Text>{conn.name}</Typography.Text>
              <Typography.Text type="secondary">{conn.host}</Typography.Text>
              <a
                onClick={async () => {
                  setLoading(true);
                  try {
                    await api.connectHost(conn.host, conn.name);
                    await finishConnect(conn.name);
                  } catch (e) {
                    message.error(String(e));
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Conectar
              </a>
              <a onClick={() => removeSaved(conn.name)}>
                <DeleteOutlined />
              </a>
            </Space>
          ))}
        </Space>
      </Col>

      <Col span={12}>
        <Typography.Title level={4}>
          <PlusOutlined /> Añadir conexión manual
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Acepta <code>unix://</code>, <code>tcp://</code>, <code>ssh://</code>,{" "}
          <code>npipe://</code> o el nombre de un contexto.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={connectHost}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="mi-servidor" />
          </Form.Item>
          <Form.Item name="host" label="Host" rules={[{ required: true }]}>
            <Input placeholder="ssh://user@host" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Conectar
          </Button>
        </Form>
        {loading && (
          <Typography.Paragraph style={{ marginTop: 12 }}>
            <Tag color="processing">Conectando…</Tag>
          </Typography.Paragraph>
        )}
      </Col>
    </Row>
    </div>
  );
}
