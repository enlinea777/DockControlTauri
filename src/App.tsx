import { useEffect, type MouseEvent } from "react";
import { Layout, Menu, Space, Switch, Tag, Typography } from "antd";
import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PictureOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, onDockerEvent } from "./api";
import { useStore } from "./store";
import WindowControls from "./components/WindowControls";
import Connect from "./pages/Connect";
import Projects from "./pages/Projects";
import Containers from "./pages/Containers";
import Stats from "./pages/Stats";
import Ports from "./pages/Ports";
import Images from "./pages/Images";
import System from "./pages/System";
import Settings, { isAutoConnectEnabled } from "./pages/Settings";

const { Header, Content } = Layout;

const appWindow = getCurrentWindow();

function onHeaderMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (
    target.closest(
      "button, a, input, .ant-menu-item, .ant-switch, .ant-checkbox, .ant-tag, .wc",
    )
  ) {
    return;
  }
  appWindow.startDragging();
}

export default function App() {
  const connection = useStore((s) => s.connection);
  const serverVersion = useStore((s) => s.serverVersion);
  const bumpEvent = useStore((s) => s.bumpEvent);
  const setConnection = useStore((s) => s.setConnection);
  const setVersion = useStore((s) => s.setVersion);
  const showStopped = useStore((s) => s.showStopped);
  const setShowStopped = useStore((s) => s.setShowStopped);
  const bumpRefresh = useStore((s) => s.bumpRefresh);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (connection || !isAutoConnectEnabled()) return;
    let cancelled = false;
    (async () => {
      try {
        const config = await api.connectLocal();
        if (cancelled) return;
        setConnection(config);
        try {
          const version = await api.dockerVersion();
          setVersion(String(version.Version ?? ""), String(version.ApiVersion ?? ""));
        } catch {
          /* ignore */
        }
      } catch {
        /* no local docker available; stay on connect screen */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, setConnection, setVersion]);

  useEffect(() => {
    if (!connection) return;
    let unlisten: (() => void) | undefined;
    onDockerEvent(() => bumpEvent()).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [connection, bumpEvent]);

  if (!connection) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Header
          data-tauri-drag-region
          onMouseDown={onHeaderMouseDown}
          style={{ display: "flex", alignItems: "center", gap: 16 }}
        >
          <WindowControls />
          <Typography.Text
            data-tauri-drag-region
            strong
            style={{ color: "#fff", fontSize: 18 }}
          >
            DockControl
          </Typography.Text>
        </Header>
        <Connect />
      </Layout>
    );
  }

  const items = [
    { key: "/projects", icon: <UnorderedListOutlined />, label: "Proyectos" },
    { key: "/containers", icon: <AppstoreOutlined />, label: "Contenedores" },
    { key: "/stats", icon: <BarChartOutlined />, label: "Stats Monitor" },
    { key: "/ports", icon: <ApiOutlined />, label: "Puertos" },
    { key: "/images", icon: <PictureOutlined />, label: "Imágenes" },
    { key: "/system", icon: <InfoCircleOutlined />, label: "Sistema" },
    { key: "/connect", icon: <LinkOutlined />, label: "Conexiones" },
    { key: "/settings", icon: <SettingOutlined />, label: "Preferencias" },
  ];

  return (
    <Layout style={{ height: "100vh" }}>
      <Header
        data-tauri-drag-region
        onMouseDown={onHeaderMouseDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <WindowControls />
        <Typography.Text
          data-tauri-drag-region
          strong
          style={{ color: "#fff", fontSize: 18 }}
        >
          DockControl
        </Typography.Text>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          onClick={(e) => {
            if (e.key === location.pathname) {
              bumpRefresh();
            } else {
              navigate(e.key);
            }
          }}
          items={items}
          style={{ flex: 1, minWidth: 0, borderBottom: "none" }}
        />
        <Space size="small">
          <Typography.Text style={{ color: "#c9d1d9", fontSize: 12 }}>
            Mostrar detenidos
          </Typography.Text>
          <Switch
            size="small"
            checked={showStopped}
            onChange={setShowStopped}
          />
          <Tag color="green">{connection.name}</Tag>
          {serverVersion && <Tag>Docker {serverVersion}</Tag>}
        </Space>
      </Header>
      <Content style={{ height: "calc(100vh - 48px)", overflow: "hidden" }}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/ports" element={<Ports />} />
          <Route path="/images" element={<Images />} />
          <Route path="/system" element={<System />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/projects" />} />
        </Routes>
      </Content>
    </Layout>
  );
}
