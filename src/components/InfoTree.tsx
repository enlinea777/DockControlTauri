import { useState } from "react";
import { Tree } from "antd";
import type { DataNode } from "antd/es/tree";

let persistedExpandedKeys: string[] = [];

function isContainer(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function buildNode(label: string, value: unknown, key: string): DataNode {
  if (!isContainer(value)) {
    return {
      key,
      title: (
        <span className="info-leaf">
          <span className="info-key">{label}</span>
          <span className="info-colon">: </span>
          <span className="info-value">{String(value)}</span>
        </span>
      ),
    };
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  const children = entries.map(([childLabel, childValue]) =>
    buildNode(
      childLabel,
      childValue,
      Array.isArray(value) ? `${key}[${childLabel}]` : `${key}.${childLabel}`,
    ),
  );

  const typeLabel = Array.isArray(value) ? `[${entries.length}]` : "";
  return {
    key,
    title: (
      <span className="info-branch">
        <span className="info-key">{label}</span>
        {typeLabel ? <span className="info-type"> {typeLabel}</span> : null}
      </span>
    ),
    children: children.length ? children : undefined,
  };
}

export default function InfoTree({ value }: { value: unknown }) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>(
    persistedExpandedKeys,
  );

  const entries: [string, unknown][] = isContainer(value)
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(value as Record<string, unknown>)
    : [["value", value]];

  const treeData = entries.map(([label, child]) =>
    buildNode(label, child, label),
  );

  return (
    <Tree
      showLine
      selectable={false}
      expandedKeys={expandedKeys}
      onExpand={(keys) => {
        const next = keys.map((k) => String(k));
        persistedExpandedKeys = next;
        setExpandedKeys(next);
      }}
      treeData={treeData}
      switcherIcon={(props: { expanded?: boolean }) => (
        <span className="info-arrow">{props.expanded ? "▾" : "▸"}</span>
      )}
    />
  );
}
