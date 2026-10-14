export interface RawStats {
  cpu: number;
  memUsed: number;
  memLimit: number;
  netRx: number;
  netTx: number;
  ioRead: number;
  ioWrite: number;
  pids: number;
}

export function readRaw(stats: any): RawStats {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) -
    (stats.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus = stats.cpu_stats?.online_cpus || 1;
  const cpu = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

  const memStats = stats.memory_stats ?? {};
  const cache = memStats.stats?.cache ?? memStats.stats?.inactive_file ?? 0;
  const memUsed = Math.max(0, (memStats.usage ?? 0) - cache);

  let netRx = 0;
  let netTx = 0;
  Object.values(stats.networks ?? {}).forEach((net: any) => {
    netRx += net.rx_bytes ?? 0;
    netTx += net.tx_bytes ?? 0;
  });

  let ioRead = 0;
  let ioWrite = 0;
  (stats.blkio_stats?.io_service_bytes_recursive ?? []).forEach(
    (entry: { op?: string; value?: number }) => {
      const op = (entry.op ?? "").toLowerCase();
      if (op === "read") ioRead += entry.value ?? 0;
      if (op === "write") ioWrite += entry.value ?? 0;
    },
  );

  return {
    cpu: Math.min(100, Math.max(0, Number(cpu.toFixed(1)))),
    memUsed: Math.max(0, memUsed),
    memLimit: memStats.limit ?? 0,
    netRx,
    netTx,
    ioRead,
    ioWrite,
    pids: stats.pids_stats?.current ?? 0,
  };
}

export function fmtBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

export function fmtBytesAxis(bytes: number): string {
  if (!bytes || bytes < 0) return "0";
  const units = ["B", "K", "M", "G", "T"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** i;
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}${units[i]}`;
}
