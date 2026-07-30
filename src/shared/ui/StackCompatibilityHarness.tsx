import ProForm, { ProFormSelect, ProFormText } from "@ant-design/pro-form";
import {
  App,
  Button,
  Card,
  ConfigProvider,
  Drawer,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Typography,
  theme as antdTheme,
  type TableColumnsType,
} from "antd";
import { lazy, Suspense, useMemo, useState } from "react";

const ProTableCompatibilityProbe = lazy(
  () => import("./ProTableCompatibilityProbe"),
);

interface CompatibilityRow {
  id: string;
  indicator: string;
  value: number;
}

interface VirtualCompatibilityRow {
  id: number;
  sampleName: string;
  region: string;
  status: string;
}

const virtualColumns: TableColumnsType<VirtualCompatibilityRow> = [
  { title: "序号", dataIndex: "id", width: 96 },
  { title: "样本名称", dataIndex: "sampleName", width: 220 },
  { title: "所属地区", dataIndex: "region", width: 180 },
  { title: "采集状态", dataIndex: "status", width: 140 },
];

export function StackCompatibilityHarness() {
  const { message, notification } = App.useApp();
  const [darkMode, setDarkMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [rows, setRows] = useState<readonly CompatibilityRow[]>([
    { id: "opening", indicator: "期初库存", value: 112.6 },
  ]);
  const editableColumns = useMemo<TableColumnsType<CompatibilityRow>>(
    () => [
      { title: "指标", dataIndex: "indicator" },
      {
        title: "数值",
        dataIndex: "value",
        render: (value: number, row) => (
          <InputNumber
            aria-label={`${row.indicator}数值`}
            value={value}
            onChange={(nextValue) => {
              if (typeof nextValue !== "number") return;
              setRows((current) =>
                current.map((currentRow) =>
                  currentRow.id === row.id
                    ? { ...currentRow, value: nextValue }
                    : currentRow,
                ),
              );
            }}
          />
        ),
      },
    ],
    [],
  );
  const virtualRows = useMemo(
    () =>
      Array.from({ length: 120 }, (_, index) => ({
        id: index + 1,
        sampleName: `兼容样本 ${index + 1}`,
        region: index % 2 === 0 ? "齐齐哈尔" : "黑河",
        status: index % 3 === 0 ? "已采集" : "待采集",
      })),
    [],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title="企业表单兼容验证">
        <ProForm
          layout="horizontal"
          onFinish={() => {
            void message.success("企业表单验证通过");
            return Promise.resolve(true);
          }}
          submitter={{
            searchConfig: {
              submitText: "验证企业表单",
              resetText: "重置",
            },
          }}
        >
          <ProFormText
            label="企业简称"
            name="companyShortName"
            placeholder="请输入企业简称"
            rules={[{ required: true, message: "请输入企业简称" }]}
          />
          <ProFormSelect
            label="主要能力"
            name="primaryCapability"
            placeholder="请选择主要能力"
            rules={[{ required: true, message: "请选择主要能力" }]}
            options={[
              { label: "贸易", value: "trade" },
              { label: "加工", value: "processing" },
              { label: "仓储", value: "storage" },
            ]}
          />
        </ProForm>
      </Card>
      <section
        role="region"
        aria-label="主题兼容预览"
        data-theme={darkMode ? "dark" : "light"}
      >
        <ConfigProvider
          theme={{
            algorithm: darkMode
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
          }}
        >
          <Card>
            <Space>
              <Switch
                aria-label="暗色模式"
                checked={darkMode}
                onChange={setDarkMode}
              />
              <Typography.Text>
                {darkMode ? "暗色主题" : "亮色主题"}
              </Typography.Text>
            </Space>
          </Card>
        </ConfigProvider>
      </section>
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
      <Table<CompatibilityRow>
        rowKey="id"
        columns={editableColumns}
        dataSource={[...rows]}
        pagination={false}
      />
      <section role="region" aria-label="虚拟滚动表格">
        <Typography.Text type="secondary">120 条模拟记录</Typography.Text>
        <Table<VirtualCompatibilityRow>
          rowKey="id"
          columns={virtualColumns}
          dataSource={virtualRows}
          pagination={false}
          virtual
          scroll={{ x: 640, y: 240 }}
          style={{ marginTop: 12 }}
        />
      </section>
      <Suspense fallback={<div>正在加载 ProTable 兼容门禁</div>}>
        <ProTableCompatibilityProbe />
      </Suspense>
      <Modal
        title="React 19 Modal"
        open={modalOpen}
        cancelText="取消"
        okText="确定"
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
