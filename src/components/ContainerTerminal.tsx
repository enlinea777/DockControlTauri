import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { api, onExec, onExecEnd } from "../api";

interface Props {
  id: string;
  shell: string;
  height?: number;
}

export default function ContainerTerminal({ id, shell, height = 440 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = new Terminal({
      fontSize: 13,
      cursorBlink: true,
      fontFamily: "Menlo, Consolas, monospace",
      theme: {
        background: "#0b0f14",
        foreground: "#c9d1d9",
        cursor: "#c9d1d9",
      },
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    if (ref.current) {
      term.open(ref.current);
      fit.fit();
    }

    let session: string | null = null;
    let active = true;
    const disposers: Array<() => void> = [];
    const pending: Array<{ id: string; data: string }> = [];

    const dataDisp = term.onData((data) => {
      if (session) api.containerExecWrite(session, data).catch(() => undefined);
    });
    const resizeDisp = term.onResize(({ cols, rows }) => {
      if (session) api.containerExecResize(session, cols, rows).catch(() => undefined);
    });

    (async () => {
      const u1 = await onExec((event) => {
        if (!active) return;
        if (session === null) {
          pending.push(event);
          return;
        }
        if (event.id === session) term.write(event.data);
      });
      const u2 = await onExecEnd((sid) => {
        if (session && sid === session) {
          term.write("\r\n[sesión finalizada]\r\n");
        }
      });
      disposers.push(u1, u2);

      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;
        const cmd = shell.trim().split(/\s+/).filter(Boolean);
        const sid = await api.containerExecStart(id, cmd, cols, rows);
        session = sid;
        pending.filter((p) => p.id === sid).forEach((p) => term.write(p.data));
      } catch (e) {
        term.write(`\r\n[error] ${String(e)}\r\n`);
      }
    })();

    const handleResize = () => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
      dataDisp.dispose();
      resizeDisp.dispose();
      disposers.forEach((d) => d());
      if (session) api.containerExecStop(session).catch(() => undefined);
      term.dispose();
    };
  }, [id, shell]);

  return (
    <div
      ref={ref}
      style={{ height, background: "#0b0f14", padding: 4, borderRadius: 6 }}
    />
  );
}
