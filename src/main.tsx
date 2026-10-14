import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme as antdTheme } from "antd";
import { HashRouter } from "react-router-dom";
import "antd/dist/reset.css";
import App from "./App";
import { api } from "./api";
import { useStore } from "./store";
import "./styles.css";

const report = (level: string, message: string) => {
  api.frontendLog(level, message).catch(() => undefined);
};

window.addEventListener("error", (event) => {
  report("error", `window-error: ${event.message} @ ${event.filename}:${event.lineno}`);
});

window.addEventListener("unhandledrejection", (event) => {
  report("error", `unhandled-rejection: ${String((event as PromiseRejectionEvent).reason)}`);
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    report("error", `react-boundary: ${error.message}\n${error.stack ?? ""}`);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace" }}>
          <h2>Error en la interfaz</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error.stack ?? this.state.error.message)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const themeMode = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const dark = themeMode === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: dark
          ? {
              colorPrimary: "#bd93f9",
              colorInfo: "#8be9fd",
              colorBgBase: "#282a36",
              colorTextBase: "#f8f8f2",
              borderRadius: 6,
            }
          : { colorPrimary: "#1769aa" },
      }}
    >
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
