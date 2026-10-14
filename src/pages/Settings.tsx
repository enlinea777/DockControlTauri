import { useState } from "react";
import {
  Card,
  Descriptions,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useStore } from "../store";

const AUTO_CONNECT_KEY = "dockstation.autoConnect";

export function isAutoConnectEnabled(): boolean {
  return localStorage.getItem(AUTO_CONNECT_KEY) !== "false";
}

export default function Settings() {
  const connection = useStore((s) => s.connection);
  const serverVersion = useStore((s) => s.serverVersion);
  const [autoConnect, setAutoConnect] = useState(isAutoConnectEnabled());

  const toggle = (value: boolean) => {
    setAutoConnect(value);
    localStorage.setItem(AUTO_CONNECT_KEY, value ? "true" : "false");
  };

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card title="Preferencias">
          <Space direction="vertical" size="middle">
            <Space>
              <Switch checked={autoConnect} onChange={toggle} />
              <Typography.Text>
                Conectar automáticamente al Docker local al iniciar
              </Typography.Text>
            </Space>
          </Space>
        </Card>

        <Card title="Conexión actual">
          {connection ? (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Nombre">
                {connection.name}
              </Descriptions.Item>
              <Descriptions.Item label="Host">
                {connection.host || "local"}
              </Descriptions.Item>
              <Descriptions.Item label="Versión Docker">
                {serverVersion ? (
                  <Tag>Docker {serverVersion}</Tag>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Text type="secondary">Sin conexión</Typography.Text>
          )}
        </Card>
      </Space>
    </div>
  );
}
