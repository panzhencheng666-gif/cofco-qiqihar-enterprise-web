import { EditableProTable, type ProColumns } from "@ant-design/pro-components";
import { App, Button, Card, Drawer, Modal, Space, Typography } from "antd";
import { useState } from "react";

interface CompatibilityRow {
  id: string;
  indicator: string;
  value: number;
}

const columns: ProColumns<CompatibilityRow>[] = [
  { title: "指标", dataIndex: "indicator", editable: false },
  { title: "数值", dataIndex: "value", valueType: "digit" },
];

export function StackCompatibilityHarness() {
  const { message, notification } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [rows, setRows] = useState<readonly CompatibilityRow[]>([
    { id: "opening", indicator: "期初库存", value: 112.6 },
  ]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space wrap>
          <Button onClick={() => void message.success("Message 正常")}>
            测试 Message
          </Button>
          <Button
            onClick={() =>
              notification.success({ message: "Notification 正常" })
            }
          >
            测试 Notification
          </Button>
          <Button onClick={() => setModalOpen(true)}>测试 Modal</Button>
          <Button onClick={() => setDrawerOpen(true)}>测试 Drawer</Button>
        </Space>
      </Card>
      <Typography.Text type="secondary">
        模拟数据 · 仅用于兼容性验证
      </Typography.Text>
      <EditableProTable<CompatibilityRow>
        rowKey="id"
        columns={columns}
        value={[...rows]}
        onChange={(next) => setRows(next)}
        recordCreatorProps={false}
        editable={{
          type: "multiple",
          editableKeys: rows.map((row) => row.id),
        }}
      />
      <Modal
        title="React 19 Modal"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => setModalOpen(false)}
      >
        兼容测试内容
      </Modal>
      <Drawer
        title="React 19 Drawer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        兼容测试内容
      </Drawer>
    </Space>
  );
}
