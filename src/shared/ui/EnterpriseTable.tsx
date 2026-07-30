import { Table, type TableColumnsType } from "antd";

export type EnterpriseColumn<T> = TableColumnsType<T>[number];

interface EnterpriseTableProps<T extends { id: string }> {
  ariaLabel: string;
  columns: EnterpriseColumn<T>[];
  rows: readonly T[];
  loading?: boolean;
  onRowOpen?: (row: T) => void;
}

export function EnterpriseTable<T extends { id: string }>({
  ariaLabel,
  columns,
  rows,
  loading,
  onRowOpen,
}: EnterpriseTableProps<T>) {
  return (
    <section role="region" aria-label={ariaLabel}>
      <Table<T>
        rowKey="id"
        columns={columns}
        dataSource={[...rows]}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: "max-content" }}
        onRow={(row) => ({
          onDoubleClick: () => onRowOpen?.(row),
        })}
      />
    </section>
  );
}
