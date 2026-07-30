import ProTable from "@ant-design/pro-table/es/Table";
import type { ProColumns } from "@ant-design/pro-table/es/typing";

interface ProTableCompatibilityRow {
  id: string;
  objectName: string;
  capability: string;
}

const columns: ProColumns<ProTableCompatibilityRow>[] = [
  { title: "监测对象", dataIndex: "objectName" },
  { title: "主要能力", dataIndex: "capability" },
];

const rows: ProTableCompatibilityRow[] = [
  {
    id: "pro-table-runtime-row",
    objectName: "齐齐哈尔兼容样本企业",
    capability: "贸易",
  },
];

export default function ProTableCompatibilityProbe() {
  return (
    <section role="region" aria-label="ProTable 运行时兼容表格">
      <p>ProTable 真实组件</p>
      <ProTable<ProTableCompatibilityRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        search={false}
        options={false}
        pagination={false}
        tableAlertRender={false}
        rowSelection={{}}
      />
    </section>
  );
}
