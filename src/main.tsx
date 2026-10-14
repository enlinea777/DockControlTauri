import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import { HashRouter } from "react-router-dom";
import "antd/dist/reset.css";
import App from "./App";
import { api } from "./api";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: "#1769aa" },
      }}
    >
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
      </ErrorBoundary>
    </ConfigProvider>
  </React.StrictMode>,
);
