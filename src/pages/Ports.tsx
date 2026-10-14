import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Table, Tag, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { api, type ContainerSummary, type PortSummary } from "../api";
import { useStore } from "../store";

interface PortRow {
  key: string;
  container: string;
  image: string;
  host?: number;
  private: number;
  type?: string;
  ip?: string;
}

function cleanName(c: ContainerSummary): string {
  const raw = c.Names?.[0] ?? c.Id?.slice(0, 12) ?? "?";
  return raw.replace(/^\//, "");
}

export default function Ports() {
  const [rows, setRows] = useState<ContainerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const eventTick = useStore((s) => s.eventTick);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.containersList(true));
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, eventTick]);

  const ports = useMemo<PortRow[]>(() => {
    const out: PortRow[] = [];
    rows.forEach((c) => {
      (c.Ports ?? []).forEach((p: PortSummary, i) => {
        out.push({
          key: `${c.Id}-${i}`,
          container: cleanName(c),
          image: c.Image ?? "",
          host: p.PublicPort,
          private: p.PrivatePort,
          type: p.Type,
          ip: p.IP,
        });
      });
    });
    return out.sort(
      (a, b) => (b.host ?? b.private) - (a.host ?? a.private),
    );
  }, [rows]);

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
      <Button
        icon={<ReloadOutlined />}
        onClick={load}
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        Refrescar
      </Button>
      <Table<PortRow>
        rowKey="key"
        dataSource={ports}
        pagination={{ pageSize: 50 }}
        size="small"
        columns={[
          {
            title: "Host",
            dataIndex: "host",
            render: (v: number, row) =>
              v ? (
                <Tag color="green">{`${row.ip ?? "0.0.0.0"}:${v}`}</Tag>
              ) : (
                <Typography.Text type="secondary">sin publicar</Typography.Text>
              ),
          },
          {
            title: "Puerto",
            dataIndex: "private",
            render: (v: number, row) => `${v}/${row.type ?? "tcp"}`,
          },
          {
            title: "Contenedor",
            dataIndex: "container",
            render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
          },
          {
            title: "Imagen",
            dataIndex: "image",
            render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
          },
        ]}
      />
    </div>
  );
}
