import { DatabaseOutlined, MenuFoldOutlined } from "@ant-design/icons";
import {
  Button,
  Layout,
  Menu,
  Space,
  Tag,
  Typography,
  type MenuProps,
} from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { navigationItems, type NavigationItem } from "@/app/router/navigation";

type MenuItem = NonNullable<MenuProps["items"]>[number];

function toMenuItem(item: NavigationItem): MenuItem {
  return {
    key: item.path,
    label: item.label,
    children: item.children?.map(toMenuItem),
  };
}

export function EnterpriseShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = useMemo(() => navigationItems.map(toMenuItem), []);

  return (
    <Layout className="enterprise-shell">
      <Layout.Sider
        width={248}
        collapsed={collapsed}
        className="enterprise-sider"
      >
        <div className="enterprise-brand">
          <DatabaseOutlined />
          {!collapsed && <span>粮食商情企业系统</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => void navigate(String(key))}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="enterprise-header">
          <Space>
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
              aria-label="收起或展开菜单"
            />
            <Typography.Text strong>齐齐哈尔粮食商情企业系统</Typography.Text>
          </Space>
          <Space>
            <Tag color="gold">模拟数据</Tag>
            <span>区域审核员</span>
          </Space>
        </Layout.Header>
        <Layout.Content className="enterprise-content">
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
