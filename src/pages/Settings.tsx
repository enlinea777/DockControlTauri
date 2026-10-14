import { useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Input,
  Radio,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { useStore } from "../store";
import { api } from "../api";

const AUTO_CONNECT_KEY = "dockstation.autoConnect";

export function isAutoConnectEnabled(): boolean {
  return localStorage.getItem(AUTO_CONNECT_KEY) !== "false";
}

const SHELL_PRESETS = ["bash", "sh", "ash", "zsh"];

export default function Settings() {
  const connection = useStore((s) => s.connection);
  const serverVersion = useStore((s) => s.serverVersion);
  const shell = useStore((s) => s.shell);
  const setShell = useStore((s) => s.setShell);
  const [autoConnect, setAutoConnect] = useState(isAutoConnectEnabled());
  const [custom, setCustom] = useState(!SHELL_PRESETS.includes(shell));
  const [customValue, setCustomValue] = useState(
    SHELL_PRESETS.includes(shell) ? "" : shell,
  );

  const toggle = (value: boolean) => {
    setAutoConnect(value);
    localStorage.setItem(AUTO_CONNECT_KEY, value ? "true" : "false");
  };

  const general = (
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
            <Descriptions.Item label="Nombre">{connection.name}</Descriptions.Item>
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

      <Card title="Mantenimiento">
        <Space direction="vertical">
          <Typography.Text type="secondary">
            Elimina sockets temporales bloqueados (prefijo <code>temp_socket</code>)
            que puedan haber quedado de conexiones SSH anteriores.
          </Typography.Text>
          <Button
            onClick={async () => {
              try {
                const n = await api.cleanupTempSockets();
                message.success(`Eliminados ${n} archivo(s) temporal(es)`);
              } catch (e) {
                message.error(String(e));
              }
            }}
          >
            Limpiar sockets temporales
          </Button>
        </Space>
      </Card>
    </Space>
  );

  const consoleTab = (
    <Card title="Consola (Exec)">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          Shell que se usará al abrir la consola de un contenedor (botón Exec).
          También se usará para el terminal del sistema.
        </Typography.Text>
        <Radio.Group
          value={custom ? "custom" : shell}
          onChange={(e) => {
            if (e.target.value === "custom") {
              setCustom(true);
            } else {
              setCustom(false);
              setShell(e.target.value);
            }
          }}
        >
          <Space direction="vertical">
            {SHELL_PRESETS.map((s) => (
              <Radio key={s} value={s}>
                {s}
              </Radio>
            ))}
            <Radio value="custom">Personalizado</Radio>
          </Space>
        </Radio.Group>

        {custom && (
          <Space>
            <Input
              value={customValue}
              placeholder="p. ej. bash -i  ó  /bin/sh"
              onChange={(e) => setCustomValue(e.target.value)}
              style={{ width: 320 }}
            />
            <Button
              type="primary"
              onClick={() => {
                if (customValue.trim()) {
                  setShell(customValue.trim());
                  message.success(`Shell personalizado: ${customValue.trim()}`);
                }
              }}
            >
              Guardar
            </Button>
          </Space>
        )}

        <Typography.Text>
          Shell actual: <Tag color="blue">{shell}</Tag>
        </Typography.Text>
      </Space>
    </Card>
  );

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
      <Tabs
        items={[
          { key: "general", label: "General", children: general },
          { key: "console", label: "Consola", children: consoleTab },
        ]}
      />
    </div>
  );
}
