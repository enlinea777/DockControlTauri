import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Col, Radio, Row, Typography } from "antd";
import { onStats } from "../api";
import LineChart from "./LineChart";
import { fmtBytes, fmtBytesAxis, readRaw, type RawStats } from "../lib/stats";

interface Props {
  start: () => Promise<string>;
}

interface Sample {
  t: number;
  cpu: number;
  memUsed: number;
  memLimit: number;
  rx: number;
  tx: number;
  ioRead: number;
  ioWrite: number;
}

const MAX_POINTS = 20000;

const RANGES = [
  { label: "1m", secs: 60 },
  { label: "5m", secs: 300 },
  { label: "10m", secs: 600 },
  { label: "30m", secs: 1800 },
  { label: "1h", secs: 3600 },
  { label: "1d", secs: 86400 },
];

const INTERVALS = [
  { label: "1s", secs: 1 },
  { label: "5s", secs: 5 },
  { label: "10s", secs: 10 },
  { label: "30s", secs: 30 },
  { label: "1m", secs: 60 },
  { label: "5m", secs: 300 },
  { label: "10m", secs: 600 },
  { label: "1h", secs: 3600 },
];

const COLORS = {
  cpu: "#8ab6f9",
  mem: "#93d9a7",
  io: "#c3a6e6",
  net: "#f7c78b",
};

function downsample(
  samples: Sample[],
  rangeSecs: number,
  intervalSecs: number,
): Sample[] {
  const cutoff = Date.now() - rangeSecs * 1000;
  const bucketMs = intervalSecs * 1000;
  const buckets = new Map<number, { n: number; s: Sample }>();

  for (const sample of samples) {
    if (sample.t < cutoff) continue;
    const key = Math.floor(sample.t / bucketMs) * bucketMs;
    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, { n: 1, s: { ...sample, t: key } });
    } else {
      bucket.n += 1;
      bucket.s.cpu += sample.cpu;
      bucket.s.memUsed += sample.memUsed;
      bucket.s.memLimit = Math.max(bucket.s.memLimit, sample.memLimit);
      bucket.s.rx += sample.rx;
      bucket.s.tx += sample.tx;
      bucket.s.ioRead += sample.ioRead;
      bucket.s.ioWrite += sample.ioWrite;
    }
  }

  const result = [...buckets.values()]
    .sort((a, b) => a.s.t - b.s.t)
    .map(({ n, s }) => ({
      t: s.t,
      cpu: s.cpu / n,
      memUsed: s.memUsed / n,
      memLimit: s.memLimit,
      rx: s.rx / n,
      tx: s.tx / n,
      ioRead: s.ioRead / n,
      ioWrite: s.ioWrite / n,
    }));

  return result.length > 240 ? result.slice(-240) : result;
}

function ChartCard({
  title,
  value,
  data,
  times,
  color,
  format,
  footer,
}: {
  title: string;
  value: string;
  data: number[];
  times: number[];
  color: string;
  format: (v: number) => string;
  footer?: string;
}) {
  return (
    <Card size="small" bodyStyle={{ padding: 12 }}>
      <div className="chart-title">{title}</div>
      <div className="chart-body">
        <div className="chart-plot">
          <div className="chart-overlay">{value}</div>
          <LineChart data={data} times={times} color={color} format={format} />
        </div>
      </div>
      {footer && <div className="chart-footer">{footer}</div>}
    </Card>
  );
}

export default function StatsView({ start }: Props) {
  const [history, setHistory] = useState<Sample[]>([]);
  const [rangeSecs, setRangeSecs] = useState(60);
  const [intervalSecs, setIntervalSecs] = useState(1);
  const id = useRef<string | null>(null);
  const prev = useRef<{ raw: RawStats; time: number } | null>(null);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    start().then((uid) => {
      id.current = uid;
      onStats((event) => {
        if (!active || event.id !== id.current) return;
        const raw = readRaw(event.stats);
        const now = Date.now();
        const last = prev.current;
        const dt = last ? (now - last.time) / 1000 : 0;
        const rate = (curr: number, before: number) =>
          last && dt > 0 ? Math.max(0, (curr - before) / dt) : 0;

        const sample: Sample = {
          t: now,
          cpu: raw.cpu,
          memUsed: raw.memUsed,
          memLimit: raw.memLimit,
          rx: rate(raw.netRx, last?.raw.netRx ?? 0),
          tx: rate(raw.netTx, last?.raw.netTx ?? 0),
          ioRead: rate(raw.ioRead, last?.raw.ioRead ?? 0),
          ioWrite: rate(raw.ioWrite, last?.raw.ioWrite ?? 0),
        };
        prev.current = { raw, time: now };
        setHistory((h) => {
          const next = [...h, sample];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [start]);

  const series = useMemo(
    () => downsample(history, rangeSecs, intervalSecs),
    [history, rangeSecs, intervalSecs],
  );

  const latest = series[series.length - 1];
  const times = series.map((s) => s.t);

  const cpuFmt = (v: number) => `${Math.round(v)}%`;

  return (
    <>
      <div className="stats-controls">
        <div className="stats-control-group">
          <Typography.Text type="secondary">Rango</Typography.Text>
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={rangeSecs}
            onChange={(e) => setRangeSecs(e.target.value)}
            options={RANGES.map((r) => ({ label: r.label, value: r.secs }))}
          />
        </div>
        <div className="stats-control-group">
          <Typography.Text type="secondary">Intervalo</Typography.Text>
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={intervalSecs}
            onChange={(e) => setIntervalSecs(e.target.value)}
            options={INTERVALS.map((r) => ({ label: r.label, value: r.secs }))}
          />
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <ChartCard
            title="Uso de CPU"
            value={latest ? `${latest.cpu.toFixed(1)} %` : "0 %"}
            data={series.map((s) => s.cpu)}
            times={times}
            color={COLORS.cpu}
            format={cpuFmt}
          />
        </Col>
        <Col span={12}>
          <ChartCard
            title="Uso de Memoria"
            value={latest ? fmtBytes(latest.memUsed) : "0 B"}
            data={series.map((s) => s.memUsed)}
            times={times}
            color={COLORS.mem}
            format={fmtBytesAxis}
            footer={latest ? `límite ${fmtBytes(latest.memLimit)}` : undefined}
          />
        </Col>
        <Col span={12}>
          <ChartCard
            title="IO de Disco"
            value={latest ? fmtBytes(latest.ioRead + latest.ioWrite) + "/s" : "0 B/s"}
            data={series.map((s) => s.ioRead + s.ioWrite)}
            times={times}
            color={COLORS.io}
            format={fmtBytesAxis}
            footer={
              latest
                ? `R ${fmtBytes(latest.ioRead)}/s · W ${fmtBytes(latest.ioWrite)}/s`
                : undefined
            }
          />
        </Col>
        <Col span={12}>
          <ChartCard
            title="IO de Red"
            value={latest ? fmtBytes(latest.rx + latest.tx) + "/s" : "0 B/s"}
            data={series.map((s) => s.rx + s.tx)}
            times={times}
            color={COLORS.net}
            format={fmtBytesAxis}
            footer={
              latest
                ? `RX ${fmtBytes(latest.rx)}/s · TX ${fmtBytes(latest.tx)}/s`
                : undefined
            }
          />
        </Col>
      </Row>
    </>
  );
}
