import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Table, Typography, message } from "antd";
import { api, onStats, type ContainerSummary } from "../api";
import { useStore } from "../store";
import { fmtBytes, readRaw, type RawStats } from "../lib/stats";
import Workbench from "../components/Workbench";
import SideList from "../components/SideList";

interface Live {
  raw: RawStats;
  netRx: number;
  netTx: number;
  ioRead: number;
  ioWrite: number;
}

interface MetricRow {
  key: string;
  name: string;
  shortId: string;
  cpu: number;
  memUsed: number;
  memLimit: number;
  netRx: number;
  netTx: number;
  ioRead: number;
  ioWrite: number;
  pids: number;
}

function cleanName(c: ContainerSummary): string {
  const raw = c.Names?.[0] ?? c.Id?.slice(0, 12) ?? "?";
  return raw.replace(/^\//, "");
}

export default function Stats() {
  const [rows, setRows] = useState<ContainerSummary[]>([]);
  const [data, setData] = useState<Record<string, Live>>({});
  const eventTick = useStore((s) => s.eventTick);
  const refreshTick = useStore((s) => s.refreshTick);
  const statsSelection = useStore((s) => s.statsSelection);
  const toggleStatsSelection = useStore((s) => s.toggleStatsSelection);

  const streamMap = useRef<Map<string, string>>(new Map());
  const started = useRef<Set<string>>(new Set());
  const prev = useRef<Map<string, { raw: RawStats; time: number }>>(new Map());

  const load = useCallback(async () => {
    try {
      setRows(await api.containersList(true));
    } catch (e) {
      message.error(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, eventTick, refreshTick]);

  const running = useMemo(
    () => rows.filter((c) => c.State === "running"),
    [rows],
  );

  const targets = useMemo(() => {
    if (statsSelection.length === 0) return running;
    return running.filter((c) => statsSelection.includes(c.Id ?? ""));
  }, [running, statsSelection]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    onStats((event) => {
      if (!active) return;
      const cid = streamMap.current.get(event.id);
      if (!cid) return;
      const raw = readRaw(event.stats);
      const now = Date.now();
      const last = prev.current.get(cid);
      const dt = last ? (now - last.time) / 1000 : 0;
      const rate = (curr: number, before: number) =>
        last && dt > 0 ? Math.max(0, (curr - before) / dt) : 0;
      prev.current.set(cid, { raw, time: now });
      setData((d) => ({
        ...d,
        [cid]: {
          raw,
          netRx: rate(raw.netRx, last?.raw.netRx ?? 0),
          netTx: rate(raw.netTx, last?.raw.netTx ?? 0),
          ioRead: rate(raw.ioRead, last?.raw.ioRead ?? 0),
          ioWrite: rate(raw.ioWrite, last?.raw.ioWrite ?? 0),
        },
      }));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    targets.forEach((c) => {
      const id = c.Id;
      if (!id || started.current.has(id)) return;
      started.current.add(id);
      api
        .containerStats(id)
        .then((sid) => streamMap.current.set(sid, id))
        .catch(() => started.current.delete(id));
    });
  }, [targets]);

  const metricRows = useMemo<MetricRow[]>(() => {
    return targets.map((c) => {
      const id = c.Id ?? "";
      const live = data[id];
      return {
        key: id,
        name: cleanName(c),
        shortId: id.slice(0, 12),
        cpu: live?.raw.cpu ?? 0,
        memUsed: live?.raw.memUsed ?? 0,
        memLimit: live?.raw.memLimit ?? 0,
        netRx: live?.netRx ?? 0,
        netTx: live?.netTx ?? 0,
        ioRead: live?.ioRead ?? 0,
        ioWrite: live?.ioWrite ?? 0,
        pids: live?.raw.pids ?? 0,
      };
    });
  }, [targets, data]);

  const summary = useMemo(() => {
    let cpu = 0;
    let mem = 0;
    metricRows.forEach((r) => {
      cpu += r.cpu;
      mem += r.memUsed;
    });
    return {
      containers: rows.length,
      running: running.length,
      cpu,
      memGb: mem / 1024 ** 3,
    };
  }, [metricRows, rows, running]);

  const list = (
    <SideList
      placeholder="Buscar contenedor"
      items={running}
      keyOf={(c) => c.Id ?? cleanName(c)}
      searchText={(c) => `${cleanName(c)} ${c.Image ?? ""}`}
      onSelect={() => undefined}
      checkedKeys={statsSelection}
      onCheck={(key, checked) => toggleStatsSelection(key, checked)}
      renderItem={(c) => (
        <>
          <span className="side-item-name">
            <span className="status-dot status-dot-running" />
            {cleanName(c)}
          </span>
          <span className="side-item-meta">{c.Image}</span>
        </>
      )}
    />
  );

  return (
    <Workbench list={list}>
      <Typography.Paragraph style={{ marginBottom: 12, textAlign: "center" }}>
        Contenedores {summary.containers} · running {summary.running} · CPU{" "}
        {summary.cpu.toFixed(1)}% · memoria usada {summary.memGb.toFixed(2)} GB
      </Typography.Paragraph>

      <Table<MetricRow>
        rowKey="key"
        size="small"
        dataSource={metricRows}
        pagination={false}
        columns={[
          {
            title: "Contenedor",
            dataIndex: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
          },
          {
            title: "ID",
            dataIndex: "shortId",
            render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
            sorter: (a, b) => a.shortId.localeCompare(b.shortId),
          },
          {
            title: "CPU %",
            dataIndex: "cpu",
            align: "right",
            render: (v: number) => `${v.toFixed(1)} %`,
            sorter: (a, b) => a.cpu - b.cpu,
          },
          {
            title: "Memoria",
            dataIndex: "memUsed",
            align: "right",
            render: (v: number, r) =>
              `${fmtBytes(v)} / ${fmtBytes(r.memLimit)}`,
            sorter: (a, b) => a.memUsed - b.memUsed,
          },
          {
            title: "Net I/O",
            dataIndex: "netRx",
            align: "right",
            render: (_: number, r) => `↓${fmtBytes(r.netRx)}/s ↑${fmtBytes(r.netTx)}/s`,
            sorter: (a, b) => a.netRx + a.netTx - (b.netRx + b.netTx),
          },
          {
            title: "Block I/O",
            dataIndex: "ioRead",
            align: "right",
            render: (_: number, r) => `R:${fmtBytes(r.ioRead)}/s W:${fmtBytes(r.ioWrite)}/s`,
            sorter: (a, b) => a.ioRead + a.ioWrite - (b.ioRead + b.ioWrite),
          },
          {
            title: "PIDs",
            dataIndex: "pids",
            align: "right",
            sorter: (a, b) => a.pids - b.pids,
          },
        ]}
      />
    </Workbench>
  );
}
