import { Table, type TableColumnsType } from "antd";
import type { ReactNode } from "react";

export interface EnterpriseColumn<T> {
  title: string;
  dataIndex?: keyof T;
  width?: number;
  pinned?: "left" | "right";
  render?: (value: unknown, row: T) => ReactNode;
}

interface EnterpriseTableProps<T extends { id: string }> {
  ariaLabel: string;
  columns: EnterpriseColumn<T>[];
  rows: readonly T[];
  onRowOpen?: (row: T) => void;
}

export function EnterpriseTable<T extends { id: string }>({
  ariaLabel,
  columns,
  rows,
  onRowOpen,
}: EnterpriseTableProps<T>) {
  const internalColumns: TableColumnsType<T> = columns.map((column) => ({
    title: column.title,
    dataIndex: column.dataIndex ? String(column.dataIndex) : undefined,
    width: column.width,
    fixed: column.pinned,
    render: column.render
      ? (value: unknown, row: T) => column.render?.(value, row)
      : undefined,
  }));

  return (
    <section
      className="enterprise-table-surface"
      role="region"
      aria-label={ariaLabel}
    >
      <Table<T>
        rowKey="id"
        columns={internalColumns}
        dataSource={[...rows]}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: "max-content" }}
        onRow={(row) => ({
          onDoubleClick: () => onRowOpen?.(row),
        })}
      />
    </section>
  );
}
