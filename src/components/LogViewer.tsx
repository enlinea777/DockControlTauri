import { useEffect, useRef, useState } from "react";
import { onLog, type LogEvent } from "../api";

interface Props {
  start: () => Promise<string>;
  height?: number;
}

const MAX_LINES = 5000;

export default function LogViewer({ start, height = 460 }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unlisten = useRef<Array<() => void>>([]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let sid: string | null = null;
    const pending: LogEvent[] = [];

    const append = (line: string) =>
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });

    (async () => {
      const u1 = await onLog((event) => {
        if (!active) return;
        if (sid === null) {
          pending.push(event);
          return;
        }
        if (event.id === sid) append(event.line);
      });
      unlisten.current = [u1];

      try {
        const uid = await start();
        sid = uid;
        pending
          .filter((e) => e.id === uid)
          .forEach((e) => append(e.line));
      } catch (e) {
        setError(String(e));
      }
    })();

    return () => {
      active = false;
      unlisten.current.forEach((fn) => fn());
      unlisten.current = [];
    };
  }, [start]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "auto" });
  }, [lines]);

  return (
    <div
      style={{
        height,
        overflow: "auto",
        background: "#0b0f14",
        color: "#c9d1d9",
        fontFamily: "monospace",
        fontSize: 12,
        padding: 8,
        borderRadius: 6,
        whiteSpace: "pre-wrap",
      }}
    >
      {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      <div ref={bottom} />
    </div>
  );
}
