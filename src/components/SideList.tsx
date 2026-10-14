import { useMemo, useState, type ReactNode } from "react";
import { Checkbox, Empty, Input } from "antd";

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  searchText?: (item: T) => string;
  selectedKey?: string | null;
  onSelect: (item: T) => void;
  placeholder?: string;
  checkedKeys?: string[];
  onCheck?: (key: string, checked: boolean) => void;
}

export default function SideList<T>({
  items,
  keyOf,
  renderItem,
  searchText,
  selectedKey,
  onSelect,
  placeholder = "Buscar",
  checkedKeys,
  onCheck,
}: Props<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      (searchText ? searchText(item) : "").toLowerCase().includes(needle),
    );
  }, [items, query, searchText]);

  return (
    <div className="side-list">
      <div className="side-list-header">
        <Input
          allowClear
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="side-list-count">
          {filtered.length} de {items.length}
        </div>
      </div>
      <div className="side-list-body">
        {filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Sin resultados"
          />
        ) : (
          filtered.map((item) => {
            const key = keyOf(item);
            return (
              <div
                key={key}
                className={
                  "side-item" + (key === selectedKey ? " side-item-active" : "")
                }
                onClick={() => onSelect(item)}
              >
                {onCheck && (
                  <Checkbox
                    className="side-item-check"
                    checked={checkedKeys?.includes(key) ?? false}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onCheck(key, e.target.checked)}
                  />
                )}
                <div className="side-item-content">{renderItem(item)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
