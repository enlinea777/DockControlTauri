import { useEffect, useState } from "react";
import {
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Typography,
  message,
} from "antd";
import { api } from "../api";

export default function System() {
  const [version, setVersion] = useState<Record<string, any> | null>(null);
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    api.dockerVersion().then(setVersion).catch((e) => message.error(String(e)));
    api.dockerInfo().then(setInfo).catch((e) => message.error(String(e)));
  }, []);

  return (
    <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
      <Space direction="vertical" style={{ width: "100%" }} size="large">
      <Card title="Versión de Docker">
        {version ? (
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Versión">
              {String(version.Version ?? "-")}
            </Descriptions.Item>
            <Descriptions.Item label="API">
              {String(version.ApiVersion ?? "-")}
            </Descriptions.Item>
            <Descriptions.Item label="Min API">
              {String(version.MinAPIVersion ?? "-")}
            </Descriptions.Item>
            <Descriptions.Item label="Git commit">
              {String(version.GitCommit ?? "-").slice(0, 12)}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">Cargando…</Typography.Text>
        )}
      </Card>

      <Card title="Resumen">
        <Row gutter={16}>
          <Col span={4}>
            <Statistic title="Contenedores" value={info?.Containers ?? 0} />
          </Col>
          <Col span={4}>
            <Statistic title="En ejecución" value={info?.ContainersRunning ?? 0} />
          </Col>
          <Col span={4}>
            <Statistic title="Detenidos" value={info?.ContainersStopped ?? 0} />
          </Col>
          <Col span={4}>
            <Statistic title="Imágenes" value={info?.Images ?? 0} />
          </Col>
          <Col span={4}>
            <Statistic title="CPUs" value={info?.NCPU ?? 0} />
          </Col>
          <Col span={4}>
            <Statistic
              title="Memoria"
              value={((info?.MemTotal ?? 0) / 1024 ** 3).toFixed(1)}
              suffix="GiB"
            />
          </Col>
        </Row>
      </Card>

      <Card title="Sistema">
        {info ? (
          <Descriptions column={2} size="small">
            <Descriptions.Item label="SO">
              {info.OperatingSystem}
            </Descriptions.Item>
            <Descriptions.Item label="Kernel">
              {info.KernelVersion}
            </Descriptions.Item>
            <Descriptions.Item label="Arquitectura">
              {info.Architecture}
            </Descriptions.Item>
            <Descriptions.Item label="Storage driver">
              {info.Driver}
            </Descriptions.Item>
            <Descriptions.Item label="Cgroup">
              {info.CgroupVersion}
            </Descriptions.Item>
            <Descriptions.Item label="Nombre">{info.Name}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">Cargando…</Typography.Text>
        )}
      </Card>
    </Space>
    </div>
  );
}
